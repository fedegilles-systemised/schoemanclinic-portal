-- Row-level security policies. One policy per command, never FOR ALL, named in plain English.
-- Each policy covers every role that may run that command, so a table has one permissive
-- policy per command. Grants, including column grants, are in the grants hardening migration.

-- Identity and accounts ------------------------------------------------------

create policy "People read their own profile and the team reads all" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_team()));

create policy "People update their own profile and admins update any" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select private.has_role('admin')))
  with check (id = (select auth.uid()) or (select private.has_role('admin')));

-- Status is admin only; everything else is the person's own.
create function private.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if new.id is distinct from old.id or new.email is distinct from old.email then
      raise exception 'Profile id and email cannot be changed from the client.' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and not private.has_role('admin') then
      raise exception 'Only an admin can change an account status.' using errcode = '42501';
    end if;
    if old.id <> (select auth.uid())
      and (new.full_name, new.phone, new.avatar_path, new.locale, new.last_seen_at)
        is distinct from (old.full_name, old.phone, old.avatar_path, old.locale, old.last_seen_at) then
      raise exception 'Admins can change the status of another account, not its details.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
comment on function private.protect_profile_columns() is 'Trigger: status changes by admins only, and a person''s details by that person only.';
create trigger profiles_protect_columns before update on public.profiles
  for each row execute function private.protect_profile_columns();

create policy "People read their own roles and admins read all" on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('admin')));
-- No write policies: roles are granted by server code. Nobody can change their own role.

create policy "PAs and admins read invitations" on public.invitations
  for select to authenticated
  using ((select private.has_role('pa')) or (select private.has_role('admin')));

-- No write policies: server code creates invitations, generating the token and its expiry.

create policy "People read their own notification preferences" on public.notification_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "People add their own notification preferences" on public.notification_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "People change their own notification preferences" on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "People read their own notifications" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "People mark their own notifications as read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Team and sites -------------------------------------------------------------

create policy "Anyone signed in reads locations" on public.locations
  for select to authenticated using (true);
create policy "Admins add locations" on public.locations
  for insert to authenticated with check ((select private.has_role('admin')));
create policy "Admins change locations" on public.locations
  for update to authenticated
  using ((select private.has_role('admin')))
  with check ((select private.has_role('admin')));

create policy "The team reads staff profiles and staff read their own" on public.staff_profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_team()));
create policy "Admins add staff profiles" on public.staff_profiles
  for insert to authenticated with check ((select private.has_role('admin')));
create policy "Admins change staff profiles and staff change their own signature" on public.staff_profiles
  for update to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('admin')))
  with check (user_id = (select auth.uid()) or (select private.has_role('admin')));

-- Staff may change their own signature and nothing else on their own row.
create function private.protect_staff_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Nested, because the service role cannot execute has_role and Postgres checks that up front.
  if current_user = 'authenticated' then
    if not private.has_role('admin')
      and (new.job_title, new.clinical_role, new.gmc_number, new.active, new.archived_at)
        is distinct from (old.job_title, old.clinical_role, old.gmc_number, old.active, old.archived_at) then
      raise exception 'Only an admin can change these staff details.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
comment on function private.protect_staff_columns() is 'Trigger: a staff member can change their own signature only.';
create trigger staff_profiles_protect_columns before update on public.staff_profiles
  for each row execute function private.protect_staff_columns();

create policy "The team reads staff locations" on public.staff_locations
  for select to authenticated using ((select private.is_team()));
create policy "Admins add staff locations" on public.staff_locations
  for insert to authenticated with check ((select private.has_role('admin')));
create policy "Admins change staff locations" on public.staff_locations
  for update to authenticated
  using ((select private.has_role('admin')))
  with check ((select private.has_role('admin')));
create policy "Admins remove staff locations" on public.staff_locations
  for delete to authenticated using ((select private.has_role('admin')));

create policy "The team reads the care team" on public.care_team
  for select to authenticated using ((select private.is_team()));
create policy "PAs and doctors add to the care team" on public.care_team
  for insert to authenticated
  with check ((select private.has_role('pa')) or (select private.has_role('doctor')));
