-- Invitations: who may send which kind, the accept checks, and who can read what.
-- Ids from supabase/seed.sql: Gina (doctor) a..01, Priya (PA) a..03, Tom (PA) a..04, admin a..06,
-- Eleanor (patient) a..11. Staff ids b..NN. Claire Benson (no account) is d..04.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.hash(_label text) returns text language sql as $$ select encode(sha256(_label::bytea), 'hex') $$;

create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

-- These patients have no contact email on file, so the matching check does not apply to them
-- until a test below says so.
update public.patient_profiles set contact_email = null where id in (
  'd0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000007'
);

-- Who may send which kind --------------------------------------------------------------

select lives_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000003', 'patient', 'newpatient@example.test', null, 'patient', 'd0000000-0000-4000-8000-000000000005', null, null, null, pg_temp.hash('t1')) $$, 'a PA can invite a patient');
select lives_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000003', 'guardian', 'guardian1@example.test', 'Pat Guardian', null, 'd0000000-0000-4000-8000-000000000005', 'parent', true, null, pg_temp.hash('t2')) $$, 'a PA can invite a guardian');
select throws_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000003', 'team', 'newpa@example.test', null, 'pa', null, null, null, 'PA', pg_temp.hash('t3')) $$, '42501', null, 'a PA cannot invite team members');
-- Since 11 November a doctor invites patients, but only their own (10_doctor_invitations covers the rest).
select throws_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000001', 'patient', 'doc@example.test', null, 'patient', 'd0000000-0000-4000-8000-000000000009', null, null, null, pg_temp.hash('t4')) $$, '42501', null, 'a doctor cannot invite a patient she does not look after');
select throws_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000011', 'patient', 'pat@example.test', null, 'patient', 'd0000000-0000-4000-8000-000000000006', null, null, null, pg_temp.hash('t5')) $$, '42501', null, 'a patient cannot invite anyone');
select lives_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000006', 'team', 'newdoc@example.test', null, 'doctor', null, null, null, 'Doctor', pg_temp.hash('t6')) $$, 'an admin can invite a team member');
select lives_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000006', 'patient', 'p2@example.test', null, 'patient', 'd0000000-0000-4000-8000-000000000006', null, null, null, pg_temp.hash('t7')) $$, 'an admin can invite a patient');
select lives_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000006', 'team', 'newadmin@example.test', null, 'admin', null, null, null, 'Administrator', pg_temp.hash('t8')) $$, 'an admin can invite another admin');
select throws_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000006', 'team', 'newpat@example.test', null, 'patient', null, null, null, null, pg_temp.hash('t9')) $$, '22023', null, 'a team invitation cannot carry the patient role');

-- Checks while creating -----------------------------------------------------------------
select throws_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000003', 'patient', 'newpatient@example.test', null, 'patient', 'd0000000-0000-4000-8000-000000000007', null, null, null, pg_temp.hash('t10')) $$, '23505', null, 'a second pending invitation to the same address is refused');
select throws_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000003', 'patient', 'someone@example.test', null, 'patient', 'd0000000-0000-4000-8000-000000000001', null, null, null, pg_temp.hash('t11')) $$, '23505', null, 'a patient who already has an account cannot be invited again');
select throws_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000003', 'patient', 'x', null, 'patient', 'd0000000-0000-4000-8000-000000000007', null, null, null, pg_temp.hash('t12')) $$, '22023', null, 'an address that is not an address is refused');
select throws_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000006', 'team', 'admin@example.test', null, 'admin', null, null, null, null, pg_temp.hash('t13')) $$, '22023', null, 'nobody can invite themselves');
select throws_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000006', 'team', 'gina.schoeman@example.test', null, 'pa', null, null, null, null, pg_temp.hash('t14')) $$, '23505', null, 'a person who already has a staff profile cannot be invited to another role');
select throws_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000003', 'guardian', 'eleanor.hart@example.test', null, null, 'd0000000-0000-4000-8000-000000000001', 'parent', false, null, pg_temp.hash('t15')) $$, '22023', null, 'a patient cannot be their own guardian');
select lives_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000003', 'patient', 'brandnew@example.test', null, 'patient', null, null, null, null, pg_temp.hash('t16'), '{"first_name":"Nina","last_name":"Patel","date_of_birth":"1990-05-05"}') $$, 'a PA can create a minimal patient record with the invitation');
-- A sequence is not rolled back, so the number depends on earlier runs: check its shape.
select matches((select clinic_ref from public.patient_profiles where last_name = 'Patel'), '^SC-1[0-9]{5}$', 'and it gets the next clinic reference');
select is((select count(*)::int from public.audit_log where entity = 'invitations' and action = 'created' and actor_id = 'a0000000-0000-4000-8000-000000000003'), 3, 'the audit log names the PA who sent each invitation');

