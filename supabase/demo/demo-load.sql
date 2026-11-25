-- Demo accounts and activity for a walk-through of Clinic Hub, inside the same project.
-- NOT a migration and NOT part of the seed: it is run by hand, once, in the Supabase SQL editor.
-- Fictional data only. Every demo account uses an @example.test address, which receives no mail.
--
-- Before you run it:
--   1. Change v_password below. Use a long random password and share it only with the person
--      doing the walk-through. The script refuses to run while it is still CHANGE-ME.
--   2. It refuses to run if real patients already exist, with no way round it: a demo account
--      must never share a project with real patients. Run the unload before the clinic starts
--      to enter real ones.
--   3. It needs one lab partner. It uses the first location and the first active panel and never
--      changes them; if there is none it adds "Demo (video)" and DEMO-PANEL, which the unload
--      archives (a location cannot be archived and stays). Results are added only for markers
--      that already exist.
--
-- Wind it down with demo-unload.sql. Nothing here is ever deleted: accounts are suspended and
-- records archived, as everywhere else.
--
--   Doctor   demo.doctor@example.test      Coach   demo.coach@example.test
--   Nurse    demo.nurse@example.test
--   Patient  demo.eleanor@example.test (trend of released results, repeat request, questions)
--            demo.thomas@example.test (results waiting for the doctor)
--            demo.amira@example.test (ordered bloods, not yet paid)
--   Guardian demo.mark@example.test (acts for Isla, a child)
-- There is no demo admin and no demo PA: both see every patient in the project. Use your own
-- sign-in for those views.

do $demo$
declare
  v_password constant text := 'CHANGE-ME';

  v_loc uuid; v_partner uuid; v_panel uuid;
  v_doc uuid := 'be000000-0000-4000-8000-000000000001';
  v_coach uuid := 'be000000-0000-4000-8000-000000000003';
  v_nurse uuid := 'be000000-0000-4000-8000-000000000004';
  v_u_doc uuid := 'ae000000-0000-4000-8000-000000000001';
  v_u_coach uuid := 'ae000000-0000-4000-8000-000000000003';
  v_u_nurse uuid := 'ae000000-0000-4000-8000-000000000004';
  v_u_ele uuid := 'ae000000-0000-4000-8000-000000000011';
  v_u_tom uuid := 'ae000000-0000-4000-8000-000000000012';
  v_u_ami uuid := 'ae000000-0000-4000-8000-000000000013';
  v_u_mark uuid := 'ae000000-0000-4000-8000-000000000021';
  p_ele uuid := 'de000000-0000-4000-8000-000000000001';
  p_tom uuid := 'de000000-0000-4000-8000-000000000002';
  p_ami uuid := 'de000000-0000-4000-8000-000000000003';
  p_isla uuid := 'de000000-0000-4000-8000-000000000004';
  m_rx uuid := 'ee000000-0000-4000-8000-000000000001';
  r1 uuid := 'fe000000-0000-4000-8000-000000000001';
  r2 uuid := 'fe000000-0000-4000-8000-000000000002';
  r3 uuid := 'fe000000-0000-4000-8000-000000000003';
  r4 uuid := 'fe000000-0000-4000-8000-000000000004';
  o_ami uuid := 'ce000000-0000-4000-8000-000000000001';
  o_tom uuid := 'ce000000-0000-4000-8000-000000000002';
  o_ele uuid := 'ce000000-0000-4000-8000-000000000003';
  u record;
