-- Fictional data only, matching the prototype. Never copy real patient data here.
-- Local accounts use obviously fake @example.test emails. Every password: ClinicHub-demo-1
--
--   Doctor        gina.schoeman@example.test
--   Doctor+patient laura.bennett@example.test (holds both roles)
--   PA            priya.shah@example.test, tom.ellis@example.test
--   Health coach  cecile.moreau@example.test
--   Admin         admin@example.test
--   Nurse         nora.price@example.test (no patient access until the clinic decides)
--   Patient       eleanor.hart@example.test, thomas.reed@example.test, amira.haddad@example.test
--   Guardian      mark.hart@example.test (can_act), ruth.marlow@example.test (view only)
--
-- Dates are relative to the day of `pnpm db:reset`, so the dashboards always have a today.
-- Run the reset again if the diary looks empty.

-- Helpers for this file only ---------------------------------------------------

create function pg_temp.at_london(_day integer, _time time)
returns timestamptz language sql stable as $$
  select ((current_date + _day) + _time)::timestamp at time zone 'Europe/London';
$$;

create function pg_temp.seed_user(_id uuid, _email text, _name text)
returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', _id, 'authenticated', 'authenticated', _email,
    extensions.crypt('ClinicHub-demo-1', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', _name), now(), now(),
    '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), _id, _id::text,
    jsonb_build_object('sub', _id::text, 'email', _email, 'email_verified', true),
    'email', now(), now(), now()
  );
  update public.profiles set status = 'active', last_seen_at = now() where id = _id;
end;
$$;

create function pg_temp.seed_result(_report uuid, _patient uuid, _code text, _value numeric, _flag public.result_flag, _comment text default null)
returns void language sql as $$
  insert into public.results (lab_report_id, patient_id, marker_id, value_numeric, unit, ref_low, ref_high, flag, doctor_comment)
  select _report, _patient, m.id, _value, m.unit, m.ref_low, m.ref_high, _flag, _comment
  from public.markers m where m.code = _code;
$$;

-- Accounts -----------------------------------------------------------------------

select pg_temp.seed_user('a0000000-0000-4000-8000-000000000001', 'gina.schoeman@example.test', 'Dr Gina Schoeman');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000002', 'laura.bennett@example.test', 'Dr Laura Bennett');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000003', 'priya.shah@example.test', 'Priya Shah');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000004', 'tom.ellis@example.test', 'Tom Ellis');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000005', 'cecile.moreau@example.test', 'Cecile Moreau');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000006', 'admin@example.test', 'Admin User');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000007', 'nora.price@example.test', 'Nora Price');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000011', 'eleanor.hart@example.test', 'Eleanor Hart');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000012', 'thomas.reed@example.test', 'Thomas Reed');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000013', 'amira.haddad@example.test', 'Amira Haddad');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000021', 'mark.hart@example.test', 'Mark Hart');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000022', 'ruth.marlow@example.test', 'Ruth Marlow');

insert into public.user_roles (user_id, role) values
  ('a0000000-0000-4000-8000-000000000001', 'doctor'),
  ('a0000000-0000-4000-8000-000000000002', 'doctor'),
  ('a0000000-0000-4000-8000-000000000002', 'patient'),
  ('a0000000-0000-4000-8000-000000000003', 'pa'),
  ('a0000000-0000-4000-8000-000000000004', 'pa'),
  ('a0000000-0000-4000-8000-000000000005', 'health_coach'),
  ('a0000000-0000-4000-8000-000000000006', 'admin'),
  ('a0000000-0000-4000-8000-000000000007', 'nurse'),
  ('a0000000-0000-4000-8000-000000000011', 'patient'),
  ('a0000000-0000-4000-8000-000000000012', 'patient'),
  ('a0000000-0000-4000-8000-000000000013', 'patient');
-- Guardians hold no role: they are defined by patient_guardians below.

-- Team and sites -----------------------------------------------------------------

insert into public.locations (id, name, kind, address, ghl_calendar_id) values
  ('c0000000-0000-4000-8000-000000000001', 'Harley Street', 'clinic', '1 Harley Street, London W1G', 'ghl_cal_demo_harley'),
  ('c0000000-0000-4000-8000-000000000002', 'Wimbledon', 'clinic', '1 Wimbledon Hill Road, London SW19', 'ghl_cal_demo_wimbledon'),
  ('c0000000-0000-4000-8000-000000000003', 'Video', 'video', null, 'ghl_cal_demo_video');

insert into public.staff_profiles (id, user_id, job_title, clinical_role, gmc_number, signature_path, ghl_user_id, semble_user_id) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Medical Director', 'doctor', '0000001', 'a0000000-0000-4000-8000-000000000001/signature.png', 'ghl_user_demo_gs', 'semble_user_demo_gs'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'Doctor', 'doctor', '0000002', null, 'ghl_user_demo_lb', 'semble_user_demo_lb'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'Personal Assistant', 'pa', null, null, 'ghl_user_demo_ps', null),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', 'Personal Assistant', 'pa', null, null, 'ghl_user_demo_te', null),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005', 'Health Coach', 'health_coach', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000006', 'Administrator', 'admin', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000007', 'Nurse', 'nurse', null, null, null, null);

insert into public.staff_locations (staff_id, location_id, is_primary) values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', true),
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', false),
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', false),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', true),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', true),
  ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', true),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', true),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000003', false);

-- Patients -----------------------------------------------------------------------

