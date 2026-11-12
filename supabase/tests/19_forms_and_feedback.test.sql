-- Forms on the record and patient feedback. Ids from supabase/seed.sql: Gina (doctor) a..01 / b..01,
-- on Eleanor's (d..01) care team; Priya (PA) a..03; Cecile (health coach) a..05; admin a..06; Nora
-- (nurse) a..07; Eleanor (patient) a..11; Thomas (patient) a..12.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;
create function pg_temp.become_server() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{}', true);
  set local role service_role;
end;
$$;

-- Earlier forms were copied in once.
select is(
  (select count(*)::int from public.form_submissions where kind = 'question'),
  (select count(*)::int from public.questions), 'every earlier question is on the record as a form');
select is(
  (select answers -> 0 ->> 'question' from public.form_submissions where kind = 'repeat_request' limit 1),
  'Medicines', 'an earlier repeat request is copied with its medicines first');

-- Eleanor had an appointment yesterday, now completed; Cecile looks after her too, for this test.
select set_config('app.system_actor', 'forms-test', true);
insert into public.appointments (id, patient_id, clinician_id, starts_at, duration_min, type, status, source)
values ('f0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
  now() - interval '1 day', 30, 'Follow-up', 'completed', 'clinic_hub');
insert into public.care_team (patient_id, staff_id, relationship, since)
select 'd0000000-0000-4000-8000-000000000001', s.id, 'health_coach', current_date - 1
from public.staff_profiles s where s.user_id = 'a0000000-0000-4000-8000-000000000005'
  and not exists (select 1 from public.care_team c where c.patient_id = 'd0000000-0000-4000-8000-000000000001' and c.staff_id = s.id);
-- The seed's surveys are moved back beyond the 90-day limit, so today's appointment is asked about.
update public.patient_feedback set sent_at = sent_at - interval '120 days';
select set_config('app.system_actor', '', true);

-- Sending is server only, once per appointment, and at most once every 90 days.
select pg_temp.become('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select * from public.queue_feedback() $$, '42501', null, 'staff cannot send surveys themselves');
reset role;
select pg_temp.become_server();
select is((select count(*)::int from public.queue_feedback() where patient_id = 'd0000000-0000-4000-8000-000000000001'), 1, 'the daily job makes a survey for yesterday''s appointment');
select is((select count(*)::int from public.queue_feedback()), 0, 'and not again');
reset role;
-- A confirmed visit that has ended counts too, as nothing marks visits completed yet; a no-show does not.
select set_config('app.system_actor', 'forms-test', true);
insert into public.appointments (id, patient_id, starts_at, duration_min, type, status, source) values
  ('f0000000-0000-4000-8000-0000000000f2', 'd0000000-0000-4000-8000-000000000002', now() - interval '1 day', 30, 'Follow-up', 'confirmed', 'clinic_hub'),
  ('f0000000-0000-4000-8000-0000000000f3', 'd0000000-0000-4000-8000-000000000003', now() - interval '1 day', 30, 'Follow-up', 'no_show', 'clinic_hub');
select set_config('app.system_actor', '', true);
select pg_temp.become_server();
create temp table queued_now as select * from public.queue_feedback();
select ok(exists (select 1 from queued_now where patient_id = 'd0000000-0000-4000-8000-000000000002'), 'a confirmed visit that has ended is asked about');
select ok(not exists (select 1 from queued_now where patient_id = 'd0000000-0000-4000-8000-000000000003'), 'a no-show is not asked');
select throws_ok($$ insert into public.patient_feedback (patient_id) values ('d0000000-0000-4000-8000-000000000001') $$, '42501', null, 'server code cannot write feedback directly');
reset role;
select is((select metadata ->> 'system' from public.audit_log where entity = 'patient_feedback' order by id desc limit 1), 'feedback', 'the survey is in the audit log as sent by the feedback job');

create temp table survey as select id from public.patient_feedback where appointment_id = 'f0000000-0000-4000-8000-0000000000f1';
grant select on survey to authenticated;

-- Only the patient, or a guardian who can act, answers; once, and completely.
select pg_temp.become('a0000000-0000-4000-8000-000000000012');
select throws_ok($$ select public.submit_feedback((select id from survey), 10, null, null, false, true) $$, '42501', null, 'another patient cannot answer');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select throws_ok($$ select public.submit_feedback((select id from survey), 11, null, null, false, true) $$, '22023', null, 'the score is 0 to 10');
select throws_ok($$ select public.submit_feedback((select id from survey), 8, null, null, null, true) $$, '22023', null, 'every yes or no is answered');
select is((select public.submit_feedback((select id from survey), 8, 'Kind and thorough.', 'Shorter wait for results.', false, true)), 'amber', 'a score of 8 is amber');
select throws_ok($$ select public.submit_feedback((select id from survey), 10, null, null, false, true) $$, '23505', null, 'a survey is answered once');
select is((select rating from public.patient_feedback where id = (select id from survey)), 'amber', 'the patient reads her own answer');
select ok((select follow_up_due >= current_date from public.patient_feedback where id = (select id from survey)), 'amber has a follow-up date');
select is(
  (select answers -> 1 ->> 'answer' from public.form_submissions where kind = 'feedback' and source_id = (select id from survey)),
  'Kind and thorough.', 'the answers are on her record as a form');
select is((select count(*)::int from public.feedback_follow_ups), 0, 'the patient reads no follow-up');
reset role;

-- Amber alerts admins and PAs, not the patient's doctors.
select ok(exists (select 1 from public.notifications where user_id = 'a0000000-0000-4000-8000-000000000003' and link = '/clinic/feedback/' || (select id from survey)), 'a PA is alerted');
select ok(exists (select 1 from public.notifications where user_id = 'a0000000-0000-4000-8000-000000000006' and link = '/clinic/feedback/' || (select id from survey)), 'an admin is alerted');
select ok(not exists (select 1 from public.notifications where user_id = 'a0000000-0000-4000-8000-000000000001' and link = '/clinic/feedback/' || (select id from survey)), 'her doctor is not alerted for amber');

-- Admins, PAs and her doctors read feedback; nurses and health coaches do not.
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.patient_feedback where id = (select id from survey)), 1, 'her doctor reads the feedback');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000005');
select is((select count(*)::int from public.patient_feedback), 0, 'a health coach on her care team does not');
select is((select count(*)::int from public.form_submissions where kind = 'feedback'), 0, 'nor the feedback form on her record');
select ok((select count(*)::int from public.form_submissions where patient_id = 'd0000000-0000-4000-8000-000000000001') > 0, 'but reads her other forms');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000007');
select is((select count(*)::int from public.patient_feedback), 0, 'a nurse reads no feedback');
reset role;

