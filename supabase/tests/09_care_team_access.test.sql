-- Access by care team, as decided by the clinic on 11 November 2026: PAs and admins see every
-- patient; doctors, nurses and health coaches see only the patients whose care team they are on.
-- Fixed ids come from supabase/seed.sql. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create schema t;

create function t.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function t.n(_user uuid, _sql text) returns int language plpgsql as $$
declare result int;
begin
  perform t.become(_user);
  execute format('select count(*) from (%s) q', _sql) into result;
  reset role;
  return result;
end;
$$;

create function t.run(_user uuid, _sql text) returns int language plpgsql as $$
declare affected int;
begin
  perform t.become(_user);
  execute _sql;
  get diagnostics affected = row_count;
  reset role;
  return affected;
end;
$$;

grant usage on schema t to authenticated;
grant execute on all functions in schema t to authenticated;

-- People (user ids) and their staff ids.
create function t.gina() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000001'::uuid $$;
create function t.laura() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000002'::uuid $$;
create function t.priya() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000003'::uuid $$;
create function t.coach() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000005'::uuid $$;
create function t.admin() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000006'::uuid $$;
create function t.nora() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000007'::uuid $$;
create function t.s_laura() returns uuid language sql immutable as $$ select 'b0000000-0000-4000-8000-000000000002'::uuid $$;
create function t.s_coach() returns uuid language sql immutable as $$ select 'b0000000-0000-4000-8000-000000000005'::uuid $$;
create function t.s_nora() returns uuid language sql immutable as $$ select 'b0000000-0000-4000-8000-000000000007'::uuid $$;
-- Patients: Eleanor (Gina's), Daniel (Gina's), and patient 9 (Laura's).
create function t.p_eleanor() returns uuid language sql immutable as $$ select 'd0000000-0000-4000-8000-000000000001'::uuid $$;
create function t.p_daniel() returns uuid language sql immutable as $$ select 'd0000000-0000-4000-8000-000000000007'::uuid $$;
create function t.p_nine() returns uuid language sql immutable as $$ select 'd0000000-0000-4000-8000-000000000009'::uuid $$;

-- PAs and admins see every patient ------------------------------------------------------------

select is(t.n(t.priya(), 'select * from public.patient_profiles'), (select count(*)::int from public.patient_profiles), 'a PA reads every patient');
select is(t.n(t.admin(), 'select * from public.patient_profiles'), (select count(*)::int from public.patient_profiles), 'an admin reads every patient');
select cmp_ok(t.n(t.admin(), 'select * from public.diagnoses'), '>', 0, 'an admin reads diagnoses');
select is(t.n(t.admin(), 'select * from public.safeguarding_alerts'), 0, 'but safeguarding alerts stay with doctors');
select throws_ok(
  format($$ select t.run(t.admin(), $q$insert into public.diagnoses (patient_id, label) values (%L, 'Test')$q$) $$, t.p_eleanor()),
  '42501', null, 'and an admin cannot record a diagnosis');

-- Doctors see their care team's patients only ------------------------------------------------

select is(t.n(t.laura(), format('select * from public.patient_profiles where id = %L', t.p_eleanor())), 0, 'a doctor does not see a patient she does not look after');
select is(t.n(t.laura(), format('select * from public.patient_profiles where id = %L', t.p_nine())), 1, 'and sees the patient she does');
select is(t.n(t.laura(), format('select * from public.lab_reports where patient_id = %L', t.p_eleanor())), 0, 'nor that patient''s reports');

-- A PA adds the doctor to the care team, and access follows straight away.
select is(
  t.run(t.priya(), format($q$insert into public.care_team (patient_id, staff_id, relationship) values (%L, %L, 'doctor')$q$, t.p_eleanor(), t.s_laura())),
  1, 'a PA adds a doctor to a care team');
select is(t.n(t.laura(), format('select * from public.patient_profiles where id = %L', t.p_eleanor())), 1, 'and the doctor now sees the patient');

-- Setting the leaving day to today ends access at once.
select is(
  t.run(t.priya(), format($q$update public.care_team set until = private.london_today() where patient_id = %L and staff_id = %L$q$, t.p_eleanor(), t.s_laura())),
  1, 'a PA ends a care team membership');
select is(t.n(t.laura(), format('select * from public.patient_profiles where id = %L', t.p_eleanor())), 0, 'and the doctor no longer sees the patient');

-- A membership that starts in the future gives nothing yet.
insert into public.care_team (patient_id, staff_id, relationship, since) values (t.p_daniel(), t.s_laura(), 'doctor', private.london_today() + 7);
select is(t.n(t.laura(), format('select * from public.patient_profiles where id = %L', t.p_daniel())), 0, 'a membership that starts next week gives no access today');

-- Health coaches see everything on their own clients ------------------------------------------

insert into public.care_team (patient_id, staff_id, relationship) values (t.p_eleanor(), t.s_coach(), 'health_coach');
select is(t.n(t.coach(), 'select * from public.patient_profiles'), 1, 'a health coach sees only their client');
select cmp_ok(t.n(t.coach(), 'select * from public.diagnoses'), '>', 0, 'including diagnoses');
select cmp_ok(t.n(t.coach(), 'select * from public.lab_reports where released_at is null'), '>', 0, 'and reports not yet released');
select is(t.n(t.coach(), format('select * from public.results where patient_id <> %L', t.p_eleanor())), 0, 'but no other patient''s results');
select is(t.n(t.coach(), 'select * from public.safeguarding_alerts'), 0, 'and no safeguarding alerts');
select throws_ok(
  format($$ select t.run(t.coach(), $q$insert into public.care_team (patient_id, staff_id, relationship) values (%L, %L, 'health_coach')$q$) $$, t.p_daniel(), t.s_coach()),
  '42501', null, 'a health coach cannot add themselves to another patient''s care team');

-- Nurses work like doctors on their own patients -----------------------------------------------

select is(t.n(t.nora(), 'select * from public.patient_profiles'), 0, 'a nurse on no care team sees nobody');
insert into public.care_team (patient_id, staff_id, relationship) values (t.p_eleanor(), t.s_nora(), 'nurse');
select is(t.n(t.nora(), 'select * from public.patient_profiles'), 1, 'a nurse sees the patient on her care team');
select cmp_ok(t.n(t.nora(), 'select * from public.lab_reports'), '>', 0, 'and her reports');
select is(
  t.run(t.nora(), format($q$insert into public.patient_allergies (patient_id, substance, recorded_by) values (%L, 'Latex', %L)$q$, t.p_eleanor(), t.s_nora())),
  1, 'a nurse records an allergy');
select throws_ok(
  format($$ select t.run(t.nora(), $q$insert into public.diagnoses (patient_id, label, recorded_by) values (%L, 'Test', %L)$q$) $$, t.p_eleanor(), t.s_nora()),
  '42501', null, 'a nurse cannot record a diagnosis');
select throws_ok(
  format($$ select t.run(t.nora(), $q$select public.release_report(%L)$q$) $$, (select id from public.lab_reports where patient_id = t.p_eleanor() and released_at is null limit 1)),
  '42501', null, 'a nurse cannot release results to the patient');
select is(t.n(t.nora(), 'select * from public.safeguarding_alerts'), 0, 'a nurse reads no safeguarding alerts');
select lives_ok(
  format($$ select t.n(t.nora(), $q$select public.log_record_view(%L, 'patient_profiles')$q$) $$, t.p_eleanor()),
  'a nurse opening her patient''s record is logged');

-- Who keeps the care team ------------------------------------------------------------------------

select is(
  t.run(t.admin(), format($q$insert into public.care_team (patient_id, staff_id, relationship) values (%L, %L, 'doctor')$q$, t.p_daniel(), t.s_laura())),
  1, 'an admin adds to a care team');
select is(t.n(t.nora(), 'select * from public.care_team'), (select count(*)::int from public.care_team where patient_id = t.p_eleanor()), 'a nurse reads the care team of her own patients only');

-- Nobody opens their own record as staff ---------------------------------------------------------

-- Dr Laura Bennett is also a patient (record d..0b). Gina is on that record's care team.
select throws_ok(
  $$ select t.run(t.admin(), $q$insert into public.care_team (patient_id, staff_id, relationship) values ('d0000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000002', 'doctor')$q$) $$,
  '42501', null, 'nobody can put a doctor on her own care team');
select is(t.n(t.laura(), $q$select * from public.lab_reports where patient_id = 'd0000000-0000-4000-8000-00000000000b' and released_at is null$q$), 0, 'a doctor does not see her own unreleased results');
select is(t.n(t.laura(), $q$select * from public.safeguarding_alerts where patient_id = 'd0000000-0000-4000-8000-00000000000b'$q$), 0, 'or safeguarding alerts about herself');
-- A PA who is also a patient sees every patient but herself.
insert into public.patient_profiles (id, user_id, clinic_ref, first_name, last_name, date_of_birth)
  values ('d0000000-0000-4000-8000-0000000000aa', t.priya(), 'SC-999999', 'Priya', 'Shah', '1990-01-01');
insert into public.user_roles (user_id, role) values (t.priya(), 'patient') on conflict do nothing;
select is(t.n(t.priya(), $q$select * from public.lab_reports where patient_id = 'd0000000-0000-4000-8000-0000000000aa'$q$), 0, 'a PA who is a patient does not open her own record as staff');
select cmp_ok(t.n(t.priya(), 'select * from public.patient_profiles'), '>', 1, 'but still sees every other patient');

-- The care team list follows the same rule: a doctor sees only her own patients' teams.
select is(t.n(t.laura(), $q$select * from public.care_team where patient_id = 'd0000000-0000-4000-8000-000000000001'$q$), 0, 'a doctor does not read the care team of a patient she does not look after');

select * from finish();
rollback;
