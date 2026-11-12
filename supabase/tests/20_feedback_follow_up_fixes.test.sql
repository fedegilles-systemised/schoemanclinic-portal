-- Bank holidays in follow-up dates, checking a quote before it is used as evidence, and logging
-- feedback downloads. Ids from supabase/seed.sql: Gina (doctor) a..01 / b..01, on Eleanor's (d..01)
-- care team; Priya (PA) a..03 / b..03; Cecile (health coach) a..05; admin a..06; Nora (nurse) a..07;
-- Eleanor (patient) a..11. Feedback f2..01 is Eleanor's, answered, may be quoted.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

-- Bank holidays in England and Wales.
select is(private.easter_sunday(2026), date '2026-04-05', 'Easter Sunday 2026');
select is(private.easter_sunday(2027), date '2027-03-28', 'Easter Sunday 2027');
select ok(private.is_bank_holiday(date '2026-04-03'), 'Good Friday 2026');
select ok(private.is_bank_holiday(date '2026-04-06'), 'Easter Monday 2026');
select ok(private.is_bank_holiday(date '2026-05-04'), 'early May 2026');
select ok(private.is_bank_holiday(date '2026-05-25'), 'spring 2026');
select ok(private.is_bank_holiday(date '2026-08-31'), 'summer 2026');
select ok(private.is_bank_holiday(date '2026-12-25') and private.is_bank_holiday(date '2026-12-28'), 'Christmas on a Friday, Boxing Day moved to Monday');
select ok(private.is_bank_holiday(date '2027-12-27') and private.is_bank_holiday(date '2027-12-28'), 'Christmas on a Saturday: both moved');
select ok(private.is_bank_holiday(date '2028-01-03'), 'New Year''s Day on a Saturday moves to Monday');
select ok(not private.is_bank_holiday(date '2026-12-29'), 'an ordinary Tuesday');
select is(private.working_day_from(date '2026-12-25'), date '2026-12-29', 'the next working day after Christmas 2026');
select is(private.working_day_from(date '2026-04-03'), date '2026-04-07', 'and after Easter');

-- Checking a quote: admins, PAs and the patient's doctors, for comments the patient agreed to share.
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select throws_ok($$ select public.check_feedback_quote('f2000000-0000-4000-8000-000000000001', true) $$, '42501', null, 'the patient cannot mark a quote checked');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.check_feedback_quote('f2000000-0000-4000-8000-000000000001', true) $$, '42501', null, 'nor can a health coach');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select lives_ok($$ select public.check_feedback_quote('f2000000-0000-4000-8000-000000000001', true) $$, 'a PA checks a quote');
select is((select quote_checked_by from public.patient_feedback where id = 'f2000000-0000-4000-8000-000000000001'), 'b0000000-0000-4000-8000-000000000003'::uuid, 'and is recorded as checking it');
select lives_ok($$ select public.check_feedback_quote('f2000000-0000-4000-8000-000000000001', false) $$, 'and can take the check back');
select is((select quote_checked_at from public.patient_feedback where id = 'f2000000-0000-4000-8000-000000000001'), null, 'which clears it');
select throws_ok($$ select public.check_feedback_quote('f2000000-0000-4000-8000-000000000002', true) $$, '22023', null, 'an unanswered survey has nothing to check');
reset role;
select ok(exists (select 1 from public.audit_log where entity = 'patient_feedback' and entity_id = 'f2000000-0000-4000-8000-000000000001' and action = 'updated'), 'the check is in the audit log');

-- Downloads are logged.
select pg_temp.become('a0000000-0000-4000-8000-000000000006');
select lives_ok($$ select public.log_feedback_export('all', 12) $$, 'an admin''s download is logged');
reset role;
select is(
  (select metadata ->> 'set' || ':' || (metadata ->> 'rows') from public.audit_log where action = 'exported' and entity = 'patient_feedback' order by id desc limit 1),
  'all:12', 'with the download and the number of rows');
select is(
  (select actor_id from public.audit_log where action = 'exported' and entity = 'patient_feedback' order by id desc limit 1),
  'a0000000-0000-4000-8000-000000000006'::uuid, 'and who downloaded it');
select pg_temp.become('a0000000-0000-4000-8000-000000000007');
select throws_ok($$ select public.log_feedback_export('all', 1) $$, '42501', null, 'a nurse cannot download feedback');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.log_feedback_export('everything', 1) $$, '22023', null, 'only the two downloads exist');
reset role;
select ok(not has_function_privilege('anon', 'public.log_feedback_export(text, integer)', 'execute'), 'nobody signed out can log one');

select * from finish();
rollback;
