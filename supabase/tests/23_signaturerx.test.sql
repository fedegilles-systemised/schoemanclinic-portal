-- SignatureRx: the patient's address, each doctor's integration code and the prescriptions sent.
-- Ids from supabase/seed.sql: Eleanor (patient) a..11 / d..01; Gina (doctor, on her care team) a..01;
-- Laura (doctor, not) a..02; Priya (PA) a..03; admin a..06.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

-- Server code has no signed-in person, so the claims left by an earlier become() must not leak in.
create function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
end;
$$;

create temporary table made (name text primary key, id uuid);
grant all on made to authenticated, service_role;

-- 1. The patient's address -----------------------------------------------------------------------

select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select lives_ok($$ update public.patient_profiles set address_line1 = '5 Test Road', city = 'London', postcode = 'N1 1AA' where id = 'd0000000-0000-4000-8000-000000000001' $$, 'a PA records a patient''s address');
reset role;
select is((select address_line1 from public.patient_profiles where id = 'd0000000-0000-4000-8000-000000000001'), '5 Test Road', 'and it is kept');
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select lives_ok($$ update public.patient_profiles set address_line1 = 'Elsewhere' where id = 'd0000000-0000-4000-8000-000000000001' $$, 'a patient''s attempt to change it is not an error, but changes nothing');
reset role;
select is((select address_line1 from public.patient_profiles where id = 'd0000000-0000-4000-8000-000000000001'), '5 Test Road', 'so it is still the one the PA recorded');
select throws_ok($$ update public.patient_profiles set postcode = repeat('x', 21) where id = 'd0000000-0000-4000-8000-000000000001' $$, '23514', null, 'a postcode has a length limit');

-- 2. Each doctor's integration code --------------------------------------------------------------

select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select is(public.has_my_signaturerx_code(), false, 'a doctor starts with no code saved');
select lives_ok($$ select public.set_my_signaturerx_code('  CODE-ONE  ') $$, 'a doctor saves their code');
select is(public.has_my_signaturerx_code(), true, 'and the form then knows it is saved');
select throws_ok($$ select * from public.signaturerx_prescribers $$, '42501', null, 'nobody signed in can read the codes, not even the doctor');
select throws_ok($$ select public.set_my_signaturerx_code('   ') $$, '22023', null, 'an empty code is refused');
select throws_ok($$ select public.set_my_signaturerx_code(repeat('x', 201)) $$, '22023', null, 'a code has a length limit');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000002');
select is(public.has_my_signaturerx_code(), false, 'another doctor has not saved one');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.set_my_signaturerx_code('X') $$, '42501', null, 'a PA cannot save a code');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.set_my_signaturerx_code('X') $$, '42501', null, 'nor can an admin');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select throws_ok($$ select public.set_my_signaturerx_code('X') $$, '42501', null, 'nor a patient');
reset role;
select pg_temp.service();
select is((select integration_code from public.signaturerx_prescribers where user_id = 'a0000000-0000-4000-8000-000000000001'), 'CODE-ONE', 'server code reads it, trimmed');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.set_my_signaturerx_code('CODE-TWO') $$, 'a doctor replaces their code');
reset role;
select pg_temp.service();
select is((select integration_code from public.signaturerx_prescribers where user_id = 'a0000000-0000-4000-8000-000000000001'), 'CODE-TWO', 'and the new one is kept');
reset role;

-- 3. Who may send, and sending once ---------------------------------------------------------------

insert into made values ('laura_patient', (select id from public.patient_profiles where user_id = 'a0000000-0000-4000-8000-000000000002'));

