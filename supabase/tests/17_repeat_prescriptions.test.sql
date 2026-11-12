-- Repeat prescriptions. Ids from supabase/seed.sql:
-- Eleanor (patient) a..11 / d..01, her Oestrogel e..01; Thomas (another patient) a..12;
-- Gina (doctor, her care team) a..01; Laura (doctor, not) a..02; Priya (PA) a..03; admin a..06;
-- Ruth (guardian who cannot act) a..22 for d..06.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create temporary table ids on commit drop as
select
  (select id from public.prescribable_medicines where name = 'Mounjaro') as mounjaro,
  (select id from public.prescribable_medicines where name = 'Melatonin') as melatonin;
grant select on ids to authenticated, service_role;

-- The clinic's list.
select is((select count(*)::int from public.prescribable_medicines where archived_at is null), 24, 'the clinic''s list starts with the Typeform''s 24 medicines');
select is((select count(*)::int from public.prescribable_medicines where weight_loss), 4, 'four of them are weight-loss medicines');

select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from public.prescribable_medicines), 24, 'a patient reads the list');
select throws_ok($$ insert into public.prescribable_medicines (name) values ('Something') $$, '42501', null, 'a patient cannot add to it');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ insert into public.prescribable_medicines (name) values ('Something') $$, '42501', null, 'nor can a PA');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000006');
select lives_ok($$ insert into public.prescribable_medicines (name) values ('Estriol cream') $$, 'an admin adds a medicine');
select lives_ok($$ update public.prescribable_medicines set archived_at = now() where name = 'Estriol cream' $$, 'and takes it off the list');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from public.prescribable_medicines where name = 'Estriol cream'), 0, 'which patients then no longer see');
reset role;

-- Asking. A patient asks for her own medicine and one from the list.
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select throws_ok(
  $$ select public.request_repeat('d0000000-0000-4000-8000-000000000001', ('[]')::jsonb, true, null, null, null, null, null, null) $$,
  '22023', null, 'a request needs at least one medicine');
select throws_ok(
  $$ select public.request_repeat('d0000000-0000-4000-8000-000000000001', ('[{"medicine_id":"' || (select melatonin from ids) || '","supply_months":3}]')::jsonb, true, null, null, null, null, null, null) $$,
  '22023', null, 'supply is one or two months');
select throws_ok(
  $$ select public.request_repeat('d0000000-0000-4000-8000-000000000001', ('[{"medicine_id":"' || (select melatonin from ids) || '","supply_months":1},{"medicine_id":"' || (select melatonin from ids) || '","supply_months":2}]')::jsonb, true, null, null, null, null, null, null) $$,
  '22023', null, 'the same medicine cannot be listed twice');
select throws_ok(
  $$ select public.request_repeat('d0000000-0000-4000-8000-000000000001', ('[{"medicine_id":"' || (select mounjaro from ids) || '","supply_months":1}]')::jsonb, true, null, null, null, null, null, null) $$,
  '22023', null, 'a weight-loss medicine needs the extra answers');
select throws_ok(
  $$ select public.request_repeat('d0000000-0000-4000-8000-000000000001', ('[{"other_name":"Mounjaro 5 mg pen","supply_months":1}]')::jsonb, true, null, true, '2 kg', true, ' ', null) $$,
  '22023', null, 'a typed-in weight-loss medicine is caught too, and side effects need describing');
select lives_ok(
  $$ select public.request_repeat('d0000000-0000-4000-8000-000000000001',
       ('[{"medication_id":"e0000000-0000-4000-8000-000000000001","supply_months":2},{"medicine_id":"' || (select mounjaro from ids) || '","supply_months":1},{"other_name":"Vitamin K2","supply_months":1}]')::jsonb,
       false, true, true, '2 kg', false, null, 'Running low') $$,
  'a patient asks for three medicines');
reset role;
create temporary table rr on commit drop as
  select id from public.repeat_requests where patient_id = 'd0000000-0000-4000-8000-000000000001' and note = 'Running low';
grant select on rr to authenticated, service_role;
select is((select count(*)::int from public.repeat_request_items where request_id = (select id from rr)), 3, 'all three medicines are stored');
select is((select paid_at from public.repeat_requests where id = (select id from rr)), null, 'unpaid at first');
select is((select still_losing_weight from public.repeat_requests where id = (select id from rr)), true, 'with the weight-loss answers');

-- Someone else's medicine, or a patient who is not theirs.
select pg_temp.become('a0000000-0000-4000-8000-000000000012');
select throws_ok(
  $$ select public.request_repeat('d0000000-0000-4000-8000-000000000001', ('[{"other_name":"X","supply_months":1}]')::jsonb, true, null, null, null, null, null, null) $$,
  '42501', null, 'another patient cannot ask for her');
select is((select count(*)::int from public.repeat_request_items where request_id = (select id from rr)), 0, 'nor see her medicines');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000022');
select throws_ok(
  $$ select public.request_repeat('d0000000-0000-4000-8000-000000000006', ('[{"other_name":"X","supply_months":1}]')::jsonb, true, null, null, null, null, null, null) $$,
  '42501', null, 'a guardian who cannot act cannot ask');