insert into public.patient_profiles (id, user_id, clinic_ref, first_name, last_name, date_of_birth, sex, contact_email, contact_phone, country, primary_clinician_id, ghl_contact_id, semble_patient_id, stripe_customer_id) values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', 'SC-004821', 'Eleanor', 'Hart', '1974-03-14', 'F', 'eleanor.hart@example.test', '07700 900412', 'United Kingdom', 'b0000000-0000-4000-8000-000000000001', 'ghl_contact_demo_eh', 'semble_patient_demo_eh', 'cus_demo_eh'),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000012', 'SC-003117', 'Thomas', 'Reed', '1980-02-02', 'M', 'thomas.reed@example.test', null, 'United Kingdom', 'b0000000-0000-4000-8000-000000000001', 'ghl_contact_demo_tr', null, null),
  ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000013', 'SC-004102', 'Amira', 'Haddad', '1987-09-30', 'F', 'amira.haddad@example.test', null, 'United Kingdom', 'b0000000-0000-4000-8000-000000000001', 'ghl_contact_demo_ah', null, null),
  ('d0000000-0000-4000-8000-000000000004', null, 'SC-005033', 'Claire', 'Benson', '1982-01-07', 'F', 'claire.benson@example.test', null, 'United Kingdom', 'b0000000-0000-4000-8000-000000000001', null, null, null),
  ('d0000000-0000-4000-8000-000000000005', null, 'SC-002688', 'Oliver', 'Grant', '1968-05-19', 'M', 'oliver.grant@example.test', null, 'United Arab Emirates', 'b0000000-0000-4000-8000-000000000001', null, null, null),
  ('d0000000-0000-4000-8000-000000000006', null, 'SC-004455', 'Sophie', 'Marlow', '1976-11-11', 'F', 'sophie.marlow@example.test', null, 'United Kingdom', 'b0000000-0000-4000-8000-000000000001', null, null, null),
  ('d0000000-0000-4000-8000-000000000007', null, 'SC-001902', 'Daniel', 'Okoro', '1965-04-23', 'M', 'daniel.okoro@example.test', null, 'United Kingdom', 'b0000000-0000-4000-8000-000000000001', null, null, null),
  ('d0000000-0000-4000-8000-000000000008', null, 'SC-005210', 'Hannah', 'Price', '1991-08-08', 'F', 'hannah.price@example.test', null, 'United Kingdom', 'b0000000-0000-4000-8000-000000000001', null, null, null),
  ('d0000000-0000-4000-8000-000000000009', null, 'SC-000874', 'Margaret', 'Lyle', '1958-12-03', 'F', 'margaret.lyle@example.test', null, 'United Kingdom', 'b0000000-0000-4000-8000-000000000002', null, null, null),
  ('d0000000-0000-4000-8000-00000000000a', null, 'SC-005301', 'Isla', 'Hart', '2011-06-21', 'F', null, null, 'United Kingdom', 'b0000000-0000-4000-8000-000000000001', null, null, null),
  ('d0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-000000000002', 'SC-006001', 'Laura', 'Bennett', '1979-10-05', 'F', 'laura.bennett@example.test', null, 'United Kingdom', 'b0000000-0000-4000-8000-000000000001', null, null, null);

-- A fictional postal address for every patient, which SignatureRx needs for a prescription.
update public.patient_profiles set address_line1 = '1 Example Mews', city = 'London', postcode = 'W1G 0AA' where address_line1 is null;

insert into public.patient_guardians (patient_id, guardian_user_id, relationship, can_view, can_act, verified_by) values
  ('d0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000021', 'parent', true, true, 'b0000000-0000-4000-8000-000000000003'),
  ('d0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000022', 'carer', true, false, 'b0000000-0000-4000-8000-000000000003');

insert into public.care_team (patient_id, staff_id, relationship, since)
select id, 'b0000000-0000-4000-8000-000000000001', 'primary_doctor', current_date - 240
from public.patient_profiles where id <> 'd0000000-0000-4000-8000-000000000009';
insert into public.care_team (patient_id, staff_id, relationship, since) values
  ('d0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000002', 'primary_doctor', current_date - 240),
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'pa', current_date - 240);

insert into public.patient_allergies (patient_id, substance, reaction, severity, recorded_by) values
  ('d0000000-0000-4000-8000-000000000001', 'Penicillin', 'Rash', 'moderate', 'b0000000-0000-4000-8000-000000000001');

insert into public.consents (patient_id, consent_type, version, granted) values
  ('d0000000-0000-4000-8000-000000000001', 'care', '2026-01', true),
  ('d0000000-0000-4000-8000-000000000001', 'partner_labs', '2026-01', true),
  ('d0000000-0000-4000-8000-000000000001', 'research', '2026-01', false);

insert into public.diagnoses (patient_id, icd10_code, label, status, diagnosed_on, recorded_by) values
  ('d0000000-0000-4000-8000-000000000001', 'N95.1', 'Perimenopause', 'treating', current_date - 228, 'b0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000001', 'E55.9', 'Vitamin D deficiency', 'treating', current_date - 228, 'b0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000001', 'R73.0', 'Raised HbA1c, pre-diabetic range', 'monitoring', current_date - 228, 'b0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000003', 'E03.9', 'Hypothyroidism', 'treating', current_date - 300, 'b0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000007', 'E11.9', 'Type 2 diabetes', 'treating', current_date - 500, 'b0000000-0000-4000-8000-000000000001');

