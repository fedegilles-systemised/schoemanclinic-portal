-- Lab reports pushed to us. A blood or stool test provider posts a PDF with the patient's name, email and
-- date of birth to a webhook (app/api/webhooks/lab-results/[provider]). The file is filed under the
-- patient when exactly one patient matches by email and date of birth, and otherwise waits in the import
-- queue as "needs matching" for a PA. Nothing is released: a PA enters the values and a doctor releases.
--
--   1. A source for the file and for the stored event.
--   2. What the lab told us about the patient, kept on the import so a PA can match it by hand.
--   3. Finding the patient, receiving the file once, and matching a waiting file to a patient.

-- 1. Sources ---------------------------------------------------------------------------------------

alter type public.webhook_source add value if not exists 'lab_feed';
alter type public.document_source add value if not exists 'lab_feed';

-- 2. What the lab told us --------------------------------------------------------------------------

alter table public.result_imports
  add column source_provider text,
  add column source_report_id text,
  add column source_name text,
  add column source_email text,
  add column source_date_of_birth date,
  add column source_sample_date date,
  add column source_test_name text;
alter table public.result_imports
  add constraint result_imports_source_length check (
    (source_provider is null or char_length(source_provider) <= 60)
    and (source_report_id is null or char_length(source_report_id) <= 200)
    and (source_name is null or char_length(source_name) <= 200)
    and (source_email is null or char_length(source_email) <= 254)
    and (source_test_name is null or char_length(source_test_name) <= 200)
  );
comment on column public.result_imports.source_provider is 'The lab that pushed the file, by the short name in its webhook address. Empty for a file that came another way.';
comment on column public.result_imports.source_report_id is 'The lab''s own id for the report, or a hash of the file. With the provider it makes a report arrive once, however often the lab retries.';
comment on column public.result_imports.source_name is 'The patient name as the lab wrote it, to help a PA match a waiting file. Never used to find a patient.';
comment on column public.result_imports.source_email is 'The patient email as the lab wrote it.';
comment on column public.result_imports.source_date_of_birth is 'The patient date of birth as the lab wrote it.';
create unique index result_imports_source_report_idx on public.result_imports (source_provider, source_report_id)
  where source_provider is not null;

-- 3. The functions ---------------------------------------------------------------------------------

-- The one patient with this email and date of birth, or null when there is none or more than one.
-- Never says which of the two it was, so a lab cannot use it to find out who is a patient.
create function private.find_patient_for_lab(_email text, _dob date)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  address text := lower(btrim(coalesce(_email, '')));
  found uuid[];
begin
  if address = '' or _dob is null then
    return null;
  end if;
  select array_agg(distinct pp.id) into found
  from public.patient_profiles pp
  left join public.profiles p on p.id = pp.user_id
  where pp.archived_at is null
    and pp.date_of_birth = _dob
    and (lower(pp.contact_email) = address or lower(p.email) = address);
  if cardinality(found) = 1 then
    return found[1];
  end if;
  return null;
end;
$$;