reset role;

-- Nobody writes requests directly any more.
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select throws_ok($$ update public.repeat_requests set paid_at = now() where id = (select id from rr) $$, '42501', null, 'a patient cannot mark a request paid');
select throws_ok($$ insert into public.repeat_requests (patient_id, requested_by) values ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011') $$, '42501', null, 'nor insert one directly');
select throws_ok($$ select public.mark_repeat_request_paid((select id from rr), 'cs_x', 'pi_x', 3000) $$, '42501', null, 'nor call the payment function');
select throws_ok($$ select public.decide_repeat_request((select id from rr), 'approved', null) $$, '42501', null, 'nor approve it');
reset role;

-- Paying, as the Stripe webhook does: no signed-in person.
select set_config('request.jwt.claims', '{}', true);
set local role service_role;
select throws_ok($$ select public.mark_repeat_request_paid((select id from rr), 'cs_x', 'pi_x', 100) $$, '22023', null, 'a payment of the wrong amount is refused');
select is(public.mark_repeat_request_paid((select id from rr), 'cs_x', 'pi_x', 3000), true, 'the payment is recorded');
select is(public.mark_repeat_request_paid((select id from rr), 'cs_x', 'pi_x', 3000), false, 'and a repeated webhook does nothing');
reset role;
select isnt((select paid_at from public.repeat_requests where id = (select id from rr)), null, 'the request is paid');
select is((select metadata ->> 'system' from public.audit_log where entity = 'repeat_requests' and entity_id = (select id from rr) order by id desc limit 1), 'stripe', 'the audit log names Stripe');

-- A paid request cannot be withdrawn.
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select throws_ok($$ select public.cancel_repeat_request((select id from rr)) $$, '22023', null, 'a paid request cannot be withdrawn');
reset role;

-- Deciding: a doctor not on her care team cannot; her doctor approves; a decline needs a reason.
select pg_temp.become('a0000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.decide_repeat_request((select id from rr), 'approved', null) $$, '42501', null, 'a doctor not on the care team cannot decide');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.decide_repeat_request((select id from rr), 'approved', 'Approved for two months') $$, 'her doctor approves');
select throws_ok($$ select public.decide_repeat_request((select id from rr), 'approved', null) $$, '22023', null, 'approved cannot be approved again');
select throws_ok($$ select public.decide_repeat_request((select id from rr), 'declined', ' ') $$, '22023', null, 'a decline needs a reason');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select lives_ok($$ select public.decide_repeat_request((select id from rr), 'sent_to_pharmacy', null) $$, 'a PA marks it sent to the pharmacy');
select throws_ok($$ select public.decide_repeat_request((select id from rr), 'declined', 'Too late') $$, '22023', null, 'and nothing changes after that');
reset role;
select is((select status::text from public.repeat_requests where id = (select id from rr)), 'sent_to_pharmacy', 'the request is with the pharmacy');
select is((select decision_note from public.repeat_requests where id = (select id from rr)), 'Approved for two months', 'the earlier note is kept');
select isnt((select resolved_at from public.repeat_requests where id = (select id from rr)), null, 'and it is resolved');

-- Withdrawing an unpaid request.
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select lives_ok(
  $$ select public.request_repeat('d0000000-0000-4000-8000-000000000001', ('[{"medicine_id":"' || (select melatonin from ids) || '","supply_months":1}]')::jsonb, true, null, null, null, null, null, 'Withdraw me') $$,
  'a second request');
select lives_ok($$ select public.cancel_repeat_request((select id from public.repeat_requests where note = 'Withdraw me')) $$, 'which the patient withdraws before paying');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.decide_repeat_request((select id from public.repeat_requests where note = 'Withdraw me'), 'approved', null) $$, '22023', null, 'a withdrawn request cannot be approved');
reset role;

-- A PA asks for a patient.
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select lives_ok(
  $$ select public.request_repeat('d0000000-0000-4000-8000-000000000001', ('[{"other_name":"Vitamin C","supply_months":1}]')::jsonb, true, null, null, null, null, null, 'From reception') $$,
  'a PA asks on a patient''s behalf');
reset role;

-- The run-out reminder is the daily job's to write.
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.mark_run_out_reminded('e0000000-0000-4000-8000-000000000001', current_date) $$, '42501', null, 'staff cannot mark a reminder sent');
select throws_ok($$ update public.medications set run_out_reminded_for = current_date where id = 'e0000000-0000-4000-8000-000000000001' $$, '42501', null, 'nor write the column');
reset role;
set local role service_role;
select lives_ok($$ select public.mark_run_out_reminded('e0000000-0000-4000-8000-000000000001', current_date + 21) $$, 'the daily job records a reminder');
reset role;
select is((select run_out_reminded_for from public.medications where id = 'e0000000-0000-4000-8000-000000000001'), current_date + 21, 'for that run-out date');

select * from finish();
rollback;
