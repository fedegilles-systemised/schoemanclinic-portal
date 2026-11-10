-- The nurse role, gender identity, record-open logging and the admin's activity log.
-- Fixed ids come from supabase/seed.sql.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create schema t;

create function t.become(_user uuid) returns void language plpgsql as $$
begin
  if _user is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
end;
$$;

-- Runs a statement as someone and gives back its single value as text, then returns to postgres.
create function t.val(_user uuid, _sql text) returns text language plpgsql as $$
declare result text;
begin
  perform t.become(_user);
  execute _sql into result;
  reset role;
  return result;
end;
$$;

grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;

select set_config('app.system_actor', 'nurse-activity-test', true);

create function t.priya() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000003'::uuid $$;
create function t.gina() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000001'::uuid $$;
create function t.admin() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000006'::uuid $$;
create function t.nora() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000007'::uuid $$;
create function t.eleanor() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000011'::uuid $$;
create function t.p_eleanor() returns uuid language sql immutable as $$ select 'd0000000-0000-4000-8000-000000000001'::uuid $$;

-- The nurse --------------------------------------------------------------------------------------

select is((select clinical_role::text from public.staff_profiles where user_id = t.nora()), 'nurse', 'the seeded nurse has a staff profile');
select is(t.val(t.nora(), 'select private.has_role(''nurse'')'), 'true', 'the nurse holds the nurse role');
select is(t.val(t.nora(), 'select private.is_clinical_staff()'), 'false', 'a nurse is not clinical staff yet');
select is(t.val(t.nora(), 'select count(*) from public.patient_profiles'), '0', 'a nurse sees no patient');
select is(t.val(t.nora(), 'select count(*) from public.lab_reports'), '0', 'a nurse sees no lab report');
select is(t.val(t.nora(), 'select count(*) from public.results'), '0', 'a nurse sees no result');

select lives_ok($$ insert into public.invitations (kind, email, role, invited_by, token_hash, expires_at)
  select 'team', 'new.nurse@example.test', 'nurse', s.id, repeat('a', 64), now() + interval '3 days'
  from public.staff_profiles s where s.user_id = t.admin() $$, 'a nurse can be invited to the team');

-- Gender identity --------------------------------------------------------------------------------

select lives_ok($$ select t.val(t.priya(), format($q$ update public.patient_profiles set gender_identity = 'woman' where id = %L returning gender_identity $q$, t.p_eleanor())) $$, 'a PA can record gender identity');
select is((select gender_identity from public.patient_profiles where id = t.p_eleanor()), 'woman', 'and it is kept beside sex at birth');
select throws_ok($$ select t.val(t.priya(), format($q$ update public.patient_profiles set gender_identity = %L where id = %L returning 1 $q$, repeat('x', 61), t.p_eleanor())) $$, '23514', null, 'gender identity has a length limit');
select is(t.val(t.eleanor(), format($q$ with u as (update public.patient_profiles set gender_identity = 'x' where id = %L returning 1) select count(*) from u $q$, t.p_eleanor())), '0', 'a patient cannot change it on their own record');

-- Opening a record is logged ----------------------------------------------------------------------

select is((select count(*)::int from public.audit_log where action = 'viewed' and entity = 'patient_profiles' and actor_id = t.priya()), 0, 'nothing is logged before a record is opened');
select lives_ok($$ select t.val(t.priya(), format($q$ select public.log_record_view(%L, 'patient_profiles')::text $q$, t.p_eleanor())) $$, 'a PA opening a record is logged');
select is((select count(*)::int from public.audit_log where action = 'viewed' and entity = 'patient_profiles' and actor_id = t.priya()), 1, 'with one row');
select lives_ok($$ select t.val(t.priya(), format($q$ select public.log_record_view(%L, 'patient_profiles')::text $q$, t.p_eleanor())) $$, 'opening it again straight away is fine');
select is((select count(*)::int from public.audit_log where action = 'viewed' and entity = 'patient_profiles' and actor_id = t.priya()), 1, 'and is not written twice');
select is((select actor_role::text from public.audit_log where action = 'viewed' and actor_id = t.priya()), 'pa', 'the row says which role opened it');
select is((select metadata ->> 'patient_id' from public.audit_log where action = 'viewed' and actor_id = t.priya()), t.p_eleanor()::text, 'and for which patient');
select lives_ok($$ select t.val(t.gina(), format($q$ select public.log_record_view(%L, 'lab_reports', %L)::text $q$, t.p_eleanor(), (select id from public.lab_reports where patient_id = t.p_eleanor() limit 1))) $$, 'a doctor opening a report is logged');
select throws_ok($$ select t.val(t.gina(), format($q$ select public.log_record_view(%L, 'lab_reports', gen_random_uuid())::text $q$, t.p_eleanor())) $$, '22023', null, 'an id that is not a report is refused');
select throws_ok($$ select t.val(t.gina(), format($q$ select public.log_record_view(%L, 'lab_reports', %L)::text $q$, 'd0000000-0000-4000-8000-000000000002'::uuid, (select id from public.lab_reports where patient_id = t.p_eleanor() limit 1))) $$, '22023', null, 'one patient''s report cannot be logged under another patient');
select throws_ok($$ select t.val(t.gina(), format($q$ select public.log_record_view(%L, 'lab_reports')::text $q$, t.p_eleanor())) $$, '22023', null, 'a report view must name the report');
select throws_ok($$ select t.val(t.priya(), format($q$ select public.log_record_view(%L, 'patient_profiles', gen_random_uuid())::text $q$, t.p_eleanor())) $$, '22023', null, 'a patient record view cannot name another id');