create policy "PAs and doctors change the care team" on public.care_team
  for update to authenticated
  using ((select private.has_role('pa')) or (select private.has_role('doctor')))
  with check ((select private.has_role('pa')) or (select private.has_role('doctor')));

-- Patient record -------------------------------------------------------------

-- Patients and guardians have no row here: they use get_my_patient_record().
create policy "Clinical staff in scope read patient profiles" on public.patient_profiles
  for select to authenticated using (private.in_scope(id));
create policy "PAs add patient profiles" on public.patient_profiles
  for insert to authenticated with check ((select private.has_role('pa')));
create policy "PAs change patient profiles" on public.patient_profiles
  for update to authenticated
  using ((select private.has_role('pa')))
  with check ((select private.has_role('pa')));

create policy "Patients, guardians of their own link and staff in scope read guardian links" on public.patient_guardians
  for select to authenticated
  using (
    guardian_user_id = (select auth.uid())
    or private.is_own_patient(patient_id)
    or private.in_scope(patient_id)
  );
-- A PA can only verify in their own name, and can never link themselves.
create policy "PAs add guardian links" on public.patient_guardians
  for insert to authenticated
  with check (
    (select private.has_role('pa'))
    and guardian_user_id <> (select auth.uid())
    and (verified_by is null or verified_by = (select private.my_staff_id()))
  );
create policy "PAs change guardian links" on public.patient_guardians
  for update to authenticated
  using ((select private.has_role('pa')) and guardian_user_id <> (select auth.uid()))
  with check (
    (select private.has_role('pa'))
    and guardian_user_id <> (select auth.uid())
    and (verified_by is null or verified_by = (select private.my_staff_id()))
  );

create policy "Patients, guardians and staff in scope read allergies" on public.patient_allergies
  for select to authenticated
  using (patient_id in (select private.my_patient_ids()) or private.in_scope(patient_id));
create policy "Doctors and PAs add allergies" on public.patient_allergies
  for insert to authenticated
  with check (
    ((select private.has_role('doctor')) or (select private.has_role('pa')))
    and private.in_scope(patient_id)
    and recorded_by = (select private.my_staff_id())
  );
create policy "Doctors and PAs change allergies" on public.patient_allergies
  for update to authenticated
  using (((select private.has_role('doctor')) or (select private.has_role('pa'))) and private.in_scope(patient_id))
  with check (((select private.has_role('doctor')) or (select private.has_role('pa'))) and private.in_scope(patient_id));

create policy "Patients, guardians and staff in scope read consents" on public.consents
  for select to authenticated
  using (patient_id in (select private.my_patient_ids()) or private.in_scope(patient_id));
create policy "Patients and guardians who can act add consents" on public.consents
  for insert to authenticated with check (private.can_act_for(patient_id));

create policy "Patients, guardians and staff in scope read diagnoses" on public.diagnoses
  for select to authenticated
  using (
    (archived_at is null and patient_id in (select private.my_patient_ids()))
    or private.in_scope(patient_id)
  );
create policy "Doctors add diagnoses" on public.diagnoses
  for insert to authenticated
  with check (
    (select private.has_role('doctor'))
    and private.in_scope(patient_id)
    and recorded_by = (select private.my_staff_id())
  );
create policy "Doctors change diagnoses" on public.diagnoses
  for update to authenticated
  using ((select private.has_role('doctor')) and private.in_scope(patient_id))
  with check ((select private.has_role('doctor')) and private.in_scope(patient_id));

create policy "Doctors read safeguarding alerts" on public.safeguarding_alerts
  for select to authenticated using ((select private.has_role('doctor')));
create policy "Doctors add safeguarding alerts" on public.safeguarding_alerts
  for insert to authenticated
  with check ((select private.has_role('doctor')) and added_by = (select private.my_staff_id()));
create policy "Doctors change safeguarding alerts" on public.safeguarding_alerts
  for update to authenticated
  using ((select private.has_role('doctor')))
  with check ((select private.has_role('doctor')));

create policy "Patients, guardians and staff in scope read medications" on public.medications
  for select to authenticated
  using (
    (archived_at is null and patient_id in (select private.my_patient_ids()))
    or private.in_scope(patient_id)
  );
