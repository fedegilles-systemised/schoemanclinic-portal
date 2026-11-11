-- Two decisions from the clinic, 12 November 2026.
--
--   1. A signed note is final. Nobody corrects it, not even its author: no new version may supersede
--      a signed note. The column stays for history, but nothing can write it.
--   2. Lab files and imports not yet matched to a patient are for PAs and admins only. Once matched,
--      the patient's care team sees them as before.

-- 1. Signed notes are final ----------------------------------------------------------------------

create or replace function private.clinical_note_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.appointment_id is not null and not exists (
    select 1 from public.appointments a where a.id = new.appointment_id and a.patient_id = new.patient_id
  ) then
    raise exception 'That appointment belongs to another patient.' using errcode = '22023';
  end if;
  if new.supersedes_id is not null then
    raise exception 'A signed note is final and cannot be corrected.' using errcode = '42501';
  end if;
  new.version := 1;
  return new;
end;
$$;
comment on function private.clinical_note_version() is 'Trigger: checks the appointment belongs to the patient, and refuses any correction of a signed note.';

revoke insert on public.clinical_notes from authenticated, service_role;
grant insert (patient_id, author_id, appointment_id, title, body) on public.clinical_notes to authenticated;
grant insert (patient_id, author_id, appointment_id, title, body, source) on public.clinical_notes to service_role;
comment on table public.clinical_notes is 'Consultation and coaching notes. Final once signed: nobody edits or corrects a signed note.';

-- 2. Unmatched files: PAs and admins only --------------------------------------------------------

alter policy "Patients and guardians read shared documents and staff in scope" on public.documents
  using (
    ((archived_at is null) and shared_with_patient and (patient_id in (select private.my_patient_ids())) and private.document_gate_open(id, kind))
    or private.in_scope(patient_id)
    or (patient_id is null and ((select private.has_role('pa')) or (select private.has_role('admin'))))
  );
alter policy "Patients and guardians upload their own and doctors and PAs add" on public.documents
  with check (
    (uploaded_by = (select auth.uid()))
    and (
      ((kind = 'patient_upload') and (source = 'patient_upload') and shared_with_patient and private.can_act_for(patient_id) and private.storage_object_is_mine(storage_path))
      or (patient_id is not null and ((select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('pa'))) and private.in_scope(patient_id))
      or (patient_id is null and ((select private.has_role('pa')) or (select private.has_role('admin'))))
    )
  );
alter policy "Doctors and PAs change documents" on public.documents
  using (
    (patient_id is not null and ((select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('pa'))) and private.in_scope(patient_id))
    or (patient_id is null and ((select private.has_role('pa')) or (select private.has_role('admin'))))
  )
  with check (
    (patient_id is not null and ((select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('pa'))) and private.in_scope(patient_id))
    or (patient_id is null and ((select private.has_role('pa')) or (select private.has_role('admin'))))
  );

alter policy "PAs and doctors read result imports" on public.result_imports
  using (
    (patient_id is not null and ((select private.has_role('pa')) or (select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('admin'))) and private.in_scope(patient_id))
    or (patient_id is null and ((select private.has_role('pa')) or (select private.has_role('admin'))))
  );
alter policy "PAs and doctors match and reject result imports" on public.result_imports
  using (
    (
      (patient_id is not null and ((select private.has_role('pa')) or (select private.has_role('doctor')) or (select private.has_role('nurse'))) and private.in_scope(patient_id))
      or (patient_id is null and ((select private.has_role('pa')) or (select private.has_role('admin'))))
    )
    and status <> 'confirmed'
  )
  with check (
    (
      (patient_id is not null and ((select private.has_role('pa')) or (select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('admin'))) and private.in_scope(patient_id))
      or (patient_id is null and ((select private.has_role('pa')) or (select private.has_role('admin'))))
    )
    and status in ('needs_match', 'matched', 'rejected')
    and (handled_by is null or handled_by = (select private.my_staff_id()))
    and (
      patient_id is null
      or exists (
        select 1 from public.documents d
        where d.id = document_id and (d.patient_id is null or d.patient_id = result_imports.patient_id)
      )
    )
  );
-- Items follow their import: whoever can read the import reads its items.
alter policy "PAs and doctors read import items" on public.import_items
  using (import_id in (select i.id from public.result_imports i));
alter policy "PAs and doctors decide import items" on public.import_items
  using (
    ((select private.has_role('pa')) or (select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('admin')))
    and import_id in (select i.id from public.result_imports i)
  )
  with check (
    ((select private.has_role('pa')) or (select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('admin')))
    and import_id in (select i.id from public.result_imports i)
    and decided_by = (select private.my_staff_id())
  );

-- Files sent in without a patient sit under unmatched/ in Storage: PAs and admins only.
alter policy "People upload document files for patients they can act for" on storage.objects
  with check (
    bucket_id = 'documents'
    and (
      private.can_act_for(private.try_uuid(split_part(name, '/', 1)))
      or (
        split_part(name, '/', 1) = 'unmatched'
        and ((select private.has_role('pa')) or (select private.has_role('admin')))
      )
      or (
        ((select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('pa')))
        and private.in_scope(private.try_uuid(split_part(name, '/', 1)))
      )
    )
  );
