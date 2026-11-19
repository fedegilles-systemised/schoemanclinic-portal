-- The registration form a new patient completes: who must, what it writes, who can read the photo ID, and that it
-- is permanent. Ids from supabase/seed.sql: Eleanor (patient) d..01, account a..11; Thomas (patient) d..02,
-- account a..12; Gina (doctor, Eleanor's care team) a..01; Priya (PA) a..03; admin a..06; health coach a..05.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

-- Eleanor is a new patient who must complete the form; Thomas is an existing one who need not.
update public.patient_profiles set registration_required = true where id = 'd0000000-0000-4000-8000-000000000001';
create temp table before as select sex, gender_identity, contact_phone, address_line1, city, postcode from public.patient_profiles where id = 'd0000000-0000-4000-8000-000000000001';
grant select on before to public;

select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select public.registration_needed()), true, 'a new patient has the form to complete');
select is((select needed from public.my_registration()), true, 'the form is told so');
select is((select patient_id from public.my_registration()), 'd0000000-0000-4000-8000-000000000001'::uuid, 'and which record is theirs');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000012');
select is((select public.registration_needed()), false, 'an existing patient does not');
select is((select needed from public.my_registration()), false, 'and the form is told so');
select throws_ok($$ select public.submit_registration('{"agreed": true}'::jsonb) $$, '22023', 'You do not need to complete this form.', 'and cannot submit it');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select is((select public.registration_needed()), false, 'a staff member is never asked');
select is((select count(*)::int from public.my_registration()), 0, 'and has no registration of their own');
select throws_ok($$ select public.submit_registration('{"agreed": true}'::jsonb) $$, '42501', 'Only a patient can complete this form for themselves.', 'and cannot submit it for a patient');
reset role;

-- The ID file: a patient adds one in their own folder while the form is to do, and no one else's.
select pg_temp.become('a0000000-0000-4000-8000-000000000012');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('identity', 'd0000000-0000-4000-8000-000000000001/f1000000-0000-4000-8000-0000000000bb.png') $$, '42501', null, 'a patient cannot add a file to another patient''s folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('identity', 'd0000000-0000-4000-8000-000000000002/f1000000-0000-4000-8000-0000000000bb.png') $$, '42501', null, 'nor add their own when they have no form to do');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('identity', 'd0000000-0000-4000-8000-000000000001/not-a-uuid.png') $$, '42501', null, 'the file name must be in the expected form');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('identity', 'd0000000-0000-4000-8000-000000000001/f1000000-0000-4000-8000-0000000000aa.png') $$, 'a new patient adds their ID in their own folder');
reset role;

-- Submitting
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
create temp table payload as select jsonb_build_object(
  'title', 'Ms', 'address_line1', '1 Example Road', 'town', 'London', 'postcode', 'W1G 9XX', 'country', 'United Kingdom',
  'gender', 'Woman', 'phone', '07700 900111', 'sex', 'F',
  'next_of_kin_name', 'Sam Hart', 'next_of_kin_relationship', 'Brother', 'next_of_kin_phone', '07700 900222',
  'gp_name', 'Dr A. Smith', 'gp_practice', 'Example Surgery, 2 Example Road, London', 'occupation', 'Teacher',
  'main_reason', 'Tired all the time', 'concern_duration', 'Two years', 'already_tried', 'Iron and sleep hygiene', 'health_goals', 'Energy, sleep, weight',
  'identity_path', 'd0000000-0000-4000-8000-000000000001/f1000000-0000-4000-8000-0000000000aa.png',
  'agreed', true, 'news_opt_out', true, 'whatsapp_consent', true, 'version', '2026-11') as d;
grant select on payload to public;
select throws_ok($$ select public.submit_registration((select d - 'agreed' from payload)) $$, '22023', 'Confirm your details and agree to continue.', 'the agreement is needed');
select throws_ok($$ select public.submit_registration((select d - 'gp_name' from payload)) $$, '22023', 'Answer every question marked as needed.', 'every required answer is needed');
select throws_ok($$ select public.submit_registration((select d || '{"main_reason": "   "}'::jsonb from payload)) $$, '22023', 'Answer every question marked as needed.', 'a blank answer does not count');
select throws_ok($$ select public.submit_registration((select d || '{"sex": "X"}'::jsonb from payload)) $$, '22023', 'Choose your sex at birth.', 'sex at birth is Female or Male');
select throws_ok($$ select public.submit_registration((select d || '{"identity_path": "d0000000-0000-4000-8000-000000000001/f1000000-0000-4000-8000-0000000000cc.png"}'::jsonb from payload)) $$, '22023', 'Upload a copy of your photo ID.', 'the ID file must exist');
select throws_ok($$ select public.submit_registration((select d || '{"identity_path": "d0000000-0000-4000-8000-000000000002/f1000000-0000-4000-8000-0000000000aa.png"}'::jsonb from payload)) $$, '22023', 'Upload a copy of your photo ID.', 'and be in their own folder');
select throws_ok($$ insert into public.patient_registrations (patient_id, submitted_by, version, next_of_kin_name, next_of_kin_relationship, next_of_kin_phone, gp_name, gp_practice, occupation, main_reason, concern_duration, already_tried, health_goals, identity_path) values ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', 'x', 'a', 'b', '12345', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j') $$, '42501', null, 'the form cannot be written around the function');
select lives_ok($$ select public.submit_registration((select d from payload)) $$, 'a complete form is accepted');
select throws_ok($$ select public.submit_registration((select d from payload)) $$, '22023', 'This form is already complete.', 'and only once');
select is((select public.registration_needed()), false, 'the patient is no longer asked');
reset role;