select throws_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000003', 'patient', 'second.try@example.test', null, 'patient', 'd0000000-0000-4000-8000-000000000005', null, null, null, pg_temp.hash('t19')) $$, '23505', null, 'a second live invitation for one patient record is refused');

-- Look up ------------------------------------------------------------------------------
select is((select status from private.get_invitation(pg_temp.hash('t1'))), 'valid', 'a new invitation is valid');
select is((select inviter_name from private.get_invitation(pg_temp.hash('t1'))), 'Priya Shah', 'it names the inviter');
select is((select status from private.get_invitation(pg_temp.hash('nothing'))), 'not_found', 'an unknown link is not found');
select is((select account_exists from private.get_invitation(pg_temp.hash('t1'))), false, 'and says there is no account yet');
select is((select status from private.get_invitation('demo-hash-not-a-real-token-1111111111')), 'expired', 'an old invitation is expired');
select is((select count(*)::int from public.invitations where accepted_at is not null), 0, 'looking up an invitation uses nothing up');

-- Accept: patient -------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values ('a0000000-0000-4000-8000-0000000000e1', 'newpatient@example.test', 'authenticated', 'authenticated');
select throws_ok($$ select private.accept_invitation(pg_temp.hash('t1'), 'a0000000-0000-4000-8000-000000000011') $$, '22023', null, 'an account with another email cannot accept');
select is((select private.accept_invitation(pg_temp.hash('t1'), 'a0000000-0000-4000-8000-0000000000e1', 'Newly Patient', '1968-05-19')), 'patient'::public.invitation_kind, 'the right account accepts a patient invitation');
select is((select user_id from public.patient_profiles where id = 'd0000000-0000-4000-8000-000000000005'), 'a0000000-0000-4000-8000-0000000000e1'::uuid, 'and is linked to the patient record');
select is((select count(*)::int from public.user_roles where user_id = 'a0000000-0000-4000-8000-0000000000e1' and role = 'patient' and granted_by = 'a0000000-0000-4000-8000-000000000003'), 1, 'with the patient role, granted by the PA');
select is((select status::text from public.profiles where id = 'a0000000-0000-4000-8000-0000000000e1'), 'active', 'the account is active');
select is((select full_name from public.profiles where id = 'a0000000-0000-4000-8000-0000000000e1'), 'Newly Patient', 'with the name they gave');
select throws_ok($$ select private.accept_invitation(pg_temp.hash('t1'), 'a0000000-0000-4000-8000-0000000000e1') $$, '22023', null, 'the same link cannot be used twice');
select is((select count(*)::int from public.notifications where user_id = 'a0000000-0000-4000-8000-000000000003' and title like '% accepted your invitation'), 1, 'the PA is told in the portal');
select is((select actor_id from public.audit_log where entity = 'user_roles' and action = 'created' order by id desc limit 1), 'a0000000-0000-4000-8000-000000000003'::uuid, 'and the role grant is logged in the PA''s name');

-- Accept: guardian ------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values ('a0000000-0000-4000-8000-0000000000e2', 'guardian1@example.test', 'authenticated', 'authenticated');
select is((select private.accept_invitation(pg_temp.hash('t2'), 'a0000000-0000-4000-8000-0000000000e2', null, '1968-05-19')), 'guardian'::public.invitation_kind, 'a guardian accepts');
select is((select can_act from public.patient_guardians where guardian_user_id = 'a0000000-0000-4000-8000-0000000000e2'), true, 'with the permission that was chosen');
select is((select verified_by from public.patient_guardians where guardian_user_id = 'a0000000-0000-4000-8000-0000000000e2'), 'b0000000-0000-4000-8000-000000000003'::uuid, 'verified by the PA');
select is((select count(*)::int from public.user_roles where user_id = 'a0000000-0000-4000-8000-0000000000e2'), 0, 'and holds no role of their own');