create policy "Doctors add medications" on public.medications
  for insert to authenticated
  with check (
    (select private.has_role('doctor'))
    and private.in_scope(patient_id)
    and (prescriber_id is null or prescriber_id = (select private.my_staff_id()))
  );
create policy "Doctors change medications" on public.medications
  for update to authenticated
  using ((select private.has_role('doctor')) and private.in_scope(patient_id))
  with check ((select private.has_role('doctor')) and private.in_scope(patient_id));

-- Care and requests ----------------------------------------------------------

create policy "Patients, guardians and staff in scope read repeat requests" on public.repeat_requests
  for select to authenticated
  using (patient_id in (select private.my_patient_ids()) or private.in_scope(patient_id));
create policy "Patients and guardians who can act, and PAs, add repeat requests" on public.repeat_requests
  for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and (private.can_act_for(patient_id) or (select private.has_role('pa')))
  );
create policy "PAs and doctors change repeat request status" on public.repeat_requests
  for update to authenticated
  using (((select private.has_role('pa')) or (select private.has_role('doctor'))) and private.in_scope(patient_id))
  with check (((select private.has_role('pa')) or (select private.has_role('doctor'))) and private.in_scope(patient_id));

create policy "Patients, guardians and staff in scope read appointments" on public.appointments
  for select to authenticated
  using (patient_id in (select private.my_patient_ids()) or private.in_scope(patient_id));
-- No write policies: the sync writes appointments.

-- The health coach gets the same release gate on lab PDFs as on results.
create policy "Patients and guardians read shared documents and staff in scope read theirs" on public.documents
  for select to authenticated
  using (
    (
      archived_at is null
      and shared_with_patient
      and patient_id in (select private.my_patient_ids())
      and private.document_gate_open(id, kind)
    )
    or (
      ((select private.has_role('doctor')) or (select private.has_role('pa')))
      and (patient_id is null or private.in_scope(patient_id))
    )
    or (
      (select private.has_role('health_coach'))
      and private.in_scope(patient_id)
      and private.document_gate_open(id, kind)
    )
  );
create policy "Patients and guardians upload their own and doctors and PAs add any kind" on public.documents
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and (
      (
        kind = 'patient_upload'
        and source = 'patient_upload'
        and shared_with_patient
        and private.can_act_for(patient_id)
        and not private.storage_object_held_by_other(storage_path)
      )
      or (
        ((select private.has_role('doctor')) or (select private.has_role('pa')))
        and (patient_id is null or private.in_scope(patient_id))
      )
    )
  );
create policy "Doctors and PAs change documents" on public.documents
  for update to authenticated
  using (((select private.has_role('doctor')) or (select private.has_role('pa'))) and (patient_id is null or private.in_scope(patient_id)))
  with check (((select private.has_role('doctor')) or (select private.has_role('pa'))) and (patient_id is null or private.in_scope(patient_id)));

create policy "Patients, guardians and staff in scope read questions" on public.questions
  for select to authenticated
  using (patient_id in (select private.my_patient_ids()) or private.in_scope(patient_id));
create policy "Patients and guardians who can act ask questions" on public.questions
  for insert to authenticated
  with check (asked_by = (select auth.uid()) and private.can_act_for(patient_id));
create policy "The team changes question status" on public.questions
  for update to authenticated
  using ((select private.is_team()) and private.in_scope(patient_id))
  with check ((select private.is_team()) and private.in_scope(patient_id));

-- Labs and results -----------------------------------------------------------

create policy "Patients, guardians and staff in scope read lab orders" on public.lab_orders
  for select to authenticated
  using (patient_id in (select private.my_patient_ids()) or private.in_scope(patient_id));
create policy "Doctors and PAs add lab orders" on public.lab_orders
  for insert to authenticated
  with check (
    ((select private.has_role('doctor')) or (select private.has_role('pa')))
    and private.in_scope(patient_id)
    and ordered_by = (select private.my_staff_id())
  );
