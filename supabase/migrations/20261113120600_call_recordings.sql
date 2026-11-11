-- Call recording and transcription, replacing Fathom (knowledge base question 16, decided 11 November
-- 2026; the clinic already has patients' consent to record).
--
--   From a patient's record, a doctor, nurse or health coach on their care team records the call: their
--   microphone and the call's own sound. The browser uploads the audio straight to the private
--   'recordings' bucket, never through the web server. The server sends a short-lived link to the
--   transcription service (AssemblyAI, EU region), and the transcript arrives as a draft note on the
--   patient's record, written in the recorder's name, which they check and sign. Patients never see
--   recordings. Nothing is deleted.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 52428800, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'])
on conflict (id) do nothing;

create type public.recording_status as enum ('uploading', 'transcribing', 'transcribed', 'failed');

create table public.call_recordings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  recorded_by uuid not null references public.staff_profiles (id) on delete restrict,
  storage_path text not null unique,
  status public.recording_status not null default 'uploading',
  provider_job_id text,
  note_id uuid references public.clinical_notes (id) on delete restrict,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint call_recordings_path_is_patients check (split_part(storage_path, '/', 1) = patient_id::text)
);
comment on table public.call_recordings is 'A recorded call and its transcription. The transcript becomes a draft note for the recorder to check and sign.';
create index call_recordings_patient_idx on public.call_recordings (patient_id, created_at desc);
create index call_recordings_recorded_by_idx on public.call_recordings (recorded_by);
create index call_recordings_note_idx on public.call_recordings (note_id);

create trigger call_recordings_set_updated_at before update on public.call_recordings
  for each row execute function private.set_updated_at();
create trigger call_recordings_write_audit_log after insert or update or delete on public.call_recordings
  for each row execute function private.write_audit_log();

alter table public.call_recordings enable row level security;
alter table public.call_recordings force row level security;
revoke all on table public.call_recordings from public, anon, authenticated, service_role;
grant select on public.call_recordings to authenticated, service_role;
grant insert (patient_id, recorded_by, storage_path) on public.call_recordings to authenticated;

create policy "Staff who can open the record read its recordings" on public.call_recordings
  for select to authenticated using (private.in_scope(patient_id));
create policy "Doctors, nurses and health coaches record their patients' calls" on public.call_recordings
  for insert to authenticated
  with check (
    ((select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('health_coach')))
    and private.in_scope(patient_id)
    and recorded_by = (select private.my_staff_id())
  );

-- The audio files: written by the recorder into the patient's folder, read by staff in scope only.
create policy "Clinicians upload call recordings for their patients" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recordings'
    and ((select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('health_coach')))
    and private.in_scope(private.try_uuid(split_part(name, '/', 1)))
  );
create policy "Staff in scope read call recordings" on storage.objects
  for select to authenticated
  using (bucket_id = 'recordings' and private.in_scope(private.try_uuid(split_part(name, '/', 1))));

-- Server steps, service role only, each logged under a named job or the recorder.
create function private.recording_sent(_recording uuid, _job text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.system_actor', 'transcription', true);
  update public.call_recordings set status = 'transcribing', provider_job_id = _job, error = null
  where id = _recording and status in ('uploading', 'failed');
end;
$$;

create function private.recording_failed(_recording uuid, _error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.system_actor', 'transcription', true);
  update public.call_recordings set status = 'failed', error = left(_error, 500)
  where id = _recording and status <> 'transcribed';
end;
$$;

-- The transcript becomes a draft note in the recorder's name. Once only: a second delivery does nothing.
create function private.recording_transcribed(_recording uuid, _title text, _body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.call_recordings;
  author_user uuid;
  note uuid;
begin
  select * into r from public.call_recordings where id = _recording for update;
  if not found then
    raise exception 'That recording was not found.' using errcode = '22023';
  end if;
  if r.status = 'transcribed' then
    return r.note_id;
  end if;
  select s.user_id into author_user from public.staff_profiles s where s.id = r.recorded_by;
  perform set_config('app.actor_id', author_user::text, true);
  insert into public.clinical_notes (patient_id, author_id, title, body, source)
  values (r.patient_id, r.recorded_by, left(_title, 200), left(_body, 50000), 'recording')
  returning id into note;
  update public.call_recordings set status = 'transcribed', note_id = note, error = null where id = _recording;
  return note;
end;
$$;

create function public.recording_sent(_recording uuid, _job text)
returns void language sql security invoker set search_path = '' as $$ select private.recording_sent(_recording, _job); $$;
create function public.recording_failed(_recording uuid, _error text)
returns void language sql security invoker set search_path = '' as $$ select private.recording_failed(_recording, _error); $$;
create function public.recording_transcribed(_recording uuid, _title text, _body text)
returns uuid language sql security invoker set search_path = '' as $$ select private.recording_transcribed(_recording, _title, _body); $$;

revoke all on function
  private.recording_sent(uuid, text), private.recording_failed(uuid, text), private.recording_transcribed(uuid, text, text),
  public.recording_sent(uuid, text), public.recording_failed(uuid, text), public.recording_transcribed(uuid, text, text)
from public, anon, authenticated;
grant execute on function
  private.recording_sent(uuid, text), private.recording_failed(uuid, text), private.recording_transcribed(uuid, text, text),
  public.recording_sent(uuid, text), public.recording_failed(uuid, text), public.recording_transcribed(uuid, text, text)
to service_role;
