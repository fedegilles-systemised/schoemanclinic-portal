-- GoHighLevel sends the clinic's patient messages (knowledge base questions 17 and 25). The first time
-- Clinic Hub messages a patient through it, it finds or creates their GoHighLevel contact and keeps
-- the id on the patient record. Only the server writes it, as the named background job 'ghl-sync',
-- so the audit log says what changed it.

create function private.set_patient_ghl_contact(_patient uuid, _contact text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if _contact is null or char_length(_contact) not between 1 and 100 then
    raise exception 'A GoHighLevel contact id is needed.' using errcode = '22023';
  end if;
  perform set_config('app.system_actor', 'ghl-sync', true);
  update public.patient_profiles set ghl_contact_id = _contact where id = _patient and ghl_contact_id is distinct from _contact;
end;
$$;
comment on function private.set_patient_ghl_contact(uuid, text) is 'Service role only: records a patient''s GoHighLevel contact id, logged as the ghl-sync job.';

create function public.set_patient_ghl_contact(_patient uuid, _contact text)
returns void language sql security invoker set search_path = ''
as $$ select private.set_patient_ghl_contact(_patient, _contact); $$;

revoke all on function private.set_patient_ghl_contact(uuid, text), public.set_patient_ghl_contact(uuid, text) from public, anon, authenticated;
grant execute on function private.set_patient_ghl_contact(uuid, text), public.set_patient_ghl_contact(uuid, text) to service_role;