create policy "Doctors and PAs change lab orders" on public.lab_orders
  for update to authenticated
  using (((select private.has_role('doctor')) or (select private.has_role('pa'))) and private.in_scope(patient_id))
  with check (((select private.has_role('doctor')) or (select private.has_role('pa'))) and private.in_scope(patient_id));

-- The release gate. Patients, guardians and the health coach see released reports only.
create policy "Patients, guardians and the health coach read released reports and doctors and PAs read all" on public.lab_reports
  for select to authenticated
  using (
    (released_at is not null and patient_id in (select private.my_patient_ids()))
    or (
      ((select private.has_role('doctor')) or (select private.has_role('pa')))
      and private.in_scope(patient_id)
    )
    or (
      released_at is not null
      and (select private.has_role('health_coach'))
      and private.in_scope(patient_id)
    )
  );
-- No write policies: lab feeds, imports and release go through server code.

create policy "PAs and doctors read result imports" on public.result_imports
  for select to authenticated
  using ((select private.has_role('pa')) or (select private.has_role('doctor')));
-- Confirming an import creates results, so it is server code only.
create policy "PAs and doctors match and reject result imports" on public.result_imports
  for update to authenticated
  using (
    ((select private.has_role('pa')) or (select private.has_role('doctor')))
    and status <> 'confirmed'
  )
  with check (
    ((select private.has_role('pa')) or (select private.has_role('doctor')))
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

create policy "Patients, guardians and the health coach read released results and doctors and PAs read all" on public.results
  for select to authenticated
  using (
    (patient_id in (select private.my_patient_ids()) and private.report_is_released(lab_report_id))
    or (
      ((select private.has_role('doctor')) or (select private.has_role('pa')))
      and private.in_scope(patient_id)
    )
    or (
      (select private.has_role('health_coach'))
      and private.in_scope(patient_id)
      and private.report_is_released(lab_report_id)
    )
  );
create policy "Doctors add comments to results" on public.results
  for update to authenticated
  using ((select private.has_role('doctor')) and private.in_scope(patient_id))
  with check ((select private.has_role('doctor')) and private.in_scope(patient_id));

create policy "PAs and doctors read import items" on public.import_items
  for select to authenticated
  using ((select private.has_role('pa')) or (select private.has_role('doctor')));
create policy "PAs and doctors decide import items" on public.import_items
  for update to authenticated
  using ((select private.has_role('pa')) or (select private.has_role('doctor')))
  with check (
    ((select private.has_role('pa')) or (select private.has_role('doctor')))
    and decided_by = (select private.my_staff_id())
  );

create policy "Anyone signed in reads markers" on public.markers
  for select to authenticated using (true);
create policy "Admins add markers" on public.markers
  for insert to authenticated with check ((select private.has_role('admin')));
create policy "Admins change markers" on public.markers
  for update to authenticated
  using ((select private.has_role('admin')))
  with check ((select private.has_role('admin')));

create policy "Anyone signed in reads lab partners" on public.lab_partners
  for select to authenticated using (true);
create policy "Admins add lab partners" on public.lab_partners
  for insert to authenticated with check ((select private.has_role('admin')));
create policy "Admins change lab partners" on public.lab_partners
  for update to authenticated
  using ((select private.has_role('admin')))
  with check ((select private.has_role('admin')));

create policy "Anyone signed in reads lab panels" on public.lab_panels
  for select to authenticated using (true);
create policy "Admins add lab panels" on public.lab_panels
  for insert to authenticated with check ((select private.has_role('admin')));
create policy "Admins change lab panels" on public.lab_panels
  for update to authenticated
  using ((select private.has_role('admin')))
  with check ((select private.has_role('admin')));

create policy "Anyone signed in reads lab panel markers" on public.lab_panel_markers
  for select to authenticated using (true);
create policy "Admins add lab panel markers" on public.lab_panel_markers
  for insert to authenticated with check ((select private.has_role('admin')));
create policy "Admins remove lab panel markers" on public.lab_panel_markers
  for delete to authenticated using ((select private.has_role('admin')));

-- webhook_events, integration_sync_log and audit_log have no policies and no grants to
-- authenticated. Admins read the logs through the server.