select pg_temp.become('a0000000-0000-4000-8000-000000000011');
insert into made values
  ('approved', public.request_repeat('d0000000-0000-4000-8000-000000000001', '[{"other_name":"Test medicine","supply_months":1}]'::jsonb, true, null, null, null, null, null, null)),
  ('waiting', public.request_repeat('d0000000-0000-4000-8000-000000000001', '[{"other_name":"Another medicine","supply_months":2}]'::jsonb, true, null, null, null, null, null, null)),
  ('extra', public.request_repeat('d0000000-0000-4000-8000-000000000001', '[{"other_name":"A third medicine","supply_months":1}]'::jsonb, true, null, null, null, null, null, null));
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000002');
insert into made values ('own', public.request_repeat((select id from made where name = 'laura_patient'), '[{"other_name":"Her own medicine","supply_months":1}]'::jsonb, true, null, null, null, null, null, null));
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.decide_repeat_request((select id from made where name = 'approved'), 'approved', '') $$, 'a doctor approves Eleanor''s request');
select lives_ok($$ select public.decide_repeat_request((select id from made where name = 'own'), 'approved', '') $$, 'and Laura''s own request, which Gina''s care team covers');
select lives_ok($$ select public.decide_repeat_request((select id from made where name = 'extra'), 'approved', '') $$, 'and a third one');
reset role;

-- Scope: only a doctor on the care team, never for themselves.
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select is(public.can_send_to_signaturerx((select id from made where name = 'approved')), true, 'the care-team doctor may send an approved request');
select is(public.can_send_to_signaturerx((select id from made where name = 'waiting')), false, 'but not one that is not approved');
select is(public.can_send_to_signaturerx((select id from made where name = 'own')), true, 'Gina may send for Laura, who is her patient');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000002');
select is(public.can_send_to_signaturerx((select id from made where name = 'own')), false, 'Laura may not send a prescription for herself');
select is(public.can_send_to_signaturerx((select id from made where name = 'approved')), false, 'nor for a patient who is not on her care team');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select is(public.can_send_to_signaturerx((select id from made where name = 'approved')), false, 'a PA may not send');
reset role;

select pg_temp.service();
select throws_ok($$ select public.start_signaturerx_send((select id from made where name = 'own'), 'draft', 'a0000000-0000-4000-8000-000000000002') $$, '42501', null, 'server code refuses a send by a doctor for herself');
select throws_ok($$ select public.start_signaturerx_send((select id from made where name = 'approved'), 'draft', 'a0000000-0000-4000-8000-000000000002') $$, '42501', null, 'or by a doctor outside the care team');
select throws_ok($$ select public.start_signaturerx_send((select id from made where name = 'approved'), 'draft', 'a0000000-0000-4000-8000-000000000003') $$, '42501', null, 'or by a PA');
select throws_ok($$ select public.start_signaturerx_send((select id from made where name = 'waiting'), 'draft', 'a0000000-0000-4000-8000-000000000001') $$, '22023', null, 'or of a request that is not approved');
select throws_ok($$ select public.start_signaturerx_send((select id from made where name = 'approved'), 'deliver', 'a0000000-0000-4000-8000-000000000001') $$, '23514', null, 'or with an action we do not send');
select lives_ok($$ insert into made values ('send1', public.start_signaturerx_send((select id from made where name = 'approved'), 'draft', 'a0000000-0000-4000-8000-000000000001')) $$, 'the care-team doctor opens a send');
select throws_ok($$ select public.start_signaturerx_send((select id from made where name = 'approved'), 'issueOnly', 'a0000000-0000-4000-8000-000000000001') $$, '23505', null, 'a second send for the same request cannot be opened');
reset role;

select is((select status from public.signaturerx_prescriptions where id = (select id from made where name = 'send1')), 'sending', 'an open send says it is under way');
select is((select srx_prescription_id from public.signaturerx_prescriptions where id = (select id from made where name = 'send1')), null, 'with no SignatureRx id yet');
select is((select sent_by::text from public.signaturerx_prescriptions where id = (select id from made where name = 'send1')), 'a0000000-0000-4000-8000-000000000001', 'and the doctor who opened it');
select is((select actor_id::text from public.audit_log where entity = 'signaturerx_prescriptions' and action = 'created' order by id desc limit 1), 'a0000000-0000-4000-8000-000000000001', 'the audit log names the same doctor');

select pg_temp.service();
select lives_ok($$ select public.refresh_signaturerx_prescription((select id from made where name = 'send1'), 'signed', 'signed') $$, 'a state is not stored for a send with no SignatureRx id');
reset role;
select is((select status from public.signaturerx_prescriptions where id = (select id from made where name = 'send1')), 'sending', 'so it is still under way');