-- Accept: team -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values ('a0000000-0000-4000-8000-0000000000e3', 'newdoc@example.test', 'authenticated', 'authenticated');
select is((select private.accept_invitation(pg_temp.hash('t6'), 'a0000000-0000-4000-8000-0000000000e3', 'Dr New')), 'team'::public.invitation_kind, 'a team member accepts');
select is((select clinical_role::text || '/' || active::text || '/' || job_title from public.staff_profiles where user_id = 'a0000000-0000-4000-8000-0000000000e3'), 'doctor/true/Doctor', 'and gets an active staff profile');
select ok(private.person_has_role('a0000000-0000-4000-8000-0000000000e3', 'doctor'), 'and the doctor role');

-- A guardian link for an archived patient is not accepted, and the link reads as no longer valid.
select lives_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000003', 'guardian', 'late.guardian@example.test', null, null, 'd0000000-0000-4000-8000-000000000007', 'carer', false, null, pg_temp.hash('t20')) $$, 'a guardian invitation for another patient');
update public.patient_profiles set archived_at = now() where id = 'd0000000-0000-4000-8000-000000000007';
select is((select status from private.get_invitation(pg_temp.hash('t20'))), 'cancelled', 'a link for an archived patient reads as no longer valid');
update public.patient_profiles set archived_at = null where id = 'd0000000-0000-4000-8000-000000000007';

-- Accept checks ------------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values ('a0000000-0000-4000-8000-0000000000e4', 'new.doctor@example.test', 'authenticated', 'authenticated');
select throws_ok($$ select private.accept_invitation('demo-hash-not-a-real-token-1111111111', 'a0000000-0000-4000-8000-0000000000e4') $$, '22023', null, 'an expired invitation cannot be accepted');

-- A cancelled invitation, and one whose inviter has left.
insert into auth.users (id, email, aud, role) values ('a0000000-0000-4000-8000-0000000000e5', 'newadmin@example.test', 'authenticated', 'authenticated');
select lives_ok($$ select private.revoke_invitation('a0000000-0000-4000-8000-000000000006', (select id from public.invitations where token_hash = pg_temp.hash('t8'))) $$, 'an admin can cancel an invitation');
select throws_ok($$ select private.accept_invitation(pg_temp.hash('t8'), 'a0000000-0000-4000-8000-0000000000e5') $$, '22023', null, 'a cancelled invitation cannot be accepted');
select is((select status from private.get_invitation(pg_temp.hash('t8'))), 'cancelled', 'and says so');

insert into auth.users (id, email, aud, role) values ('a0000000-0000-4000-8000-0000000000e6', 'p2@example.test', 'authenticated', 'authenticated');
update public.staff_profiles set active = false where user_id = 'a0000000-0000-4000-8000-000000000006';
select throws_ok($$ select private.accept_invitation(pg_temp.hash('t7'), 'a0000000-0000-4000-8000-0000000000e6') $$, '22023', null, 'an invitation from someone who has since been deactivated cannot be accepted');
select is((select status from private.get_invitation(pg_temp.hash('t7'))), 'cancelled', 'and reads as cancelled');
update public.staff_profiles set active = true where user_id = 'a0000000-0000-4000-8000-000000000006';

-- Resend replaces the old link ---------------------------------------------------------------
select lives_ok($$ select private.resend_invitation('a0000000-0000-4000-8000-000000000003', (select id from public.invitations where token_hash = pg_temp.hash('t16')), pg_temp.hash('t17')) $$, 'a PA can resend');
select is((select status from private.get_invitation(pg_temp.hash('t16'))), 'cancelled', 'the old link stops working');
select is((select status from private.get_invitation(pg_temp.hash('t17'))), 'valid', 'and the new one works');
select throws_ok($$ select private.resend_invitation('a0000000-0000-4000-8000-000000000003', (select id from public.invitations where kind = 'team' and revoked_at is null limit 1), pg_temp.hash('t18')) $$, '42501', null, 'a PA cannot resend a team invitation');
select ok((select expires_at from private.get_invitation(pg_temp.hash('t17'))) <= now() + interval '3 days', 'a link lasts 3 days');

