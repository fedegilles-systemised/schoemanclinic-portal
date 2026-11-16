-- A PA or an admin can turn away a file waiting in the import queue, and take a lab file back from a
-- patient it was matched to by mistake, as long as no values have been entered from it yet.
--
--   1. Why a file was turned away, kept on the import.
--   2. Rejecting a file: it is archived, never deleted.
--   3. Taking a matched lab file back to "needs matching".

-- 1. The reason ------------------------------------------------------------------------------------

alter table public.result_imports add column rejection_reason text;
alter table public.result_imports
  add constraint result_imports_rejection_reason_length check (rejection_reason is null or char_length(rejection_reason) between 3 and 200);
comment on column public.result_imports.rejection_reason is 'Why a PA or admin turned the file away. Empty for any other file.';

-- 2. Rejecting -------------------------------------------------------------------------------------

-- Only a file that no values have been entered from can be rejected, and a matched one only when a lab
-- sent it: a file staff registered is part of a patient's record. The file stays in storage and its
-- document is archived, so nothing is deleted.
create function private.reject_lab_file(_import uuid, _reason text)
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
    set status = 'rejected', rejection_reason = why, handled_by = (select private.my_staff_id())
    where id = imp.id;
  update public.documents set archived_at = now() where id = imp.document_id and archived_at is null;
end;
$$;

-- 3. Taking a matched lab file back -----------------------------------------------------------------

-- For a lab file matched to the wrong patient, before any values are entered. Server code has already
-- moved the file in storage to _new_path, which must start with unmatched/.
create function private.unmatch_lab_file(_import uuid, _new_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  imp public.result_imports;
begin
  if not (select private.has_role('pa') or private.has_role('admin')) then
    raise exception 'Only a PA or an admin can take a file back.' using errcode = '42501';
  end if;
  if _new_path is null or split_part(_new_path, '/', 1) <> 'unmatched' then
    raise exception 'The file is not stored as waiting.' using errcode = '22023';
  end if;
  select * into imp from public.result_imports i where i.id = _import for update;
  if not found or imp.status <> 'matched' or imp.lab_report_id is not null or imp.source_provider is null then
    raise exception 'That file cannot be taken back.' using errcode = '22023';
  end if;
  update public.documents set patient_id = null, storage_path = _new_path where id = imp.document_id;
  update public.result_imports set patient_id = null, status = 'needs_match' where id = imp.id;
end;
$$;

-- Wrappers and grants ------------------------------------------------------------------------------

create function public.reject_lab_file(_import uuid, _reason text)
returns void language sql security invoker set search_path = ''
as $$ select private.reject_lab_file(_import, _reason); $$;
create function public.unmatch_lab_file(_import uuid, _new_path text)
returns void language sql security invoker set search_path = ''
as $$ select private.unmatch_lab_file(_import, _new_path); $$;

revoke all on function
  private.reject_lab_file(uuid, text), private.unmatch_lab_file(uuid, text),
  public.reject_lab_file(uuid, text), public.unmatch_lab_file(uuid, text)
from public, anon, authenticated;
grant execute on function
  private.reject_lab_file(uuid, text), private.unmatch_lab_file(uuid, text),
  public.reject_lab_file(uuid, text), public.unmatch_lab_file(uuid, text)
to authenticated;