-- Server code files a lab report it has just stored. The path must start with the patient's id, or
-- with unmatched/ when no patient was found. A report with the same provider and id is recorded once:
-- a retry gets the same import back with is_new false. The stored event holds no name, email or date.
create function private.receive_lab_file(
  _provider text, _external_id text, _patient uuid, _storage_path text, _title text,
  _name text, _email text, _dob date, _sample_date date, _test_name text
)
returns table (import_id uuid, is_new boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
  doc_id uuid;
  new_import uuid;
  existing uuid;
begin
  perform set_config('app.system_actor', 'lab-webhook', true);
  if _provider is null or _provider !~ '^[a-z0-9][a-z0-9-]{0,40}$' then
    raise exception 'The lab name is not valid.' using errcode = '22023';
  end if;
  if _external_id is null or char_length(btrim(_external_id)) not between 1 and 200 then
    raise exception 'The report needs an id.' using errcode = '22023';
  end if;

  insert into public.webhook_events (source, external_event_id, event_type, payload, status, processed_at)
  values ('lab_feed', _provider || ':' || _external_id, 'lab_file', jsonb_build_object('provider', _provider, 'matched', _patient is not null), 'processed', now())
  on conflict (source, external_event_id) do nothing
  returning id into event_id;

  if event_id is null then
    select i.id into existing from public.result_imports i where i.source_provider = _provider and i.source_report_id = _external_id;
    perform set_config('app.system_actor', '', true);
    import_id := existing;
    is_new := false;
    return next;
    return;
  end if;

  insert into public.documents (patient_id, kind, title, storage_path, source, shared_with_patient)
  values (_patient, 'lab_report', left(coalesce(nullif(btrim(_title), ''), 'Lab report'), 120), _storage_path, 'lab_feed', false)
  returning id into doc_id;

  insert into public.result_imports (
    document_id, patient_id, status, source_provider, source_report_id,
    source_name, source_email, source_date_of_birth, source_sample_date, source_test_name
  )
  values (
    doc_id, _patient, case when _patient is null then 'needs_match'::public.import_status else 'matched'::public.import_status end,
    _provider, _external_id, left(_name, 200), left(_email, 254), _dob, _sample_date, left(_test_name, 200)
  )
  returning id into new_import;

  perform set_config('app.system_actor', '', true);
  import_id := new_import;
  is_new := true;
  return next;
end;
$$;

-- A PA or an admin matches a waiting file to a patient. Server code has already moved the file in
-- storage to _new_path, which must start with the patient's id. Only a file waiting for a match can be
-- matched, and only once.
create function private.match_import_to_patient(_import uuid, _patient uuid, _new_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  imp public.result_imports;
  doc public.documents;
begin
  if not (select private.has_role('pa') or private.has_role('admin')) then
    raise exception 'Only a PA or an admin can match a file to a patient.' using errcode = '42501';
  end if;
  select * into imp from public.result_imports i where i.id = _import for update;
  if not found or imp.status <> 'needs_match' or imp.patient_id is not null then
    raise exception 'That file is not waiting for a match.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.patient_profiles pp where pp.id = _patient and pp.archived_at is null) then
    raise exception 'Choose a patient.' using errcode = '22023';
  end if;
  if _new_path is null or split_part(_new_path, '/', 1) <> _patient::text then
    raise exception 'The file is not stored under that patient.' using errcode = '22023';
  end if;
  select * into doc from public.documents d where d.id = imp.document_id for update;
  update public.documents set patient_id = _patient, storage_path = _new_path where id = doc.id;
  update public.result_imports set patient_id = _patient, status = 'matched' where id = imp.id;
end;
$$;

-- Wrappers and grants ------------------------------------------------------------------------------

create function public.find_patient_for_lab(_email text, _dob date)
returns uuid language sql stable security invoker set search_path = ''
as $$ select private.find_patient_for_lab(_email, _dob); $$;
create function public.receive_lab_file(
  _provider text, _external_id text, _patient uuid, _storage_path text, _title text,
  _name text, _email text, _dob date, _sample_date date, _test_name text
)
returns table (import_id uuid, is_new boolean)
language sql security invoker set search_path = ''
as $$ select * from private.receive_lab_file(_provider, _external_id, _patient, _storage_path, _title, _name, _email, _dob, _sample_date, _test_name); $$;
create function public.match_import_to_patient(_import uuid, _patient uuid, _new_path text)
returns void language sql security invoker set search_path = ''
as $$ select private.match_import_to_patient(_import, _patient, _new_path); $$;

revoke all on function
  private.find_patient_for_lab(text, date),
  private.receive_lab_file(text, text, uuid, text, text, text, text, date, date, text),
  private.match_import_to_patient(uuid, uuid, text),
  public.find_patient_for_lab(text, date),
  public.receive_lab_file(text, text, uuid, text, text, text, text, date, date, text),
  public.match_import_to_patient(uuid, uuid, text)
from public, anon, authenticated;

grant execute on function
  private.find_patient_for_lab(text, date),
  private.receive_lab_file(text, text, uuid, text, text, text, text, date, date, text),
  public.find_patient_for_lab(text, date),
  public.receive_lab_file(text, text, uuid, text, text, text, text, date, date, text)
to service_role;

grant execute on function
  private.match_import_to_patient(uuid, uuid, text),
  public.match_import_to_patient(uuid, uuid, text)
to authenticated;