-- Who can read what ----------------------------------------------------------------------------
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select ok((select count(*) from public.invitations where kind = 'patient') > 0, 'a PA reads patient invitations');
select is((select count(*)::int from public.invitations where kind = 'team'), 0, 'but not team ones');
select throws_ok($$ select token_hash from public.invitations $$, '42501', null, 'nobody reads a token hash');
select ok((select count(*) from public.get_invitable_patients()) > 0, 'a PA gets the patient list for the form');
reset role;

select pg_temp.become('a0000000-0000-4000-8000-000000000006');
select ok((select count(*) from public.invitations where kind = 'team') > 0, 'an admin reads team invitations');
select ok((select count(*) from public.invitations where kind = 'patient') > 0, 'and patient ones');
select ok((select count(*) from public.get_invitable_patients()) > 0, 'an admin gets the patient list for the form');
select ok((select count(*) from public.patient_profiles) > 0, 'and, since 11 November, every patient record');
reset role;

select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.invitations), 0, 'a doctor who sent none reads no invitations');
select is((select count(*)::int from public.get_invitable_patients()), (select count(*)::int from public.care_team ct join public.patient_profiles p on p.id = ct.patient_id where ct.staff_id = 'b0000000-0000-4000-8000-000000000001' and ct.until is null and p.archived_at is null), 'and gets only her own patients for the form');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from public.invitations), 0, 'a patient reads no invitations');
reset role;

-- The functions are server only ---------------------------------------------------------------
select ok(not has_function_privilege('authenticated', 'public.create_invitation(uuid, public.invitation_kind, text, text, text, public.app_role, uuid, public.guardian_relationship, boolean, text, jsonb, boolean)', 'execute'), 'signed-in users cannot call create');
select ok(not has_function_privilege('anon', 'public.accept_invitation(text, uuid, text, date)', 'execute'), 'anon cannot call accept');
select ok(has_function_privilege('service_role', 'public.accept_invitation(text, uuid, text, date)', 'execute'), 'the service role can');

-- Proof of identity ---------------------------------------------------------------------------
-- Hannah Price (d..08) has a contact email on file. A different address needs confirming.
select throws_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000003', 'patient', 'someone.else@example.test', null, 'patient', 'd0000000-0000-4000-8000-000000000008', null, null, null, pg_temp.hash('t21')) $$, '22023', 'This address is different from the one in the clinic''s record for this patient.', 'an address that differs from the record is refused');
select lives_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000003', 'patient', 'someone.else@example.test', null, 'patient', 'd0000000-0000-4000-8000-000000000008', null, null, null, pg_temp.hash('t21'), null, true) $$, 'unless the sender confirms it');

-- Margaret Lyle (d..09, born 1958-12-03): the right address needs no confirming.
update public.patient_profiles set contact_email = 'margaret.lyle@example.test' where id = 'd0000000-0000-4000-8000-000000000009';
select lives_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000003', 'patient', 'margaret.lyle@example.test', null, 'patient', 'd0000000-0000-4000-8000-000000000009', null, null, null, pg_temp.hash('t22')) $$, 'the address on file is accepted as it is');
select is(private.verify_invitation_identity(pg_temp.hash('t22'), '1958-12-03'), 'ok', 'the right date of birth passes');
select is(private.verify_invitation_identity(pg_temp.hash('t22'), '2000-01-01'), 'wrong', 'a wrong date is counted');
select is(private.verify_invitation_identity(pg_temp.hash('t22'), null), 'wrong', 'so is a missing one');
select is(private.verify_invitation_identity(pg_temp.hash('t22'), '1999-09-09'), 'wrong', 'the third wrong date');
select is(private.verify_invitation_identity(pg_temp.hash('t22'), '1998-08-08'), 'wrong', 'the fourth');
select is(private.verify_invitation_identity(pg_temp.hash('t22'), '1997-07-07'), 'locked', 'the fifth cancels the link');
select is((select status from private.get_invitation(pg_temp.hash('t22'))), 'cancelled', 'which then reads as cancelled');
select is(private.verify_invitation_identity(pg_temp.hash('t22'), '1958-12-03'), 'invalid', 'and even the right date no longer works');
select is((select count(*)::int from public.notifications where user_id = 'a0000000-0000-4000-8000-000000000003' and title = 'An invitation was cancelled'), 1, 'the sender is told');
select lives_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000006', 'team', 'no.date@example.test', null, 'health_coach', null, null, null, 'Health coach', pg_temp.hash('t26')) $$, 'a team invitation is sent');
select is(private.verify_invitation_identity(pg_temp.hash('t26'), null), 'ok', 'and needs no date');

