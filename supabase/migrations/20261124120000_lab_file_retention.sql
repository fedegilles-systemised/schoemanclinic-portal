-- How long Clinic Hub keeps what a lab sent about people who may not be patients.
--
--   * A lab file left unmatched, or turned away, for 30 days has its PDF removed from storage and the
--     lab's name, email and date of birth cleared. The import row and the archived document row stay,
--     so there is a record that the file came and was dealt with, and a lab that sends it again is
--     still told it is a duplicate.
--   * Once values have been entered from a lab file, the lab's name, email and date of birth are cleared
--     too: they were only there to help match the file. The PDF stays, as part of the patient's record.
--
-- Server code runs this daily. It asks which files are due, removes them from storage, and only then
-- tells the database they are gone, so a failed removal is tried again the next day.

-- 1. What is recorded ------------------------------------------------------------------------------

alter table public.result_imports add column rejected_at timestamptz;
comment on column public.result_imports.rejected_at is 'When the file was turned away, by a person or after the retention period. Empty for any other file.';
alter table public.documents add column file_removed_at timestamptz;
comment on column public.documents.file_removed_at is 'When the file was removed from storage under the retention rule. The row stays, archived.';

-- Files turned away before this column existed count from the day they arrived.
update public.result_imports set rejected_at = received_at where status = 'rejected' and rejected_at is null;

create or replace function private.reject_lab_file(_import uuid, _reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  imp public.result_imports;
  why text := btrim(coalesce(_reason, ''));
begin
  if not (select private.has_role('pa') or private.has_role('admin')) then
    raise exception 'Only a PA or an admin can turn a file away.' using errcode = '42501';
  end if;
  if char_length(why) not between 3 and 200 then
    raise exception 'Say why, in 3 to 200 characters.' using errcode = '22023';
  end if;
  select * into imp from public.result_imports i where i.id = _import for update;
  if not found or imp.status not in ('needs_match', 'matched') or imp.lab_report_id is not null
     or (imp.status = 'matched' and imp.source_provider is null) then
    raise exception 'That file cannot be turned away.' using errcode = '22023';
  end if;
  update public.result_imports
    set status = 'rejected', rejection_reason = why, rejected_at = now(), handled_by = (select private.my_staff_id())
    where id = imp.id;
  update public.documents set archived_at = now() where id = imp.document_id and archived_at is null;
end;
$$;

-- 2. Which files are due ---------------------------------------------------------------------------

-- Lab files still waiting or turned away, under no patient, older than _days, whose PDF is still in storage.
create function private.stale_lab_files(_days int)
returns table (import_id uuid, storage_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, d.storage_path
  from public.result_imports i
  join public.documents d on d.id = i.document_id
  where i.source_provider is not null
    and i.patient_id is null
    and i.status in ('needs_match', 'rejected')
    and d.file_removed_at is null
    and coalesce(i.rejected_at, i.received_at) < now() - make_interval(days => greatest(_days, 1))
  order by i.received_at
  limit 200;
$$;

-- 3. Recording that they are gone ------------------------------------------------------------------

-- Server code has removed the PDFs of these imports. Marks the documents, turns a file nobody matched
-- into a rejected one, and clears the lab's details. Only files that are still due are touched.
create function private.finish_lab_purge(_import_ids uuid[], _days int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  done int;
begin
  perform set_config('app.system_actor', 'lab-retention', true);
  with due as (
    select s.import_id from private.stale_lab_files(_days) s where s.import_id = any (_import_ids)
  ), gone as (
    update public.documents d set file_removed_at = now(), archived_at = coalesce(d.archived_at, now())
    from public.result_imports i, due
    where i.id = due.import_id and d.id = i.document_id
    returning i.id
  )
  update public.result_imports i
    set status = 'rejected',
        rejected_at = coalesce(i.rejected_at, now()),
        rejection_reason = coalesce(i.rejection_reason, 'Not matched within the retention period'),
        source_name = null, source_email = null, source_date_of_birth = null
    from gone where i.id = gone.id;
  get diagnostics done = row_count;
  perform set_config('app.system_actor', '', true);
  return done;
end;
$$;

-- The lab's name, email and date of birth were for matching. Once values are entered they go.
create function private.clear_entered_lab_details()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  done int;
begin
  perform set_config('app.system_actor', 'lab-retention', true);
  update public.result_imports
    set source_name = null, source_email = null, source_date_of_birth = null
    where source_provider is not null
      and status = 'confirmed'
      and (source_name is not null or source_email is not null or source_date_of_birth is not null);
  get diagnostics done = row_count;
  perform set_config('app.system_actor', '', true);
  return done;
end;
$$;

-- Wrappers and grants ------------------------------------------------------------------------------

create function public.stale_lab_files(_days int)
returns table (import_id uuid, storage_path text)
language sql stable security invoker set search_path = ''
as $$ select * from private.stale_lab_files(_days); $$;
create function public.finish_lab_purge(_import_ids uuid[], _days int)
returns int language sql security invoker set search_path = ''
as $$ select private.finish_lab_purge(_import_ids, _days); $$;
create function public.clear_entered_lab_details()
returns int language sql security invoker set search_path = ''
as $$ select private.clear_entered_lab_details(); $$;

revoke all on function
  private.stale_lab_files(int), private.finish_lab_purge(uuid[], int), private.clear_entered_lab_details(),
  public.stale_lab_files(int), public.finish_lab_purge(uuid[], int), public.clear_entered_lab_details()
from public, anon, authenticated;
grant execute on function
  private.stale_lab_files(int), private.finish_lab_purge(uuid[], int), private.clear_entered_lab_details(),
  public.stale_lab_files(int), public.finish_lab_purge(uuid[], int), public.clear_entered_lab_details()
to service_role;