select is((select count(*)::int from public.patient_registrations where patient_id = 'd0000000-0000-4000-8000-000000000001'), 1, 'one registration is kept');
select is((select sex from public.patient_profiles where id = 'd0000000-0000-4000-8000-000000000001'), (select sex from before), 'what the record already held is not overwritten');
select is((select gender_identity from public.patient_profiles where id = 'd0000000-0000-4000-8000-000000000001'), coalesce((select gender_identity from before), 'Woman'), 'what the record lacked is filled in');
select is((select address_line1 from public.patient_profiles where id = 'd0000000-0000-4000-8000-000000000001'), coalesce((select address_line1 from before), '1 Example Road'), 'the address on the record is kept, or filled in when it was empty');
select is((select count(*)::int from public.notification_preferences where user_id = 'a0000000-0000-4000-8000-000000000011' and channel = 'whatsapp' and enabled), 4, 'WhatsApp consent turns on WhatsApp for the four kinds of message');
select is((select news_opt_out from public.patient_registrations where patient_id = 'd0000000-0000-4000-8000-000000000001'), true, 'the choice not to get news is kept');
select is((select kind::text from public.form_submissions where source_id = (select id from public.patient_registrations where patient_id = 'd0000000-0000-4000-8000-000000000001')), 'registration', 'a permanent copy of the form is kept');
select ok((select answers @> '[{"question": "Next of kin, name", "answer": "Sam Hart"}]'::jsonb from public.form_submissions where kind = 'registration' and patient_id = 'd0000000-0000-4000-8000-000000000001'), 'as asked and answered');
select ok((select not (answers::text like '%f1000000%') from public.form_submissions where kind = 'registration' and patient_id = 'd0000000-0000-4000-8000-000000000001'), 'without the ID file''s path');

-- Reading
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from public.patient_registrations), 1, 'a patient reads their own registration');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000012');
select is((select count(*)::int from public.patient_registrations), 0, 'another patient reads none');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.patient_registrations), 1, 'a doctor on the care team reads the details');
select is((select count(*)::int from storage.objects where bucket_id = 'identity'), 0, 'but not the photo ID');
select throws_ok($$ select public.check_identity('d0000000-0000-4000-8000-000000000001') $$, '42501', null, 'and cannot mark it checked');
select throws_ok($$ select public.log_identity_view('d0000000-0000-4000-8000-000000000001') $$, '42501', null, 'nor open it');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000005');
select is((select count(*)::int from storage.objects where bucket_id = 'identity'), 0, 'a health coach cannot read the photo ID');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from storage.objects where bucket_id = 'identity'), 0, 'nor can the patient read it back');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select is((select count(*)::int from storage.objects where bucket_id = 'identity'), 0, 'a PA cannot read the photo ID straight from storage: it is opened only through the logged route');
select lives_ok($$ select public.log_identity_view('d0000000-0000-4000-8000-000000000001') $$, 'a PA opens it through the route and it is logged');
select lives_ok($$ select public.log_identity_view('d0000000-0000-4000-8000-000000000001') $$, 'again');
reset role;
select is((select count(*)::int from public.audit_log where entity = 'patient_registrations' and action = 'viewed' and actor_id = 'a0000000-0000-4000-8000-000000000003'), 1, 'but only once in ten minutes');
select pg_temp.become('a0000000-0000-4000-8000-000000000006');
select is((select count(*)::int from storage.objects where bucket_id = 'identity'), 0, 'nor can an admin');
reset role;

-- Checking the identity
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select lives_ok($$ select public.check_identity('d0000000-0000-4000-8000-000000000001') $$, 'a PA marks the identity as checked');
select throws_ok($$ select public.check_identity('d0000000-0000-4000-8000-000000000001') $$, '22023', 'This identity is already checked.', 'once');
select throws_ok($$ select public.check_identity('d0000000-0000-4000-8000-000000000002') $$, '22023', 'This patient has no registration.', 'and only for a patient who has one');
reset role;
select is((select identity_checked_by from public.patient_registrations where patient_id = 'd0000000-0000-4000-8000-000000000001'), 'a0000000-0000-4000-8000-000000000003'::uuid, 'who checked it is kept');

-- Permanent
select throws_ok($$ update public.patient_registrations set gp_name = 'Someone else' where patient_id = 'd0000000-0000-4000-8000-000000000001' $$, '42501', 'A registration is permanent and cannot be changed.', 'a registration cannot be changed');
select throws_ok($$ delete from public.patient_registrations where patient_id = 'd0000000-0000-4000-8000-000000000001' $$, '42501', 'A registration is permanent and cannot be removed.', 'or removed');
select throws_ok($$ truncate public.patient_registrations $$, '42501', null, 'or emptied');
select pg_temp.become('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ update public.patient_profiles set registration_required = false where id = 'd0000000-0000-4000-8000-000000000001' $$, '42501', null, 'no one can waive the form from the browser');
reset role;

select * from finish();
rollback;