insert into public.safeguarding_alerts (patient_id, alert_type, severity, note, added_by, review_due) values
  ('d0000000-0000-4000-8000-000000000003', 'Clinical warning', 'moderate', 'Anxiety around blood tests. Offer a longer slot and a familiar phlebotomist.', 'b0000000-0000-4000-8000-000000000001', current_date + 73),
  ('d0000000-0000-4000-8000-000000000009', 'Communication', 'low', 'Hearing impairment. Prefers written follow-up and longer appointments.', 'b0000000-0000-4000-8000-000000000002', current_date + 34),
  ('d0000000-0000-4000-8000-000000000002', 'Chaperone', 'low', 'Prefers a chaperone for examinations.', 'b0000000-0000-4000-8000-000000000001', current_date - 15);

insert into public.medications (id, patient_id, name, dose, instructions, kind, prescriber_id, pharmacy, start_date, supply_days, semble_prescription_id) values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Oestrogel 0.06% gel', '2 pumps', '2 pumps daily, applied to the arms', 'prescription', 'b0000000-0000-4000-8000-000000000001', 'Harley Street Pharmacy, London W1G', current_date - 20, 28, 'semble_rx_demo_1'),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'Utrogestan 100 mg', '100 mg', '1 capsule at night', 'prescription', 'b0000000-0000-4000-8000-000000000001', 'Harley Street Pharmacy, London W1G', current_date - 4, 28, 'semble_rx_demo_2'),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'Vitamin D3 4,000 IU', '4,000 IU', '1 capsule daily with food', 'supplement', 'b0000000-0000-4000-8000-000000000001', 'Clinic dispensary', current_date - 19, 60, null);

insert into public.repeat_requests (id, medication_id, patient_id, requested_by, fee_pence, stripe_payment_intent_id, status, requested_at, resolved_at, paid_at, has_future_appointment) values
  ('e1000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', 3000, 'pi_demo_1', 'sent_to_pharmacy', now() - interval '32 days', now() - interval '31 days', now() - interval '32 days', true);