-- Accepting needs the date too, even if the check above was skipped.
select lives_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000003', 'patient', 'dan.okoro@example.test', null, 'patient', 'd0000000-0000-4000-8000-000000000007', null, null, null, pg_temp.hash('t23')) $$, 'an invitation for Daniel Okoro');
insert into auth.users (id, email, aud, role) values ('a0000000-0000-4000-8000-0000000000e9', 'dan.okoro@example.test', 'authenticated', 'authenticated');
select throws_ok($$ select private.accept_invitation(pg_temp.hash('t23'), 'a0000000-0000-4000-8000-0000000000e9', null, '1990-01-01') $$, '22023', 'The date of birth does not match.', 'accepting with the wrong date is refused');
select throws_ok($$ select private.accept_invitation(pg_temp.hash('t23'), 'a0000000-0000-4000-8000-0000000000e9') $$, '22023', 'The date of birth does not match.', 'and so is accepting with none');
select is((select private.accept_invitation(pg_temp.hash('t23'), 'a0000000-0000-4000-8000-0000000000e9', null, '1965-04-23')), 'patient'::public.invitation_kind, 'the right date accepts');

-- Notices -----------------------------------------------------------------------------------
select is((select count(*)::int from public.notifications where user_id = 'a0000000-0000-4000-8000-000000000004' and title = 'A guardian who can act for a patient was invited'), 1, 'the other PA is told when a guardian who can act is invited');
select is((select count(*)::int from public.notifications where user_id = 'a0000000-0000-4000-8000-000000000003' and title = 'A guardian who can act for a patient was invited'), 0, 'but not the PA who sent it');

insert into auth.users (id, email, aud, role) values ('a0000000-0000-4000-8000-0000000000e8', 'second.admin@example.test', 'authenticated', 'authenticated');
update public.profiles set status = 'active' where id = 'a0000000-0000-4000-8000-0000000000e8';
insert into public.staff_profiles (user_id, job_title, clinical_role, active) values ('a0000000-0000-4000-8000-0000000000e8', 'Administrator', 'admin', true);
insert into public.user_roles (user_id, role) values ('a0000000-0000-4000-8000-0000000000e8', 'admin');
select lives_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000006', 'team', 'another.doc@example.test', null, 'doctor', null, null, null, 'Doctor', pg_temp.hash('t24')) $$, 'an admin invites a doctor');
select is((select count(*)::int from public.notifications where user_id = 'a0000000-0000-4000-8000-0000000000e8' and title = 'A doctor invitation was sent'), 1, 'the other admin is told');
select is((select count(*)::int from public.notifications where user_id = 'a0000000-0000-4000-8000-000000000006' and title = 'A doctor invitation was sent'), 0, 'but not the admin who sent it');
select lives_ok($$ select private.create_invitation('a0000000-0000-4000-8000-000000000006', 'team', 'new.coach@example.test', null, 'health_coach', null, null, null, 'Health coach', pg_temp.hash('t25')) $$, 'an admin invites a health coach');
select is((select count(*)::int from public.notifications where user_id = 'a0000000-0000-4000-8000-0000000000e8' and title like '%invitation was sent'), 1, 'which tells nobody: only doctor and admin invitations do');

select * from finish();
rollback;
