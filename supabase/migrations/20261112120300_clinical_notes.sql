-- Clinical notes in Clinic Hub (decided by the clinic on 11 November 2026, knowledge base question 15;
-- brief item 16: notes locked and versioned once signed off).
--
--   Doctors, nurses and health coaches write notes for patients on their care team. A note is a draft
--   until its author signs it. Once signed it can never change, for anyone: a correction is a new
--   note that supersedes it, with the next version number, and is signed in its turn. Nothing is
--   deleted; an unwanted draft is archived. Everyone who may open the patient's record reads the
--   notes (in_scope). Patients and guardians do not: they get letters.
--   A note can come from a call recording (source 'recording'): the transcript arrives as a draft
--   that the author checks and signs.

create type public.note_status as enum ('draft', 'signed');
create type public.note_source as enum ('typed', 'recording');

create table public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  author_id uuid not null references public.staff_profiles (id) on delete restrict,
  appointment_id uuid references public.appointments (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  body text not null check (char_length(btrim(body)) between 1 and 50000),
  source public.note_source not null default 'typed',
  status public.note_status not null default 'draft',
  version integer not null default 1 check (version >= 1),
  supersedes_id uuid references public.clinical_notes (id) on delete restrict,
  signed_at timestamptz,
  signed_by uuid references public.staff_profiles (id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_notes_signed_fields check ((status = 'signed') = (signed_at is not null and signed_by is not null)),
  constraint clinical_notes_signed_not_archived check (not (status = 'signed' and archived_at is not null))
);
comment on table public.clinical_notes is 'Consultation and coaching notes. Locked once signed: a correction is a new version that supersedes the old one.';
comment on column public.clinical_notes.source is 'typed, or recording: a transcript of a recorded call, checked by the author before signing.';
comment on column public.clinical_notes.supersedes_id is 'The signed note this one corrects. Empty for a first version.';

create index clinical_notes_patient_id_idx on public.clinical_notes (patient_id, created_at desc);
create index clinical_notes_author_id_idx on public.clinical_notes (author_id);
create index clinical_notes_signed_by_idx on public.clinical_notes (signed_by);
create index clinical_notes_appointment_id_idx on public.clinical_notes (appointment_id);
create index clinical_notes_supersedes_id_idx on public.clinical_notes (supersedes_id);
-- One live correction per signed note, so two people cannot amend the same version in parallel.
create unique index clinical_notes_one_amendment on public.clinical_notes (supersedes_id)
  where supersedes_id is not null and archived_at is null;

create trigger clinical_notes_set_updated_at before update on public.clinical_notes
  for each row execute function private.set_updated_at();
create trigger clinical_notes_write_audit_log after insert or update or delete on public.clinical_notes
  for each row execute function private.write_audit_log();

-- A new note's version follows the note it corrects, which must be a signed note of the same patient.
create function private.clinical_note_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  previous public.clinical_notes;
begin
  if new.supersedes_id is null then
    new.version := 1;
    return new;
  end if;
  select * into previous from public.clinical_notes n where n.id = new.supersedes_id;
  if not found or previous.patient_id <> new.patient_id or previous.status <> 'signed' then
    raise exception 'Only a signed note of the same patient can be corrected.' using errcode = '22023';
  end if;
  new.version := previous.version + 1;
  return new;
end;
$$;
comment on function private.clinical_note_version() is 'Trigger: numbers a correction one above the signed note it supersedes.';
create trigger clinical_notes_version before insert on public.clinical_notes
  for each row execute function private.clinical_note_version();

-- The lock. A signed note never changes, whoever asks, and no note is ever deleted.
create function private.clinical_note_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Notes are never deleted. Archive a draft instead.' using errcode = '42501';
  end if;
  if old.status = 'signed' then
    raise exception 'A signed note cannot be changed. Write a correction instead.' using errcode = '42501';
  end if;
  if old.archived_at is not null then
    raise exception 'An archived draft cannot be changed.' using errcode = '42501';
  end if;
  if new.patient_id <> old.patient_id or new.author_id <> old.author_id or new.supersedes_id is distinct from old.supersedes_id
     or new.version <> old.version or new.source <> old.source then
    raise exception 'A note cannot move to another patient, author or version.' using errcode = '42501';
  end if;
  return new;
end;
$$;
comment on function private.clinical_note_lock() is 'Trigger: signed notes are locked and no note is deleted, for every role.';
create trigger clinical_notes_lock before update or delete on public.clinical_notes
  for each row execute function private.clinical_note_lock();

alter table public.clinical_notes enable row level security;
alter table public.clinical_notes force row level security;

revoke all on table public.clinical_notes from public, anon, authenticated, service_role;
grant select on public.clinical_notes to authenticated, service_role;
grant insert (patient_id, author_id, appointment_id, title, body, source, supersedes_id) on public.clinical_notes to authenticated, service_role;
grant update (title, body, archived_at) on public.clinical_notes to authenticated;

create policy "Staff who can open the record read its notes" on public.clinical_notes
  for select to authenticated
  using (private.in_scope(patient_id));

create policy "Doctors, nurses and health coaches write drafts for their patients" on public.clinical_notes
  for insert to authenticated
  with check (
    ((select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('health_coach')))
    and private.in_scope(patient_id)
    and author_id = (select private.my_staff_id())
  );

create policy "Authors change or archive their own drafts" on public.clinical_notes
  for update to authenticated
  using (author_id = (select private.my_staff_id()) and status = 'draft' and private.in_scope(patient_id))
  with check (author_id = (select private.my_staff_id()) and status = 'draft' and private.in_scope(patient_id));

-- Signing: only the author, only a live draft, only while the patient is still theirs.
create function private.sign_clinical_note(_note uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff uuid := private.my_staff_id();
  n public.clinical_notes;
begin
  select * into n from public.clinical_notes where id = _note for update;
  if not found or staff is null or n.author_id <> staff or not private.in_scope(n.patient_id) then
    raise exception 'You cannot sign this note.' using errcode = '42501';
  end if;
  if n.status = 'signed' then
    raise exception 'This note is already signed.' using errcode = '23505';
  end if;
  if n.archived_at is not null then
    raise exception 'This draft was archived.' using errcode = '22023';
  end if;
  update public.clinical_notes set status = 'signed', signed_at = now(), signed_by = staff where id = _note;
end;
$$;
comment on function private.sign_clinical_note(uuid) is 'Signs a draft note. The author only. After this the note is locked.';

create function public.sign_clinical_note(_note uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.sign_clinical_note(_note); $$;

revoke all on function private.sign_clinical_note(uuid), public.sign_clinical_note(uuid),
  private.clinical_note_version(), private.clinical_note_lock()
from public, anon, authenticated;
grant execute on function private.sign_clinical_note(uuid), public.sign_clinical_note(uuid) to authenticated;