insert into public.repeat_request_items (request_id, patient_id, medication_id, supply_months) values
  ('e1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 1);

insert into public.questions (patient_id, asked_by, subject, body, urgency, status, answered_at) values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', 'Taking Vitamin D with HRT', 'Can I take my Vitamin D at the same time as my HRT?', 'routine', 'answered', now() - interval '26 days');

-- Appointments: today's diary, then the upcoming ones.

insert into public.appointments (id, patient_id, clinician_id, location_id, starts_at, duration_min, type, status, source, external_id, synced_at) values
  ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', pg_temp.at_london(0, '09:00'), 30, 'Follow-up', 'confirmed', 'ghl', 'ghl_appt_demo_1', now()),
  ('f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', pg_temp.at_london(0, '09:45'), 30, 'Results review', 'confirmed', 'ghl', 'ghl_appt_demo_2', now()),
  ('f0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', pg_temp.at_london(0, '10:30'), 60, 'Initial assessment', 'confirmed', 'ghl', 'ghl_appt_demo_3', now()),
  ('f0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', pg_temp.at_london(0, '11:45'), 30, 'Follow-up', 'confirmed', 'ghl', 'ghl_appt_demo_4', now()),
  ('f0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', pg_temp.at_london(0, '14:00'), 30, 'Follow-up', 'confirmed', 'ghl', 'ghl_appt_demo_5', now()),
  ('f0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', pg_temp.at_london(0, '15:00'), 30, 'Results review', 'confirmed', 'ghl', 'ghl_appt_demo_6', now()),
  ('f0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', pg_temp.at_london(0, '16:00'), 30, 'Follow-up', 'confirmed', 'ghl', 'ghl_appt_demo_7', now()),
  ('f0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', pg_temp.at_london(20, '10:30'), 30, 'Follow-up consultation', 'confirmed', 'ghl', 'ghl_appt_demo_11', now()),
  ('f0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', pg_temp.at_london(11, '11:00'), 30, 'Follow-up', 'booked', 'ghl', 'ghl_appt_demo_12', now()),
  ('f0000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', pg_temp.at_london(34, '09:30'), 45, 'Follow-up', 'booked', 'ghl', 'ghl_appt_demo_13', now()),
  ('f0000000-0000-4000-8000-000000000014', 'd0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', pg_temp.at_london(30, '15:30'), 30, 'Follow-up', 'booked', 'ghl', 'ghl_appt_demo_14', now());

-- Labs ---------------------------------------------------------------------------

insert into public.lab_partners (id, name, address, results_channel, api_enabled) values
  ('10000000-0000-4000-8000-000000000001', 'TDL Pathology', '60 Whitfield Street, London W1T', 'api', true),
  ('10000000-0000-4000-8000-000000000002', 'The Doctors Laboratory', '1 Example Way, London W1', 'email', false);

insert into public.lab_panels (id, lab_partner_id, code, name, price_pence, fasting_required, preparation) values
  ('11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'GS5', 'Female Hormone & Metabolic Panel', 29500, true, 'Fast for 10 hours before your sample. Water is fine.'),
  ('11000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'MHP', 'Male Hormone Panel', 21000, false, 'Have your sample taken before 10:00.'),
  ('11000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'PERI', 'Perimenopause panel', 18500, false, null),
  ('11000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'MET', 'Metabolic panel', 16000, true, 'Fast for 10 hours before your sample. Water is fine.'),
  ('11000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'THY', 'Thyroid panel', 14000, false, null),
  ('11000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', 'VIT', 'Vitamin and Iron Panel', 12000, false, null),
  ('11000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', 'LIP', 'Lipid profile', 9500, true, 'Fast for 10 hours before your sample. Water is fine.');

insert into public.markers (code, name, category, unit, ref_low, ref_high, explainer) values
  ('HBA1C', 'HbA1c', 'Metabolic', 'mmol/mol', 20, 41, 'Your average blood sugar over the last two to three months.'),
  ('GLUCOSE', 'Fasting glucose', 'Metabolic', 'mmol/L', 3.9, 5.5, 'The sugar in your blood after an overnight fast.'),
  ('CRP', 'hs-CRP', 'Metabolic', 'mg/L', null, 3.0, 'A sensitive marker of inflammation in the body.'),
  ('ALT', 'ALT', 'Metabolic', 'U/L', 0, 41, 'A liver enzyme.'),
  ('EGFR', 'eGFR', 'Metabolic', 'mL/min', 60, null, 'How well your kidneys filter your blood.'),
  ('VITD', 'Vitamin D', 'Vitamins and minerals', 'nmol/L', 75, 200, 'Supports bones, muscles and immunity. Levels drop in autumn and winter.'),
  ('FERRITIN', 'Ferritin', 'Vitamins and minerals', 'µg/L', 30, 200, 'Shows how much iron your body has in store.'),
  ('B12', 'Vitamin B12', 'Vitamins and minerals', 'ng/L', 180, 900, 'Needed for nerves and red blood cells.'),
  ('FOLATE', 'Folate', 'Vitamins and minerals', 'µg/L', 3.9, null, 'A B vitamin needed to make healthy cells.'),
  ('TSAT', 'Transferrin saturation', 'Vitamins and minerals', '%', 20, 50, 'How much of your iron transport protein is carrying iron.'),
  ('HB', 'Haemoglobin', 'Haematology', 'g/L', 115, 165, 'The protein in red blood cells that carries oxygen.'),
  ('HCT', 'Haematocrit', 'Haematology', 'L/L', 0.40, 0.52, 'The share of your blood made up of red blood cells.'),
  ('TCHOL', 'Total cholesterol', 'Lipids', 'mmol/L', null, 5.0, 'All the cholesterol in your blood, good and less good.'),
  ('HDL', 'HDL cholesterol', 'Lipids', 'mmol/L', 1.2, null, 'The protective type of cholesterol. Higher is better.'),
  ('LDL', 'LDL cholesterol', 'Lipids', 'mmol/L', null, 3.0, 'The type of cholesterol that can build up in arteries.'),
  ('TRIG', 'Triglycerides', 'Lipids', 'mmol/L', null, 1.7, 'A type of fat in your blood.'),
  ('TSH', 'TSH', 'Thyroid', 'mIU/L', 0.4, 4.0, 'The signal your brain sends to the thyroid gland.'),
  ('FT4', 'Free T4', 'Thyroid', 'pmol/L', 12, 22, 'The main hormone your thyroid makes.'),
  ('FT3', 'Free T3', 'Thyroid', 'pmol/L', 3.1, 6.8, 'The active form of thyroid hormone.'),
  ('TPOAB', 'TPO antibodies', 'Thyroid', 'IU/mL', null, 34, 'Antibodies that can affect the thyroid gland.'),
  ('OEST', 'Oestradiol', 'Hormones', 'pmol/L', null, null, 'The main form of oestrogen. Its range depends on your cycle and menopause stage.'),
  ('PROG', 'Progesterone', 'Hormones', 'nmol/L', null, null, 'A hormone that changes through your cycle.'),
  ('FSH', 'FSH', 'Hormones', 'IU/L', null, null, 'A hormone that rises as you move towards menopause.'),
  ('LH', 'LH', 'Hormones', 'IU/L', null, null, 'A hormone that helps regulate your cycle.'),
  ('TESTO', 'Total testosterone', 'Hormones', 'nmol/L', 8.6, 29.0, 'The main male hormone, also present in women.'),
  ('SHBG', 'SHBG', 'Hormones', 'nmol/L', null, null, 'A protein that carries sex hormones in the blood.'),
  ('DHEAS', 'DHEA-S', 'Hormones', 'µmol/L', null, null, 'A hormone made by the adrenal glands.'),
  ('PSA', 'PSA', 'Hormones', 'µg/L', null, 2.5, 'A protein made by the prostate gland.');

-- Unit conversions for the markers above (the same standard factors as the migration).
insert into public.marker_conversions (marker_id, from_unit, factor, offset_value)
select m.id, c.from_unit, c.factor, c.offset_value
from (values
  ('TESTO',    'ng/dL',  0.03467,  0),
  ('OEST',     'pg/mL',  3.671,    0),
  ('PROG',     'ng/mL',  3.18,     0),
  ('GLUCOSE',  'mg/dL',  0.05551,  0),
  ('TCHOL',    'mg/dL',  0.02586,  0),
  ('LDL',      'mg/dL',  0.02586,  0),
  ('HDL',      'mg/dL',  0.02586,  0),
  ('TRIG',     'mg/dL',  0.01129,  0),
  ('VITD',     'ng/mL',  2.496,    0),
  ('HBA1C',    '%',      10.929,   -23.497),
  ('B12',      'pmol/L', 1.355,    0),
  ('FERRITIN', 'ng/mL',  1,        0),
  ('PSA',      'ng/mL',  1,        0),
  ('CRP',      'mg/dL',  10,       0),
  ('DHEAS',    'µg/dL',  0.02714,  0),
  ('HB',       'g/dL',   10,       0),
  ('FT4',      'ng/dL',  12.87,    0),
  ('FT3',      'pg/mL',  1.536,    0)
) as c (code, from_unit, factor, offset_value)
join public.markers m on m.code = c.code
on conflict do nothing;

insert into public.lab_panel_markers (panel_id, marker_id)
select p.id, m.id
from (values
  ('GS5', array['OEST','PROG','FSH','LH','TESTO','SHBG','DHEAS','TSH','FT4','FT3','HBA1C','GLUCOSE','TCHOL','VITD']),
  ('MHP', array['TESTO','SHBG','OEST','PSA','HCT','LH','FSH','TSH','HB']),
  ('PERI', array['OEST','PROG','FSH','LH','TESTO','SHBG','TSH','VITD']),
  ('MET', array['HBA1C','GLUCOSE','CRP','ALT','EGFR','TCHOL','TRIG']),
  ('THY', array['TSH','FT4','FT3','TPOAB']),
  ('VIT', array['VITD','B12','FOLATE','FERRITIN','TSAT','HB']),
  ('LIP', array['TCHOL','HDL','LDL','TRIG'])
) as v(panel_code, marker_codes)
join public.lab_panels p on p.code = v.panel_code
cross join lateral unnest(v.marker_codes) as c(code)
join public.markers m on m.code = c.code;

-- Orders, including one paid order (Oliver Grant).

insert into public.lab_orders (id, order_ref, patient_id, panel_id, lab_partner_id, ordered_by, appointment_id, due_by, price_pence, status, barcode, stripe_checkout_id, paid_at, sample_taken_at, created_at) values
  ('12000000-0000-4000-8000-000000000014', 'LO-2026-014', 'd0000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000011', current_date + 6, 29500, 'sent_to_patient', null, null, null, null, now() - interval '8 days'),
  ('12000000-0000-4000-8000-000000000015', 'LO-2026-015', 'd0000000-0000-4000-8000-000000000005', '11000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000004', current_date - 14, 16000, 'paid', 'SCH-1000141', 'cs_demo_15', now() - interval '20 days', null, now() - interval '28 days'),
  ('12000000-0000-4000-8000-000000000016', 'LO-2026-016', 'd0000000-0000-4000-8000-000000000006', '11000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000012', current_date - 3, 18500, 'sample_taken', 'SCH-1000142', 'cs_demo_16', now() - interval '12 days', now() - interval '5 days', now() - interval '17 days'),
  ('12000000-0000-4000-8000-000000000013', 'LO-2026-013', 'd0000000-0000-4000-8000-000000000003', '11000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002', current_date - 14, 14000, 'results_in', 'SCH-1000138', 'cs_demo_13', now() - interval '12 days', now() - interval '3 days', now() - interval '15 days'),
  ('12000000-0000-4000-8000-000000000012', 'LO-2026-012', 'd0000000-0000-4000-8000-000000000008', '11000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000007', current_date - 14, 12000, 'results_in', 'SCH-1000139', 'cs_demo_12', now() - interval '15 days', now() - interval '5 days', now() - interval '20 days'),
  ('12000000-0000-4000-8000-000000000011', 'LO-2026-011', 'd0000000-0000-4000-8000-000000000007', '11000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000006', current_date - 14, 9500, 'results_in', 'SCH-1000137', 'cs_demo_11', now() - interval '16 days', now() - interval '4 days', now() - interval '21 days'),
  ('12000000-0000-4000-8000-000000000010', 'LO-2026-010', 'd0000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', current_date - 14, 21000, 'results_in', 'SCH-1000136', 'cs_demo_10', now() - interval '14 days', now() - interval '6 days', now() - interval '18 days'),
  ('12000000-0000-4000-8000-000000000008', 'LO-2026-008', 'd0000000-0000-4000-8000-000000000004', '11000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003', current_date - 14, 12000, 'results_in', 'SCH-1000135', 'cs_demo_08', now() - interval '13 days', now() - interval '7 days', now() - interval '16 days'),
  ('12000000-0000-4000-8000-000000000009', 'LO-2026-009', 'd0000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', null, current_date - 22, 29500, 'reviewed', 'SCH-1000130', 'cs_demo_09', now() - interval '25 days', now() - interval '15 days', now() - interval '30 days');

-- Documents ----------------------------------------------------------------------

insert into public.documents (id, patient_id, kind, title, storage_path, source, uploaded_by, shared_with_patient, shared_at, created_at) values
  ('13000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'letter', 'Results review letter', 'd0000000-0000-4000-8000-000000000001/letter-results-review.pdf', 'semble', 'a0000000-0000-4000-8000-000000000001', true, now() - interval '8 days', now() - interval '8 days'),
  ('13000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'letter', 'Follow-up consultation letter', 'd0000000-0000-4000-8000-000000000001/letter-follow-up.pdf', 'semble', 'a0000000-0000-4000-8000-000000000001', true, now() - interval '130 days', now() - interval '130 days'),
  ('13000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'letter', 'Internal referral note', 'd0000000-0000-4000-8000-000000000001/internal-note.pdf', 'semble', 'a0000000-0000-4000-8000-000000000001', false, null, now() - interval '9 days'),
  ('13000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'lab_report', 'GS5 results, released', 'd0000000-0000-4000-8000-000000000001/lab-released.pdf', 'tdl', null, true, now() - interval '8 days', now() - interval '15 days'),
  -- Marked as shared, yet its report is unreleased: the release gate must still hide it.
  ('13000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001', 'lab_report', 'Vitamin results, not released', 'd0000000-0000-4000-8000-000000000001/lab-unreleased.pdf', 'tdl', null, true, now(), now() - interval '2 days'),
  ('13000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000005', 'patient_upload', 'Mediclinic_Dubai_bloods_Oct2026.pdf', 'd0000000-0000-4000-8000-000000000005/mediclinic-dubai.pdf', 'patient_upload', null, true, now() - interval '1 day', now() - interval '1 day'),
  ('13000000-0000-4000-8000-000000000012', null, 'other', 'Labor_Zuerich_Befund_2210.pdf', 'unmatched/labor-zuerich.pdf', 'email', null, false, null, now() - interval '2 days'),
  ('13000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000008', 'lab_report', 'TDL_SCH-1000139.pdf', 'd0000000-0000-4000-8000-000000000008/tdl-sch-1000139.pdf', 'tdl', null, false, null, now() - interval '3 days');

-- Reports and results --------------------------------------------------------------

insert into public.lab_reports (id, patient_id, lab_order_id, lab_partner_id, external_lab_name, document_id, sample_date, received_at, status, reviewed_by, reviewed_at, released_at, patient_comment) values
  -- Eleanor: three released reports for the trend, then one reviewed but not released.
  ('14000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', null, '10000000-0000-4000-8000-000000000001', null, null, current_date - 229, now() - interval '227 days', 'released', 'b0000000-0000-4000-8000-000000000001', now() - interval '225 days', now() - interval '225 days', null),
  ('14000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', null, '10000000-0000-4000-8000-000000000001', null, null, current_date - 135, now() - interval '133 days', 'released', 'b0000000-0000-4000-8000-000000000001', now() - interval '131 days', now() - interval '131 days', null),
  ('14000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001', null, '13000000-0000-4000-8000-000000000004', current_date - 15, now() - interval '13 days', 'released', 'b0000000-0000-4000-8000-000000000001', now() - interval '8 days', now() - interval '8 days', 'Good progress since March. We will talk it through at your follow-up.'),
  ('14000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', null, '10000000-0000-4000-8000-000000000001', null, '13000000-0000-4000-8000-000000000005', current_date - 3, now() - interval '2 days', 'reviewed', 'b0000000-0000-4000-8000-000000000001', now() - interval '1 day', null, null),
  -- The review queue.
  ('14000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000003', '12000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001', null, null, current_date - 3, now() - interval '1 day', 'awaiting_review', null, null, null, null),
  ('14000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000007', '12000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', null, null, current_date - 4, now() - interval '2 days', 'awaiting_review', null, null, null, null),
  ('14000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000004', '12000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000002', null, null, current_date - 7, now() - interval '2 days', 'awaiting_review', null, null, null, null),
  ('14000000-0000-4000-8000-000000000014', 'd0000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', null, null, current_date - 6, now() - interval '3 days', 'awaiting_review', null, null, null, null),
  ('14000000-0000-4000-8000-000000000015', 'd0000000-0000-4000-8000-000000000008', '12000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000002', null, '13000000-0000-4000-8000-000000000013', current_date - 5, now() - interval '3 days', 'awaiting_review', null, null, null, null),
  -- Earlier released reports, for the "previous" column in the queue.
  ('14000000-0000-4000-8000-000000000021', 'd0000000-0000-4000-8000-000000000003', null, '10000000-0000-4000-8000-000000000001', null, null, current_date - 90, now() - interval '88 days', 'released', 'b0000000-0000-4000-8000-000000000001', now() - interval '85 days', now() - interval '85 days', null),
  ('14000000-0000-4000-8000-000000000022', 'd0000000-0000-4000-8000-000000000007', null, '10000000-0000-4000-8000-000000000001', null, null, current_date - 58, now() - interval '56 days', 'released', 'b0000000-0000-4000-8000-000000000001', now() - interval '55 days', now() - interval '55 days', null),
  ('14000000-0000-4000-8000-000000000023', 'd0000000-0000-4000-8000-000000000002', null, '10000000-0000-4000-8000-000000000001', null, null, current_date - 120, now() - interval '118 days', 'released', 'b0000000-0000-4000-8000-000000000001', now() - interval '115 days', now() - interval '115 days', null),
  ('14000000-0000-4000-8000-000000000024', 'd0000000-0000-4000-8000-000000000008', null, '10000000-0000-4000-8000-000000000002', null, null, current_date - 80, now() - interval '78 days', 'released', 'b0000000-0000-4000-8000-000000000001', now() - interval '75 days', now() - interval '75 days', null),
  -- Isla, seen through her guardian.
  ('14000000-0000-4000-8000-000000000031', 'd0000000-0000-4000-8000-00000000000a', null, '10000000-0000-4000-8000-000000000001', null, null, current_date - 40, now() - interval '38 days', 'released', 'b0000000-0000-4000-8000-000000000001', now() - interval '36 days', now() - interval '36 days', null);

select pg_temp.seed_result(r, p, c, v, f::public.result_flag, t)
from (values
  -- Eleanor, March
  ('14000000-0000-4000-8000-000000000001'::uuid, 'd0000000-0000-4000-8000-000000000001'::uuid, 'HBA1C', 46::numeric, 'high', null::text),
  ('14000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'VITD', 38, 'low', null),
  ('14000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'FERRITIN', 24, 'low', null),
  ('14000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'TCHOL', 6.1, 'high', null),
  ('14000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'HDL', 1.5, 'normal', null),
  ('14000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'TSH', 2.3, 'normal', null),
  ('14000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'FT4', 15.1, 'normal', null),
  ('14000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'OEST', 210, 'normal', null),
  ('14000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'FSH', 28, 'normal', null),
  ('14000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'CRP', 1.8, 'normal', null),
  -- Eleanor, June
  ('14000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'HBA1C', 44, 'high', null),
  ('14000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'VITD', 56, 'low', null),
  ('14000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'FERRITIN', 31, 'normal', null),
  ('14000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'TCHOL', 5.8, 'high', null),
  ('14000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'HDL', 1.6, 'normal', null),
  ('14000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'TSH', 2.1, 'normal', null),
  ('14000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'FT4', 15.6, 'normal', null),
  ('14000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'OEST', 165, 'normal', null),
  ('14000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'FSH', 34, 'normal', null),
  ('14000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'CRP', 1.1, 'normal', null),
  -- Eleanor, latest released
  ('14000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'HBA1C', 43, 'high', 'Coming down steadily since March. Keep going with the changes we discussed and we will recheck in three months.'),
  ('14000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'VITD', 71, 'borderline', 'Much better on supplements. Stay on 4,000 IU daily through the winter.'),
  ('14000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'FERRITIN', 42, 'normal', null),
  ('14000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'TCHOL', 5.4, 'borderline', 'Heading the right way. We will look at the full lipid picture at your follow-up.'),
  ('14000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'HDL', 1.6, 'normal', null),
  ('14000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'TSH', 2.2, 'normal', null),
  ('14000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'FT4', 15.4, 'normal', null),
  ('14000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'OEST', 182, 'normal', 'Consistent with your current HRT dose.'),
  ('14000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'FSH', 31, 'normal', null),
  ('14000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'CRP', 0.9, 'normal', null),
  -- Eleanor, reviewed but not released: patients must not see these.
  ('14000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'VITD', 99, 'normal', 'Not yet released.'),
  ('14000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'B12', 410, 'normal', null),
  -- Amira
  ('14000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000003', 'TSH', 6.8, 'high', null),
  ('14000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000003', 'FT4', 11.2, 'low', null),
  ('14000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000003', 'FT3', 4.0, 'normal', null),
  ('14000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000003', 'TPOAB', 210, 'high', null),
  ('14000000-0000-4000-8000-000000000021', 'd0000000-0000-4000-8000-000000000003', 'TSH', 4.9, 'high', null),
  ('14000000-0000-4000-8000-000000000021', 'd0000000-0000-4000-8000-000000000003', 'FT4', 12.6, 'normal', null),
  ('14000000-0000-4000-8000-000000000021', 'd0000000-0000-4000-8000-000000000003', 'FT3', 4.2, 'normal', null),
  ('14000000-0000-4000-8000-000000000021', 'd0000000-0000-4000-8000-000000000003', 'TPOAB', 198, 'high', null),
  -- Daniel
  ('14000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000007', 'LDL', 4.6, 'high', null),
  ('14000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000007', 'TCHOL', 6.7, 'high', null),
  ('14000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000007', 'TRIG', 2.1, 'borderline', null),
  ('14000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000007', 'HDL', 1.3, 'normal', null),
  ('14000000-0000-4000-8000-000000000022', 'd0000000-0000-4000-8000-000000000007', 'LDL', 4.1, 'high', null),
  ('14000000-0000-4000-8000-000000000022', 'd0000000-0000-4000-8000-000000000007', 'TCHOL', 6.2, 'high', null),
  ('14000000-0000-4000-8000-000000000022', 'd0000000-0000-4000-8000-000000000007', 'TRIG', 1.9, 'borderline', null),
  ('14000000-0000-4000-8000-000000000022', 'd0000000-0000-4000-8000-000000000007', 'HDL', 1.3, 'normal', null),
  -- Claire: new patient, no previous values.
  ('14000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000004', 'FERRITIN', 18, 'low', null),
  ('14000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000004', 'TSAT', 14, 'low', null),
  ('14000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000004', 'HB', 121, 'normal', null),
  -- Thomas
  ('14000000-0000-4000-8000-000000000014', 'd0000000-0000-4000-8000-000000000002', 'HCT', 0.53, 'high', null),
  ('14000000-0000-4000-8000-000000000014', 'd0000000-0000-4000-8000-000000000002', 'TESTO', 24.1, 'normal', null),
  ('14000000-0000-4000-8000-000000000014', 'd0000000-0000-4000-8000-000000000002', 'PSA', 0.8, 'normal', null),
  ('14000000-0000-4000-8000-000000000023', 'd0000000-0000-4000-8000-000000000002', 'HCT', 0.50, 'normal', null),
  ('14000000-0000-4000-8000-000000000023', 'd0000000-0000-4000-8000-000000000002', 'TESTO', 22.3, 'normal', null),
  ('14000000-0000-4000-8000-000000000023', 'd0000000-0000-4000-8000-000000000002', 'PSA', 0.7, 'normal', null),
  -- Hannah
  ('14000000-0000-4000-8000-000000000015', 'd0000000-0000-4000-8000-000000000008', 'VITD', 48, 'low', null),
  ('14000000-0000-4000-8000-000000000015', 'd0000000-0000-4000-8000-000000000008', 'B12', 410, 'normal', null),
  ('14000000-0000-4000-8000-000000000015', 'd0000000-0000-4000-8000-000000000008', 'FOLATE', 7.2, 'normal', null),
  ('14000000-0000-4000-8000-000000000024', 'd0000000-0000-4000-8000-000000000008', 'VITD', 41, 'low', null),
  ('14000000-0000-4000-8000-000000000024', 'd0000000-0000-4000-8000-000000000008', 'B12', 388, 'normal', null),
  ('14000000-0000-4000-8000-000000000024', 'd0000000-0000-4000-8000-000000000008', 'FOLATE', 6.8, 'normal', null),
  -- Isla
  ('14000000-0000-4000-8000-000000000031', 'd0000000-0000-4000-8000-00000000000a', 'VITD', 62, 'borderline', null),
  ('14000000-0000-4000-8000-000000000031', 'd0000000-0000-4000-8000-00000000000a', 'FERRITIN', 38, 'normal', null)
) as v(r, p, c, v, f, t);

-- The import queue ----------------------------------------------------------------

insert into public.result_imports (id, document_id, patient_id, status, received_at) values
  ('15000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000005', 'matched', now() - interval '1 day'),
  ('15000000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-000000000012', null, 'needs_match', now() - interval '2 days'),
  ('15000000-0000-4000-8000-000000000003', '13000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000008', 'matched', now() - interval '3 days');

insert into public.import_items (import_id, marker_id, raw_name, value, unit, ref_range_text, confidence)
select v.i::uuid, m.id, v.raw, v.val, v.u, v.rng, v.conf::public.import_confidence
from (values
  ('15000000-0000-4000-8000-000000000001', 'HBA1C', 'HbA1c', '47', 'mmol/mol', '20–41', 'high'),
  ('15000000-0000-4000-8000-000000000001', 'GLUCOSE', 'Fasting glucose', '6.4', 'mmol/L', '3.9–5.5', 'high'),
  ('15000000-0000-4000-8000-000000000001', 'ALT', 'ALT', '38', 'U/L', '0–41', 'medium'),
  ('15000000-0000-4000-8000-000000000001', 'EGFR', 'eGFR', '82', 'mL/min', '> 60', 'high'),
  ('15000000-0000-4000-8000-000000000002', 'OEST', 'Oestradiol', '95', 'pmol/L', 'varies', 'high'),
  ('15000000-0000-4000-8000-000000000002', 'FSH', 'FSH', '41', 'IU/L', 'varies', 'medium'),
  ('15000000-0000-4000-8000-000000000002', 'PROG', 'Progesterone', '1.2', 'nmol/L', 'varies', 'low'),
  ('15000000-0000-4000-8000-000000000003', 'VITD', 'Vitamin D', '48', 'nmol/L', '75–200', 'high'),
  ('15000000-0000-4000-8000-000000000003', 'B12', 'Vitamin B12', '410', 'ng/L', '180–900', 'high'),
  ('15000000-0000-4000-8000-000000000003', 'FOLATE', 'Folate', '7.2', 'µg/L', '> 3.9', 'high')
) as v(i, code, raw, val, u, rng, conf)
join public.markers m on m.code = v.code;

-- Notifications, invitations and logs ------------------------------------------------

insert into public.notifications (user_id, topic, title, body, link, read_at, created_at) values
  ('a0000000-0000-4000-8000-000000000011', 'results', 'Your results are ready', 'Dr Schoeman has reviewed your bloods.', '/portal', null, now() - interval '8 days'),
  ('a0000000-0000-4000-8000-000000000011', 'appointments', 'Bloods due soon', 'Results need to reach us two weeks before your appointment.', '/portal', now() - interval '1 day', now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000001', 'results', 'New results to review', 'Thyroid panel for Amira Haddad.', '/clinic', null, now() - interval '1 day'),
  ('a0000000-0000-4000-8000-000000000003', 'results', 'Import waiting', 'A report arrived by email and needs matching.', '/clinic', null, now() - interval '2 days');

-- The hashes are not of any real link, so none of these can be accepted from an email.
insert into public.invitations (email, kind, role, patient_id, job_title, invited_by, token_hash, created_at, sent_at, expires_at) values
  ('claire.benson@example.test', 'patient', 'patient', 'd0000000-0000-4000-8000-000000000004', null, 'b0000000-0000-4000-8000-000000000003', 'demo-hash-not-a-real-token-0000000000', now() - interval '1 day', now() - interval '1 day', now() + interval '2 days'),
  ('new.doctor@example.test', 'team', 'doctor', null, 'Doctor', 'b0000000-0000-4000-8000-000000000006', 'demo-hash-not-a-real-token-1111111111', now() - interval '6 days', now() - interval '6 days', now() - interval '3 days');

insert into public.webhook_events (source, external_event_id, event_type, payload, status, processed_at) values
  ('stripe', 'evt_demo_1', 'checkout.session.completed', '{"demo": true}', 'processed', now() - interval '20 days');

insert into public.integration_sync_log (system, direction, entity, status, finished_at) values
  ('ghl', 'in', 'appointments', 'ok', now());

-- Feedback ---------------------------------------------------------------------------
-- Eleanor answered a survey last week (positive, may be quoted) and has a new one waiting.
insert into public.patient_feedback (id, patient_id, sent_at, answered_at, answered_by, score, went_well, could_improve, wants_contact, may_quote) values
  ('f2000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', now() - interval '9 days', now() - interval '8 days',
   'a0000000-0000-4000-8000-000000000011', 9, 'Dr Schoeman explained my results clearly and took her time.', null, false, true);
insert into public.form_submissions (patient_id, kind, title, answers, source_id, submitted_by, submitted_at) values
  ('d0000000-0000-4000-8000-000000000001', 'feedback', 'Feedback after your appointment',
   '[{"question": "How likely are you to recommend The Schoeman Clinic to a friend or family member? (0 to 10)", "answer": "9"}, {"question": "What went well?", "answer": "Dr Schoeman explained my results clearly and took her time."}, {"question": "Would you like someone from the clinic to contact you?", "answer": "No"}, {"question": "May we use your comments, without your name, as evidence of patient feedback?", "answer": "Yes"}]',
   'f2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', now() - interval '8 days');
insert into public.patient_feedback (id, patient_id, sent_at) values
  ('f2000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', now() - interval '1 day');
