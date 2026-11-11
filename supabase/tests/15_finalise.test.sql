-- The points finalised on 14 November 2026 (20261114120000_finalise_hardening.sql). Ids from supabase/seed.sql.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;
create function pg_temp.hash(_t text) returns text language sql as $$ select encode(sha256(convert_to(_t, 'UTF8')), 'hex') $$;

-- C88: a removed guardian can be invited again, and accepting turns the old link back on.
-- Seed: guardian a..22 views Thomas? No: a..22 is a carer of d..06 (can_view, not can_act).
update public.patient_guardians set can_view = false, can_act = false where patient_id = 'd0000000-0000-4000-8000-000000000006' and guardian_user_id = 'a0000000-0000-4000-8000-000000000022';
select lives_ok(
  $$ select private.create_invitation('a0000000-0000-4000-8000-000000000003', 'guardian', (select email from auth.users where id = 'a0000000-0000-4000-8000-000000000022'), null, null, 'd0000000-0000-4000-8000-000000000006', 'carer', false, null, pg_temp.hash('g1')) $$,
  'a removed guardian can be invited again');

-- C77: the care-team role must match the person's role.
select throws_ok(
  $$ insert into public.care_team (patient_id, staff_id, relationship) values ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', 'primary_doctor') $$,
  '22023', null, 'a PA cannot be put on a care team as a doctor');
select lives_ok(
  $$ insert into public.care_team (patient_id, staff_id, relationship) values ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000005', 'health_coach') $$,
  'a health coach can be added as health coach');

-- S-125: removing a guardian cannot rename who verified the link.
select pg_temp.become('a0000000-0000-4000-8000-000000000004');
select throws_ok(
  $$ update public.patient_guardians set can_view = false, can_act = false, verified_by = 'b0000000-0000-4000-8000-000000000001' where patient_id = 'd0000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'a PA cannot name someone else as the verifier');
select lives_ok(
  $$ update public.patient_guardians set can_view = false, can_act = false where patient_id = 'd0000000-0000-4000-8000-00000000000a' $$,
  'but can remove the guardian');
reset role;

-- S-107: a leaver's Google connection goes at once.
set local role service_role;
select public.save_google_calendar_connection('a0000000-0000-4000-8000-000000000001', 'gina@example.test', 'v1.x', 'openid');
reset role;
update public.staff_profiles set active = false where user_id = 'a0000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.google_calendar_connections where user_id = 'a0000000-0000-4000-8000-000000000001'), 0, 'switching a team member off removes their Google connection');
select is((select count(*)::int from public.google_revocations where user_id = 'a0000000-0000-4000-8000-000000000001' and revoked_at is null and refresh_token_encrypted = 'v1.x'), 1, 'and queues the token to be revoked at Google');
update public.staff_profiles set active = true where user_id = 'a0000000-0000-4000-8000-000000000001';

-- S-126: a recording file needs its own open recording row, at exactly its path.
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('recordings', 'd0000000-0000-4000-8000-000000000001/no-row.webm') $$,
  '42501', null, 'no recording file without a recording row');
insert into public.call_recordings (patient_id, recorded_by, storage_path) values ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001/with-row.webm');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('recordings', 'd0000000-0000-4000-8000-000000000001/with-row.webm') $$,
  'the file for an open recording row is accepted');
reset role;

-- C79: an unpublished course's assignment is hidden from the patient.
insert into public.education_courses (id, title, created_by, published) values ('e1000000-0000-4000-8000-0000000000aa', 'Hidden', 'b0000000-0000-4000-8000-000000000006', false);
insert into public.education_assignments (course_id, patient_id, assigned_by) values ('e1000000-0000-4000-8000-0000000000aa', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006');
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from public.education_assignments where course_id = 'e1000000-0000-4000-8000-0000000000aa'), 0, 'a patient does not see the assignment of an unpublished course');

-- S-116: the database checks wearable readings too.
select throws_ok(
  $$ insert into public.wearable_readings (patient_id, metric, value, measured_on, entered_by) values ('d0000000-0000-4000-8000-000000000001', 'steps', 100, current_date + 5, 'a0000000-0000-4000-8000-000000000011') $$,
  '22023', null, 'no reading dated in the future');
select throws_ok(
  $$ insert into public.wearable_readings (patient_id, metric, value, measured_on, entered_by) values ('d0000000-0000-4000-8000-000000000001', 'resting_heart_rate', 900, current_date - 1, 'a0000000-0000-4000-8000-000000000011') $$,
  '22023', null, 'no reading outside its range');
reset role;

select * from finish();
rollback;
