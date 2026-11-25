-- Winds the demo down. Run by hand in the Supabase SQL editor the day the walk-through ends.
-- Nothing is deleted. The demo accounts are locked at the sign-in service (banned, password
-- replaced, every session ended) and suspended in Clinic Hub. Demo patients, medications and
-- staff profiles are archived, open demo records are closed, and bookings still to come are
-- cancelled. Every row, and the audit log, stays.
-- The accounts are closed for good: a second demo needs new addresses and ids.

do $unload$
declare
  v_users uuid[];
  v_patients uuid[];
begin
  select coalesce(array_agg(id), '{}') into v_users from auth.users where email like 'demo.%@example.test';
  select coalesce(array_agg(id), '{}') into v_patients from public.patient_profiles where clinic_ref like 'DEMO-%';

  -- Lock the sign-in itself, not only the Clinic Hub status.
  update auth.users
    set banned_until = 'infinity',
        encrypted_password = extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf'))
    where id = any (v_users);
  delete from auth.refresh_tokens where user_id::text = any (select unnest(v_users)::text);
  delete from auth.sessions where user_id = any (v_users);

  update public.profiles set status = 'suspended' where id = any (v_users);
  update public.staff_profiles set active = false, archived_at = coalesce(archived_at, now())
    where user_id = any (v_users);

  -- Close what is still open, so it reaches no real queue.
  update public.questions set status = 'closed' where patient_id = any (v_patients) and status = 'awaiting_reply';
  update public.lab_reports set status = 'released', reviewed_by = coalesce(reviewed_by, (select id from public.staff_profiles where user_id = any (v_users) and clinical_role = 'doctor' limit 1)),
    reviewed_at = coalesce(reviewed_at, now()), released_at = coalesce(released_at, now())
    where patient_id = any (v_patients) and status <> 'released';
  update public.lab_orders set status = 'cancelled' where order_ref like 'LO-DEMO-%' and status in ('sent_to_patient', 'paid');
  update public.lab_orders set status = 'reviewed' where order_ref like 'LO-DEMO-%' and status in ('sample_taken', 'results_in');
  update public.appointments set status = 'cancelled' where external_id like 'demo\_appt\_%' and starts_at > now();
  update public.patient_guardians set can_view = false, can_act = false where patient_id = any (v_patients);
  update public.lab_panels set archived_at = coalesce(archived_at, now()), active = false where code = 'DEMO-PANEL';
  update public.medications set archived_at = coalesce(archived_at, now()) where patient_id = any (v_patients);
  update public.patient_profiles set archived_at = coalesce(archived_at, now()) where id = any (v_patients);

  raise notice 'Demo wound down: % accounts locked, % patients archived.', coalesce(array_length(v_users, 1), 0), coalesce(array_length(v_patients, 1), 0);
end
$unload$;