select pg_temp.service();
select lives_ok($$ select public.finish_signaturerx_send((select id from made where name = 'send1'), 'SRXTEST0001', 'draft', 'draft') $$, 'server code closes a send SignatureRx accepted');
select throws_ok($$ select public.finish_signaturerx_send((select id from made where name = 'send1'), 'SRXTEST0009', 'draft', 'draft') $$, '22023', null, 'a closed send cannot be closed again');
select throws_ok($$ select public.start_signaturerx_send((select id from made where name = 'approved'), 'issueOnly', 'a0000000-0000-4000-8000-000000000001') $$, '23505', null, 'and the request still cannot be sent twice');
reset role;
select is((select srx_prescription_id from public.signaturerx_prescriptions where id = (select id from made where name = 'send1')), 'SRXTEST0001', 'the SignatureRx id is kept');

select pg_temp.service();
select lives_ok($$ select public.refresh_signaturerx_prescription((select id from made where name = 'send1'), 'signed', 'signed') $$, 'server code then stores the latest state');
reset role;
select is((select status from public.signaturerx_prescriptions where id = (select id from made where name = 'send1')), 'signed', 'which is kept');
select isnt((select last_checked_at from public.signaturerx_prescriptions where id = (select id from made where name = 'send1')), null, 'with the time it was checked');

-- A send SignatureRx refused is closed, and the doctor may try again.
select pg_temp.service();
select lives_ok($$ insert into made values ('send2', public.start_signaturerx_send((select id from made where name = 'own'), 'draft', 'a0000000-0000-4000-8000-000000000001')) $$, 'a send opens for the second request');
select lives_ok($$ select public.fail_signaturerx_send((select id from made where name = 'send2'), 'SignatureRx refused it: the signing PIN is wrong.') $$, 'and is closed as failed when SignatureRx refuses it');
select lives_ok($$ insert into made values ('send3', public.start_signaturerx_send((select id from made where name = 'own'), 'draft', 'a0000000-0000-4000-8000-000000000001')) $$, 'a failed send does not stop another try');
select lives_ok($$ select public.finish_signaturerx_send((select id from made where name = 'send3'), 'SRXTEST0002', 'draft', 'draft') $$, 'which can then succeed');
select lives_ok($$ insert into made values ('send4', public.start_signaturerx_send((select id from made where name = 'extra'), 'draft', 'a0000000-0000-4000-8000-000000000001')) $$, 'another request opens its own send');
select throws_ok($$ select public.finish_signaturerx_send((select id from made where name = 'send4'), 'SRXTEST0002', 'draft', 'draft') $$, '23505', null, 'a SignatureRx id is never recorded twice');
reset role;
select is((select status from public.signaturerx_prescriptions where id = (select id from made where name = 'send2')), 'failed', 'the failed send stays on the record');
select is((select last_error from public.signaturerx_prescriptions where id = (select id from made where name = 'send2')), 'SignatureRx refused it: the signing PIN is wrong.', 'with the reason');

-- A send SignatureRx did not confirm can be settled by hand, after someone has checked SignatureRx.
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.close_signaturerx_send((select id from made where name = 'send4'), 'Not in SignatureRx.') $$, '22023', null, 'a send only minutes old cannot be settled yet');
reset role;
update public.signaturerx_prescriptions set sent_at = now() - interval '10 minutes' where id = (select id from made where name = 'send4');
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.close_signaturerx_send((select id from made where name = 'send4'), 'Not in SignatureRx.') $$, '42501', null, 'a PA cannot close a stuck send');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.close_signaturerx_send((select id from made where name = 'send4'), 'Not in SignatureRx.') $$, '42501', null, 'nor a doctor outside the care team');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select throws_ok($$ select public.close_signaturerx_send((select id from made where name = 'send4'), 'Not in SignatureRx.') $$, '42501', null, 'nor a patient');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.close_signaturerx_send((select id from made where name = 'send4'), '   ') $$, '22023', null, 'a close needs what was found');
select throws_ok($$ select public.close_signaturerx_send((select id from made where name = 'send1'), 'Not in SignatureRx.') $$, '22023', null, 'only a send that is waiting can be closed');
select lives_ok($$ select public.close_signaturerx_send((select id from made where name = 'send4'), 'Not in SignatureRx.') $$, 'a doctor on the care team closes a stuck send');
reset role;
select is((select status from public.signaturerx_prescriptions where id = (select id from made where name = 'send4')), 'failed', 'it is then closed as failed');
select is((select last_error from public.signaturerx_prescriptions where id = (select id from made where name = 'send4')), 'Closed by hand after checking SignatureRx: Not in SignatureRx.', 'with what was found');

