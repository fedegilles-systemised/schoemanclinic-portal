-- Doctors invite their own patients (decided 11 November 2026). Ids from supabase/seed.sql:
-- Gina (doctor) a..01, staff b..01, on the care team of every patient except d..09.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.hash(_t text) returns text language sql as $$ select encode(sha256(convert_to(_t, 'UTF8')), 'hex') $$;
create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

-- A patient on her care team who has no account and no pending invitation.
create temporary table own on commit drop as
  select p.id from public.patient_profiles p
  join public.care_team ct on ct.patient_id = p.id and ct.staff_id = 'b0000000-0000-4000-8000-000000000001' and ct.until is null
  where p.user_id is null and p.archived_at is null
    and not exists (select 1 from public.invitations i where i.patient_id = p.id and i.accepted_at is null and i.revoked_at is null)
  limit 1;

select ok((select count(*) from own) = 1, 'the seed has a patient of Gina''s to invite');
select lives_ok(
  format($$ select private.create_invitation('a0000000-0000-4000-8000-000000000001', 'patient', 'own.patient@example.test', null, 'patient', %L, null, null, null, pg_temp.hash('d1'), null, true) $$, (select id from own)),
  'a doctor invites her own patient');
select throws_ok(
  $$ select private.create_invitation('a0000000-0000-4000-8000-000000000001', 'patient', 'other@example.test', null, 'patient', 'd0000000-0000-4000-8000-000000000009', null, null, null, pg_temp.hash('d2')) $$,
  '42501', null, 'but not another doctor''s patient');
select throws_ok(
  $$ select private.create_invitation('a0000000-0000-4000-8000-000000000001', 'guardian', 'guard@example.test', null, null, 'd0000000-0000-4000-8000-000000000001', 'parent', false, null, pg_temp.hash('d3')) $$,
  '42501', null, 'a doctor cannot invite a guardian');
select throws_ok(
  $$ select private.create_invitation('a0000000-0000-4000-8000-000000000001', 'team', 'colleague@example.test', null, 'doctor', null, null, null, 'Doctor', pg_temp.hash('d4')) $$,
  '42501', null, 'or a team member');

-- A new patient a doctor adds joins her care team as primary doctor.
select lives_ok(
  $$ select private.create_invitation('a0000000-0000-4000-8000-000000000001', 'patient', 'brand.new@example.test', null, 'patient', null, null, null, null, pg_temp.hash('d5'),
     jsonb_build_object('first_name', 'Brand', 'last_name', 'Newpatient', 'date_of_birth', '1990-01-01')) $$,
  'a doctor adds a new patient');
select is(
  (select ct.relationship::text from public.care_team ct join public.patient_profiles p on p.id = ct.patient_id where p.last_name = 'Newpatient' and ct.staff_id = 'b0000000-0000-4000-8000-000000000001'),
  'primary_doctor', 'who joins her care team as primary doctor');

-- She reads the invitations she sent, and the form lists only her patients.
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.invitations), 2, 'a doctor reads the two invitations she sent');
select ok(not exists (select 1 from public.get_invitable_patients() where id = 'd0000000-0000-4000-8000-000000000009'), 'and the form leaves out patients she does not look after');
reset role;

-- She can cancel her own patient's invitation, not one for someone else's patient.
select lives_ok(
  format($$ select private.revoke_invitation('a0000000-0000-4000-8000-000000000001', %L) $$, (select id from public.invitations where email = 'own.patient@example.test')),
  'a doctor cancels an invitation for her own patient');
select lives_ok(
  $$ select private.create_invitation('a0000000-0000-4000-8000-000000000003', 'patient', 'priya.sent@example.test', null, 'patient', 'd0000000-0000-4000-8000-000000000009', null, null, null, pg_temp.hash('d6'), null, true) $$,
  'a PA invites a patient Gina does not look after');
select throws_ok(
  format($$ select private.revoke_invitation('a0000000-0000-4000-8000-000000000001', %L) $$, (select id from public.invitations where email = 'priya.sent@example.test')),
  '42501', null, 'and Gina cannot cancel it');

select * from finish();
rollback;
