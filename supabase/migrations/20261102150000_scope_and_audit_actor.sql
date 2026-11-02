-- S-10: every write policy that touches a patient's record now asks private.in_scope(), so
-- narrowing the access scope later is a change to that one function. It still returns true
-- for any clinical staff member until the clinic decides (docs/PRD.md, open question 1).
-- S-07: a service-role write must now say who it acts for, or that it is a named system job.

alter policy "PAs and doctors add to the care team" on public.care_team
  with check (
    ((select private.has_role('pa')) or (select private.has_role('doctor')))
    and private.in_scope(patient_id)
  );
alter policy "PAs and doctors change the care team" on public.care_team
  using (
    ((select private.has_role('pa')) or (select private.has_role('doctor')))
    and private.in_scope(patient_id)
  )
  with check (
    ((select private.has_role('pa')) or (select private.has_role('doctor')))
    and private.in_scope(patient_id)
  );

alter policy "PAs add patient profiles" on public.patient_profiles
  with check ((select private.has_role('pa')) and private.in_scope(id));
alter policy "PAs change patient profiles" on public.patient_profiles
  using ((select private.has_role('pa')) and private.in_scope(id))
  with check ((select private.has_role('pa')) and private.in_scope(id));

alter policy "PAs add guardian links" on public.patient_guardians
  with check (
    (select private.has_role('pa'))
    and private.in_scope(patient_id)
    and guardian_user_id <> (select auth.uid())
    and (verified_by is null or verified_by = (select private.my_staff_id()))
  );
alter policy "PAs change guardian links" on public.patient_guardians
  using (
    (select private.has_role('pa'))
    and private.in_scope(patient_id)
    and guardian_user_id <> (select auth.uid())
  )
  with check (
    (select private.has_role('pa'))
    and private.in_scope(patient_id)
    and guardian_user_id <> (select auth.uid())
    and (verified_by is null or verified_by = (select private.my_staff_id()))
  );

alter policy "Doctors read safeguarding alerts" on public.safeguarding_alerts
  using ((select private.has_role('doctor')) and private.in_scope(patient_id));
alter policy "Doctors add safeguarding alerts" on public.safeguarding_alerts
  with check (
    (select private.has_role('doctor'))
    and private.in_scope(patient_id)
    and added_by = (select private.my_staff_id())
  );
alter policy "Doctors change safeguarding alerts" on public.safeguarding_alerts
  using ((select private.has_role('doctor')) and private.in_scope(patient_id))
  with check ((select private.has_role('doctor')) and private.in_scope(patient_id));

alter policy "Patients and guardians who can act, and PAs, add repeat requests" on public.repeat_requests
  with check (
    requested_by = (select auth.uid())
    and (
      private.can_act_for(patient_id)
      or ((select private.has_role('pa')) and private.in_scope(patient_id))
    )
  );

-- An import with no patient yet is for every PA and doctor to match.
alter policy "PAs and doctors read result imports" on public.result_imports
  using (
    ((select private.has_role('pa')) or (select private.has_role('doctor')))
    and (patient_id is null or private.in_scope(patient_id))
  );
alter policy "PAs and doctors match and reject result imports" on public.result_imports
  using (
    ((select private.has_role('pa')) or (select private.has_role('doctor')))
    and (patient_id is null or private.in_scope(patient_id))
    and status <> 'confirmed'
  )
  with check (
    ((select private.has_role('pa')) or (select private.has_role('doctor')))
    and (patient_id is null or private.in_scope(patient_id))
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

-- Items follow their import: the subquery runs under the import policies above.
alter policy "PAs and doctors read import items" on public.import_items
  using (
    ((select private.has_role('pa')) or (select private.has_role('doctor')))
    and import_id in (select i.id from public.result_imports i)
  );
alter policy "PAs and doctors decide import items" on public.import_items
  using (
    ((select private.has_role('pa')) or (select private.has_role('doctor')))
    and import_id in (select i.id from public.result_imports i)
  )
  with check (
    ((select private.has_role('pa')) or (select private.has_role('doctor')))
    and import_id in (select i.id from public.result_imports i)
    and decided_by = (select private.my_staff_id())
  );

comment on function private.in_scope(uuid) is 'Can this staff member open this patient''s record? OPEN QUESTION: true for any clinical staff member until the clinic answers. Every read and write policy on a patient''s record calls it, so narrowing it needs no policy change.';

-- S-07 ---------------------------------------------------------------------------------

create or replace function private.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  actor uuid;
  role_held public.app_role;
  changed text[];
  system_job text := nullif(current_setting('app.system_actor', true), '');
  meta jsonb;
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
  else
    row_data := to_jsonb(new);
  end if;

  -- Server code has no auth.uid(), so it names the person it acts for:
  -- set_config('app.actor_id', <profile id>, true) in the same transaction.
  select p.id into actor
  from public.profiles p
  where p.id = coalesce((select auth.uid()), private.try_uuid(current_setting('app.actor_id', true)));

  -- A service-role write that names nobody is refused, so no change reaches a clinical record
  -- without an owner. Background jobs (a webhook, a lab feed) say so with
  -- set_config('app.system_actor', '<job name>', true). The database owner's own SQL
  -- (migrations, the seed, the dashboard) is not affected.
  if actor is null and system_job is null and current_setting('role', true) = 'service_role' then
    raise exception 'A service-role write to % needs an actor: set app.actor_id, or app.system_actor for a background job.', tg_table_name
      using errcode = '42501';
  end if;

  if actor is not null then
    -- A person can hold more than one role; a staff role says more than patient.
    select r.role into role_held
    from public.user_roles r
    where r.user_id = actor
    order by (r.role = 'patient'), r.role
    limit 1;
  end if;

  -- Column names only: this table can never be erased, so it holds no clinical values.
  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into changed
    from jsonb_each(row_data) n
    where n.value is distinct from (to_jsonb(old) -> n.key);
  end if;

  meta := case when changed is null then null else jsonb_build_object('changed', changed) end;
  if actor is null and system_job is not null then
    meta := coalesce(meta, '{}'::jsonb) || jsonb_build_object('system', system_job);
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, metadata)
  values (
    actor,
    role_held,
    case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    tg_table_name,
    private.try_uuid(coalesce(row_data ->> 'id', row_data ->> 'user_id', row_data ->> 'staff_id', row_data ->> 'panel_id')),
    meta
  );
  return null;
end;
$$;
comment on function private.write_audit_log() is 'Trigger: records who changed which clinical row, and which columns. Refuses a service-role write that names no actor or system job.';
