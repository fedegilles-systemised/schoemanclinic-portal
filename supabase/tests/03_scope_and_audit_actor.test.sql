-- S-10: write policies on a patient's record ask in_scope(). S-07: service-role writes name an actor.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Every policy that writes to or reads a patient's record by patient calls in_scope (S-10).
select is(
  (select coalesce(array_agg(tablename || ': ' || policyname order by tablename, policyname), '{}')
   from pg_policies
   where schemaname = 'public'
     and (tablename, policyname) in (
       ('care_team', 'PAs and doctors add to the care team'),
       ('care_team', 'PAs and doctors change the care team'),
       ('patient_profiles', 'PAs add patient profiles'),
       ('patient_profiles', 'PAs change patient profiles'),
       ('patient_guardians', 'PAs add guardian links'),
       ('patient_guardians', 'PAs change guardian links'),
       ('safeguarding_alerts', 'Doctors read safeguarding alerts'),
       ('safeguarding_alerts', 'Doctors add safeguarding alerts'),
       ('safeguarding_alerts', 'Doctors change safeguarding alerts'),
       ('repeat_requests', 'Patients and guardians who can act, and PAs, add repeat requests'),
       ('result_imports', 'PAs and doctors read result imports'),
       ('result_imports', 'PAs and doctors match and reject result imports')
     )
     and coalesce(qual, '') || coalesce(with_check, '') not like '%in_scope%'),
  '{}'::text[],
  'the listed write policies all call in_scope');
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'import_items' and cmd in ('SELECT', 'UPDATE')
     and coalesce(qual, '') not like '%result_imports%'),
  0, 'import items follow their import');

-- S-07 -----------------------------------------------------------------------------------

create function pg_temp.as_service(_sql text) returns void language plpgsql as $$
begin
  set local role service_role;
  execute _sql;
  reset role;
end;
$$;

select throws_ok(
  $$ select pg_temp.as_service($q$update public.staff_profiles set job_title = 'PA' where user_id = 'a0000000-0000-4000-8000-000000000004'$q$) $$,
  '42501', null, 'a service-role write with no actor is refused');

select set_config('app.actor_id', 'not-a-uuid', true);
select throws_ok(
  $$ select pg_temp.as_service($q$update public.staff_profiles set job_title = 'PA' where user_id = 'a0000000-0000-4000-8000-000000000004'$q$) $$,
  '42501', null, 'and so is one with an invalid actor');
select set_config('app.actor_id', '', true);

select set_config('app.system_actor', 'stripe-webhook', true);
select lives_ok(
  $$ select pg_temp.as_service($q$update public.staff_profiles set job_title = 'PA' where user_id = 'a0000000-0000-4000-8000-000000000004'$q$) $$,
  'a named background job can write');
select is(
  (select metadata ->> 'system' from public.audit_log where entity = 'staff_profiles' order by id desc limit 1),
  'stripe-webhook', 'and the audit log records the job name');
select is(
  (select actor_id from public.audit_log where entity = 'staff_profiles' order by id desc limit 1),
  null, 'with no person');
select set_config('app.system_actor', '', true);

select set_config('app.actor_id', 'a0000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$ select pg_temp.as_service($q$update public.staff_profiles set job_title = 'PA' where user_id = 'a0000000-0000-4000-8000-000000000004'$q$) $$,
  'a service-role write for a named person is allowed');
select is(
  (select actor_id from public.audit_log where entity = 'staff_profiles' order by id desc limit 1),
  'a0000000-0000-4000-8000-000000000001'::uuid, 'and recorded in their name');
select set_config('app.actor_id', '', true);

select lives_ok(
  $$ update public.staff_profiles set job_title = 'PA' where user_id = 'a0000000-0000-4000-8000-000000000004' $$,
  'the database owner, for migrations, the seed and the dashboard, is not refused');

select * from finish();
rollback;