begin
  if v_password = 'CHANGE-ME' or length(v_password) < 16 then
    raise exception 'Set v_password first: at least 16 characters, random, used for this demo only.';
  end if;
  if exists (select 1 from auth.users where id = v_u_doc) then
    raise exception 'The demo accounts already exist. Run demo-unload.sql first.';
  end if;
  if exists (select 1 from public.patient_profiles where clinic_ref not like 'DEMO-%') then
    raise exception 'Real patients exist. Do not run the demo in this project.';
  end if;

  select id into v_loc from public.locations order by created_at limit 1;
  -- A panel for everyone, if the clinic has one; otherwise the first active panel.
  select id, lab_partner_id into v_panel, v_partner from public.lab_panels
    where archived_at is null and active order by (sex_restriction is null) desc, code limit 1;
  -- Fill only what is missing, so the demo can run on a project whose catalogue is still empty.
  -- The panel is archived by the unload. A location cannot be archived and stays: it is named Demo.
  if v_loc is null then
    insert into public.locations (name, kind) values ('Demo (video)', 'video') returning id into v_loc;
  end if;
  if v_partner is null then
    select id into v_partner from public.lab_partners order by created_at limit 1;
  end if;
  if v_partner is null then
    raise exception 'Needs at least one lab partner. Add the real one first.';
  end if;
  if v_panel is null then
    insert into public.lab_panels (lab_partner_id, code, name, price_pence, fasting_required)
      values (v_partner, 'DEMO-PANEL', 'Demo hormone panel', 19500, false) returning id into v_panel;
  end if;

  -- Accounts ------------------------------------------------------------------------------
  for u in
    select * from (values
      (v_u_doc, 'demo.doctor@example.test', 'Dr Demo Doctor'),
      (v_u_coach, 'demo.coach@example.test', 'Demo Coach'),
      (v_u_nurse, 'demo.nurse@example.test', 'Demo Nurse'),
      (v_u_ele, 'demo.eleanor@example.test', 'Eleanor Demo'),
      (v_u_tom, 'demo.thomas@example.test', 'Thomas Demo'),
      (v_u_ami, 'demo.amira@example.test', 'Amira Demo'),
      (v_u_mark, 'demo.mark@example.test', 'Mark Demo')
    ) as t(id, email, full_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name), now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now());
    update public.profiles set status = 'active' where id = u.id;
  end loop;

  insert into public.user_roles (user_id, role) values
    (v_u_doc, 'doctor'), (v_u_coach, 'health_coach'), (v_u_nurse, 'nurse'),
    (v_u_ele, 'patient'), (v_u_tom, 'patient'), (v_u_ami, 'patient');

  insert into public.staff_profiles (id, user_id, job_title, clinical_role) values
    (v_doc, v_u_doc, 'Doctor (demo)', 'doctor'),
    (v_coach, v_u_coach, 'Health Coach (demo)', 'health_coach'),
    (v_nurse, v_u_nurse, 'Nurse (demo)', 'nurse');
  insert into public.staff_locations (staff_id, location_id, is_primary)
    select s, v_loc, true from unnest(array[v_doc, v_coach, v_nurse]) s;

  -- Patients ------------------------------------------------------------------------------
  insert into public.patient_profiles (id, user_id, clinic_ref, first_name, last_name, date_of_birth, sex, contact_email, country, primary_clinician_id, address_line1, city, postcode) values
    (p_ele, v_u_ele, 'DEMO-001', 'Eleanor', 'Demo', '1974-03-14', 'F', 'demo.eleanor@example.test', 'United Kingdom', v_doc, '1 Example Mews', 'London', 'W1G 0AA'),
    (p_tom, v_u_tom, 'DEMO-002', 'Thomas', 'Demo', '1980-02-02', 'M', 'demo.thomas@example.test', 'United Kingdom', v_doc, '1 Example Mews', 'London', 'W1G 0AA'),
    (p_ami, v_u_ami, 'DEMO-003', 'Amira', 'Demo', '1987-09-30', 'F', 'demo.amira@example.test', 'United Kingdom', v_doc, '1 Example Mews', 'London', 'W1G 0AA'),
    (p_isla, null, 'DEMO-004', 'Isla', 'Demo', '2011-06-21', 'F', null, 'United Kingdom', v_doc, '1 Example Mews', 'London', 'W1G 0AA');

  -- Present only once the registration migration is applied: demo patients do not fill the form.
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'patient_profiles' and column_name = 'registration_required') then
    execute 'update public.patient_profiles set registration_required = false where clinic_ref like ''DEMO-%''';
  end if;

  insert into public.patient_guardians (patient_id, guardian_user_id, relationship, can_view, can_act, verified_by)
    values (p_isla, v_u_mark, 'parent', true, true, v_doc);

  insert into public.care_team (patient_id, staff_id, relationship, since)
    select p, v_doc, 'primary_doctor', current_date - 240 from unnest(array[p_ele, p_tom, p_ami, p_isla]) p;
  insert into public.care_team (patient_id, staff_id, relationship, since) values
    (p_ele, v_coach, 'health_coach', current_date - 120);

  insert into public.patient_allergies (patient_id, substance, reaction, severity, recorded_by)
    values (p_ele, 'Penicillin', 'Rash', 'moderate', v_doc);
  insert into public.diagnoses (patient_id, icd10_code, label, status, diagnosed_on, recorded_by) values
    (p_ele, 'N95.1', 'Perimenopause', 'treating', current_date - 228, v_doc),
    (p_ele, 'E55.9', 'Vitamin D deficiency', 'treating', current_date - 228, v_doc),
    (p_ami, 'E03.9', 'Hypothyroidism', 'treating', current_date - 300, v_doc);

  insert into public.medications (id, patient_id, name, dose, instructions, kind, prescriber_id, pharmacy, start_date, supply_days) values
    (m_rx, p_ele, 'Oestrogel 0.06% gel', '2 pumps', '2 pumps daily, applied to the arms', 'prescription', v_doc, 'Demo Pharmacy', current_date - 20, 28),
    ('ee000000-0000-4000-8000-000000000002', p_ele, 'Vitamin D3 4,000 IU', '4,000 IU', '1 capsule daily with food', 'supplement', v_doc, 'Clinic dispensary', current_date - 19, 60);

  insert into public.questions (patient_id, asked_by, subject, body, urgency, status, answered_at) values
    (p_ele, v_u_ele, 'Taking Vitamin D with HRT', 'Can I take my Vitamin D at the same time as my HRT?', 'routine', 'answered', now() - interval '26 days'),
    (p_ele, v_u_ele, 'Question about my last results', 'Is a ferritin of 31 something to worry about?', 'routine', 'awaiting_reply', null);

  -- Appointments: today's diary and the next few weeks ---------------------------------------
  insert into public.appointments (patient_id, clinician_id, location_id, starts_at, duration_min, type, status, source, external_id, synced_at) values
    (p_tom, v_doc, v_loc, ((current_date) + time '09:00')::timestamp at time zone 'Europe/London', 30, 'Follow-up', 'confirmed', 'ghl', 'demo_appt_1', now()),
    (p_ami, v_doc, v_loc, ((current_date) + time '09:45')::timestamp at time zone 'Europe/London', 30, 'Results review', 'confirmed', 'ghl', 'demo_appt_2', now()),
    (p_ele, v_doc, v_loc, ((current_date + 20) + time '10:30')::timestamp at time zone 'Europe/London', 30, 'Follow-up consultation', 'confirmed', 'ghl', 'demo_appt_3', now()),
    (p_isla, v_doc, v_loc, ((current_date + 30) + time '15:30')::timestamp at time zone 'Europe/London', 30, 'Follow-up', 'booked', 'ghl', 'demo_appt_4', now());

  -- Blood orders ----------------------------------------------------------------------------
  insert into public.lab_orders (id, order_ref, patient_id, panel_id, lab_partner_id, ordered_by, due_by, price_pence, status, barcode, paid_at, sample_taken_at, created_at)
    select o_ami, 'LO-DEMO-001', p_ami, v_panel, v_partner, v_doc, current_date + 6, price_pence, 'sent_to_patient', null, null, null, now() - interval '2 days' from public.lab_panels where id = v_panel;
  insert into public.lab_orders (id, order_ref, patient_id, panel_id, lab_partner_id, ordered_by, due_by, price_pence, status, barcode, paid_at, sample_taken_at, created_at)
    select o_tom, 'LO-DEMO-002', p_tom, v_panel, v_partner, v_doc, current_date - 14, price_pence, 'results_in', 'DEMO-1000002', now() - interval '12 days', now() - interval '8 days', now() - interval '14 days' from public.lab_panels where id = v_panel;
  insert into public.lab_orders (id, order_ref, patient_id, panel_id, lab_partner_id, ordered_by, due_by, price_pence, status, barcode, paid_at, sample_taken_at, created_at)
    select o_ele, 'LO-DEMO-003', p_ele, v_panel, v_partner, v_doc, current_date - 22, price_pence, 'reviewed', 'DEMO-1000003', now() - interval '25 days', now() - interval '18 days', now() - interval '28 days' from public.lab_panels where id = v_panel;

  -- Reports: three released for Eleanor's trend, one waiting for Thomas ---------------------
  insert into public.lab_reports (id, patient_id, lab_order_id, lab_partner_id, sample_date, received_at, status, reviewed_by, reviewed_at, released_at) values
    (r1, p_ele, null, v_partner, current_date - 229, now() - interval '227 days', 'released', v_doc, now() - interval '225 days', now() - interval '225 days'),
    (r2, p_ele, null, v_partner, current_date - 135, now() - interval '133 days', 'released', v_doc, now() - interval '131 days', now() - interval '131 days'),
    (r3, p_ele, o_ele, v_partner, current_date - 15, now() - interval '13 days', 'released', v_doc, now() - interval '8 days', now() - interval '8 days');
  insert into public.lab_reports (id, patient_id, lab_order_id, lab_partner_id, sample_date, received_at, status)
    values (r4, p_tom, o_tom, v_partner, current_date - 6, now() - interval '3 days', 'awaiting_review');

  insert into public.results (lab_report_id, patient_id, marker_id, value_numeric, unit, ref_low, ref_high, flag)
    select v.r, v.p, m.id, v.val, m.unit, m.ref_low, m.ref_high, v.flag::public.result_flag
    from (values
      (r1, p_ele, 'HBA1C', 46::numeric, 'high'), (r1, p_ele, 'VITD', 38, 'low'), (r1, p_ele, 'FERRITIN', 24, 'low'),
      (r1, p_ele, 'TSH', 2.3, 'normal'), (r1, p_ele, 'FT4', 15.1, 'normal'), (r1, p_ele, 'CRP', 1.8, 'normal'),
      (r2, p_ele, 'HBA1C', 44, 'high'), (r2, p_ele, 'VITD', 56, 'low'), (r2, p_ele, 'FERRITIN', 31, 'normal'),
      (r2, p_ele, 'TSH', 2.1, 'normal'), (r2, p_ele, 'FT4', 15.6, 'normal'), (r2, p_ele, 'CRP', 1.4, 'normal'),
      (r3, p_ele, 'HBA1C', 41, 'high'), (r3, p_ele, 'VITD', 88, 'normal'), (r3, p_ele, 'FERRITIN', 52, 'normal'),
      (r3, p_ele, 'TSH', 1.9, 'normal'), (r3, p_ele, 'FT4', 15.9, 'normal'), (r3, p_ele, 'CRP', 1.1, 'normal'),
      (r4, p_tom, 'TSH', 2.8, 'normal'), (r4, p_tom, 'FT4', 14.2, 'normal'), (r4, p_tom, 'HBA1C', 38, 'normal')
    ) as v(r, p, code, val, flag)
    join public.markers m on m.code = v.code;

  raise notice 'Demo data loaded. Sign in with the demo.*@example.test accounts and the password you set.';
end
$demo$;
