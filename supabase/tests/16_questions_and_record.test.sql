-- Ask the clinic, consents and the fuller patient record. Ids from supabase/seed.sql:
-- Eleanor (patient) a..11 / d..01; Gina (doctor, her care team) a..01; Laura (doctor, not) a..02; Priya (PA) a..03.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

-- A patient asks.
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select lives_ok($$ insert into public.questions (patient_id, asked_by, subject, body) values ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', 'Dose timing', 'Morning or evening?') $$, 'a patient asks a question');
reset role;
create temporary table qq on commit drop as select id from public.questions where subject = 'Dose timing';
grant select on qq to authenticated;

-- Her doctor replies; another doctor cannot.
select pg_temp.become('a0000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.reply_to_question((select id from qq), 'Hello') $$, '42501', null, 'a doctor not on the care team cannot reply');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select is(public.reply_to_question((select id from qq), 'Take it in the morning.'), true, 'her doctor replies, as the clinic');
select throws_ok($$ update public.questions set status = 'closed' where id = (select id from qq) $$, '42501', null, 'status changes only through the functions');
reset role;
select is((select status::text from public.questions where id = (select id from qq)), 'answered', 'and the question is answered');

-- The patient reads the reply and writes back.
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from public.question_replies where question_id = (select id from qq)), 1, 'the patient reads the reply');
select is(public.reply_to_question((select id from qq), 'Thank you.'), false, 'and writes back, as the patient side');
select throws_ok($$ select public.close_question((select id from qq)) $$, '42501', null, 'a patient cannot close a question');
reset role;
select is((select status::text from public.questions where id = (select id from qq)), 'awaiting_reply', 'which waits for the clinic again');

-- Another patient sees nothing; a PA closes it; closed stays closed.
select pg_temp.become('a0000000-0000-4000-8000-000000000012');
select is((select count(*)::int from public.question_replies where question_id = (select id from qq)), 0, 'another patient sees no reply');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select lives_ok($$ select public.close_question((select id from qq)) $$, 'a PA closes the question');
select throws_ok($$ select public.reply_to_question((select id from qq), 'More') $$, '22023', null, 'and no more replies go in');
reset role;

-- Consents: the patient records her choice; staff read it.
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select lives_ok($$ insert into public.consents (patient_id, consent_type, version, granted) values ('d0000000-0000-4000-8000-000000000001', 'research', '2026-11', true) $$, 'a patient records a consent choice');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select cmp_ok((select count(*)::int from public.consents where patient_id = 'd0000000-0000-4000-8000-000000000001'), '>', 0, 'her doctor reads her consents');
reset role;

-- The fuller record: a PA records an allergy but cannot diagnose or see safeguarding.
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select lives_ok($$ insert into public.patient_allergies (patient_id, substance, recorded_by) values ('d0000000-0000-4000-8000-000000000001', 'Penicillin', 'b0000000-0000-4000-8000-000000000003') $$, 'a PA records an allergy');
select throws_ok($$ insert into public.diagnoses (patient_id, label, recorded_by) values ('d0000000-0000-4000-8000-000000000001', 'Test', 'b0000000-0000-4000-8000-000000000003') $$, '42501', null, 'a PA cannot add a diagnosis');
select is((select count(*)::int from public.safeguarding_alerts), 0, 'a PA sees no safeguarding alert');
reset role;

-- Her doctor raises a safeguarding alert; the patient never sees it.
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select lives_ok($$ insert into public.safeguarding_alerts (patient_id, alert_type, severity, note, added_by) values ('d0000000-0000-4000-8000-000000000001', 'Concern', 'moderate', 'Note', 'b0000000-0000-4000-8000-000000000001') $$, 'her doctor raises a safeguarding alert');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from public.safeguarding_alerts), 0, 'the patient sees no safeguarding alert');
reset role;

-- Letters: hidden from the patient until shared.
insert into public.documents (patient_id, kind, title, storage_path, source, uploaded_by, shared_with_patient)
values ('d0000000-0000-4000-8000-000000000001', 'letter', 'Test letter', 'd0000000-0000-4000-8000-000000000001/letter.pdf', 'staff_upload', 'a0000000-0000-4000-8000-000000000001', false);
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from public.documents where title = 'Test letter'), 0, 'an unshared letter is hidden from the patient');
reset role;
update public.documents set shared_with_patient = true, shared_at = now() where title = 'Test letter';
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from public.documents where title = 'Test letter'), 1, 'and shows once shared');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.log_record_view('d0000000-0000-4000-8000-000000000001', 'documents', (select id from public.documents where title = 'Test letter')) $$, 'opening a document is logged');
select throws_ok($$ select public.log_record_view('d0000000-0000-4000-8000-000000000002', 'documents', (select id from public.documents where title = 'Test letter')) $$, null, null, 'but not against another patient');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000005');
select throws_ok($$ insert into public.documents (patient_id, kind, title, storage_path, source, uploaded_by) values ('d0000000-0000-4000-8000-000000000001', 'letter', 'x', 'd0000000-0000-4000-8000-000000000001/x.pdf', 'staff_upload', 'a0000000-0000-4000-8000-000000000005') $$, '42501', null, 'a health coach does not add documents');
reset role;

select * from finish();
rollback;