select throws_ok($$ select t.val(t.eleanor(), format($q$ select public.log_record_view(%L, 'patient_profiles')::text $q$, t.p_eleanor())) $$, '42501', null, 'a patient cannot write to the log');
select throws_ok($$ select t.val(t.admin(), format($q$ select public.log_record_view(%L, 'patient_profiles')::text $q$, t.p_eleanor())) $$, '42501', null, 'an admin cannot write to the log');
select throws_ok($$ select t.val(t.nora(), format($q$ select public.log_record_view(%L, 'patient_profiles')::text $q$, t.p_eleanor())) $$, '42501', null, 'a nurse cannot write to the log');
select throws_ok($$ select t.val(t.priya(), format($q$ select public.log_record_view(%L, 'profiles')::text $q$, t.p_eleanor())) $$, '22023', null, 'only a patient record or a report can be named');
select throws_ok($$ select t.val(null, format($q$ select public.log_record_view(%L, 'patient_profiles')::text $q$, t.p_eleanor())) $$, '42501', null, 'someone signed out cannot write to the log');

-- The admin's activity log ----------------------------------------------------------------------

select cmp_ok(t.val(t.admin(), 'select count(*) from public.activity_log()')::int, '>=', 2, 'an admin reads the activity log');
select is(t.val(t.admin(), $q$ select patient_name from public.activity_log() where action = 'viewed' and entity = 'patient_profiles' limit 1 $q$), 'Eleanor Hart', 'it names the patient');
select is(t.val(t.admin(), $q$ select actor_name from public.activity_log() where action = 'viewed' and entity = 'patient_profiles' limit 1 $q$), 'Priya Shah', 'and who opened the record');
select cmp_ok(t.val(t.admin(), 'select count(*) from public.activity_log(1)')::int, '=', 1, 'a page can be limited');
select cmp_ok(t.val(t.admin(), 'select count(*) from public.activity_log(100000)')::int, '<=', 100, 'and a page never holds more than 100');
select is(t.val(t.admin(), $q$ select count(*) from public.activity_log(100) where entity in ('safeguarding_alerts', 'diagnoses', 'medications', 'allergies') $q$), '0', 'it never shows safeguarding, diagnosis, medicine or allergy events');
select cmp_ok((select count(*)::int from public.audit_log where entity in ('safeguarding_alerts', 'diagnoses')), '>', 0, 'although the audit table does hold some');
select throws_ok($$ select t.val(t.priya(), 'select count(*) from public.activity_log()') $$, '42501', null, 'a PA cannot read it');
select throws_ok($$ select t.val(t.gina(), 'select count(*) from public.activity_log()') $$, '42501', null, 'nor a doctor');
select throws_ok($$ select t.val(t.nora(), 'select count(*) from public.activity_log()') $$, '42501', null, 'nor a nurse');
select throws_ok($$ select t.val(t.eleanor(), 'select count(*) from public.activity_log()') $$, '42501', null, 'nor a patient');
select throws_ok($$ select t.val(null, 'select count(*) from public.activity_log()') $$, '42501', null, 'nor someone signed out');

select ok(not has_function_privilege('anon', 'public.log_record_view(uuid, text, uuid)', 'execute'), 'anon cannot log a view');
select ok(not has_function_privilege('anon', 'public.activity_log(integer, bigint)', 'execute'), 'or read the log');
select ok(not has_table_privilege('authenticated', 'public.audit_log', 'select'), 'nobody reads the audit table directly');

select * from finish();
rollback;