-- The follow-up: by an admin, PA or doctor, once, described.
select pg_temp.become('a0000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.record_feedback_follow_up((select id from survey), 'Called her.') $$, '42501', null, 'a health coach cannot record the follow-up');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.record_feedback_follow_up((select id from survey), '  ') $$, '22023', null, 'the follow-up is described');
select lives_ok($$ select public.record_feedback_follow_up((select id from survey), 'Called her; results letter now sent within a week.') $$, 'a PA records the follow-up');
select throws_ok($$ select public.record_feedback_follow_up((select id from survey), 'Again.') $$, '23505', null, 'once');
select is((select count(*)::int from public.feedback_follow_ups where feedback_id = (select id from survey)), 1, 'the PA reads it');
reset role;

-- Red: asking to be contacted, whatever the score, also alerts her doctors.
select set_config('app.system_actor', 'forms-test', true);
insert into public.patient_feedback (id, patient_id) values ('f1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001');
select set_config('app.system_actor', '', true);
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select public.submit_feedback('f1000000-0000-4000-8000-000000000001', 10, null, null, true, false)), 'red', 'asking to be contacted is red');
reset role;
select ok(exists (select 1 from public.notifications where user_id = 'a0000000-0000-4000-8000-000000000001' and link = '/clinic/feedback/f1000000-0000-4000-8000-000000000001'), 'her doctor is alerted for red');
select is((select follow_up_due from public.patient_feedback where id = 'f1000000-0000-4000-8000-000000000001'), private.working_day_from(private.london_today()), 'red is due the same working day');

-- Reminders: once, three days after sending, for unanswered surveys.
select set_config('app.system_actor', 'forms-test', true);
insert into public.patient_feedback (id, patient_id, sent_at) values ('f1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', now() - interval '4 days');
select set_config('app.system_actor', '', true);
select pg_temp.become_server();
select is((select count(*)::int from public.due_feedback_reminders() where feedback_id = 'f1000000-0000-4000-8000-000000000002'), 1, 'an unanswered survey is reminded about');
select is((select count(*)::int from public.due_feedback_reminders()), 0, 'once');
reset role;

-- Working days.
select is(private.working_day_from(date '2026-11-14'), date '2026-11-16', 'Saturday moves to Monday');
select is(private.working_day_from(date '2026-11-17'), date '2026-11-17', 'a weekday stays');

-- A new repeat request is copied to the record with its answers.
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select lives_ok($$ select public.request_repeat('d0000000-0000-4000-8000-000000000001', '[{"other_name": "Vitamin K2", "supply_months": 2}]'::jsonb, false, true, null, null, null, null, 'Before my holiday') $$, 'a patient requests a repeat');
select is(
  (select answers::text from public.form_submissions where kind = 'repeat_request' and patient_id = 'd0000000-0000-4000-8000-000000000001' order by submitted_at desc limit 1),
  '[{"answer": "Vitamin K2, 2 months", "question": "Medicines"}, {"answer": "No", "question": "Do you have a future appointment booked?"}, {"answer": "Yes", "question": "Would you like to book one?"}, {"answer": "Before my holiday", "question": "Anything else the clinic should know?"}]',
  'the form shows the medicines and answers in words');
reset role;

-- Forms and follow-ups are permanent; nobody writes a form directly.
select throws_ok($$ update public.form_submissions set title = 'Changed' $$, '42501', null, 'a form cannot be changed');
select throws_ok($$ delete from public.form_submissions $$, '42501', null, 'or removed');
select throws_ok($$ truncate public.form_submissions $$, '42501', null, 'or emptied');
select throws_ok($$ delete from public.feedback_follow_ups $$, '42501', null, 'a follow-up cannot be removed');
select ok(not has_table_privilege('service_role', 'public.form_submissions', 'insert'), 'server code cannot write a form');
select ok(not has_table_privilege('authenticated', 'public.form_submissions', 'insert'), 'nor can a signed-in person');
select ok(exists (select 1 from public.audit_log where entity = 'form_submissions'), 'forms are in the audit log');

select * from finish();
rollback;