select pg_temp.service();
select lives_ok($$ insert into made values ('send5', public.start_signaturerx_send((select id from made where name = 'extra'), 'draft', 'a0000000-0000-4000-8000-000000000001')) $$, 'the request can then be sent again');
reset role;
update public.signaturerx_prescriptions set sent_at = now() - interval '10 minutes' where id = (select id from made where name = 'send5');
select pg_temp.become('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.confirm_signaturerx_send((select id from made where name = 'send5'), 'SRXTEST0002') $$, '23505', null, 'an id already recorded elsewhere is refused');
select throws_ok($$ select public.confirm_signaturerx_send((select id from made where name = 'send1'), 'SRXTEST0009') $$, '22023', null, 'only a send that is waiting can be confirmed');
select throws_ok($$ select public.confirm_signaturerx_send((select id from made where name = 'send5'), '  ') $$, '22023', null, 'a confirmation needs the id');
select lives_ok($$ select public.confirm_signaturerx_send((select id from made where name = 'send5'), 'SRXTEST0003') $$, 'an admin records that it was created in SignatureRx');
reset role;
select is((select srx_prescription_id from public.signaturerx_prescriptions where id = (select id from made where name = 'send5')), 'SRXTEST0003', 'and its id is kept');
select is((select status from public.signaturerx_prescriptions where id = (select id from made where name = 'send5')), null, 'with its state still to be checked');
select pg_temp.service();
select lives_ok($$ select public.refresh_signaturerx_prescription((select id from made where name = 'send5'), 'signed', 'signed') $$, 'which a check with SignatureRx then fills in');
reset role;
select is((select status from public.signaturerx_prescriptions where id = (select id from made where name = 'send5')), 'signed', 'as signed');

-- Who reads it.
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.signaturerx_prescriptions where repeat_request_id = (select id from made where name = 'approved')), 1, 'a doctor on the care team reads it');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.signaturerx_prescriptions where repeat_request_id = (select id from made where name = 'approved')), 0, 'a doctor who is not on it does not');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from public.signaturerx_prescriptions), 0, 'the patient does not');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ insert into public.signaturerx_prescriptions (repeat_request_id, patient_id, action, sent_by) values ((select id from made where name = 'approved'), 'd0000000-0000-4000-8000-000000000001', 'draft', 'a0000000-0000-4000-8000-000000000001') $$, '42501', null, 'a doctor cannot write a row by hand');
reset role;

select ok(not has_function_privilege('authenticated', 'public.start_signaturerx_send(uuid, text, uuid)', 'execute'), 'a signed-in person cannot open a send');
select ok(not has_function_privilege('authenticated', 'public.finish_signaturerx_send(uuid, text, text, text)', 'execute'), 'nor close one');
select ok(not has_function_privilege('authenticated', 'public.fail_signaturerx_send(uuid, text)', 'execute'), 'nor mark one failed');
select ok(not has_function_privilege('authenticated', 'public.refresh_signaturerx_prescription(uuid, text, text)', 'execute'), 'nor change a state');
select ok(not has_function_privilege('authenticated', 'private.staff_may_send_prescription(uuid, uuid)', 'execute'), 'nor ask the scope question for anyone else');
select ok(not has_function_privilege('anon', 'public.close_signaturerx_send(uuid, text)', 'execute'), 'anon cannot close a send');
select ok(not has_function_privilege('anon', 'public.set_my_signaturerx_code(text)', 'execute'), 'anon cannot save a code');
select ok(not has_table_privilege('authenticated', 'public.signaturerx_prescribers', 'select'), 'nobody signed in holds anything on the codes table');

select * from finish();
rollback;
