-- Decisions of 18 November 2026: refunds made in Stripe and of a declined repeat fee, chasing and lapsing unpaid
-- orders, notes on an order for staff only, and the reminder for online bookings nobody checked.
-- Ids from supabase/seed.sql: PA Priya user a..03 (staff b..03); admin user a..06; doctor Gina user a..01;
-- Eleanor patient d..01, account a..11; GS5 panel 11..01 (29500 + 4500 site fee = 34000);
-- repeat request e1..01 (paid, fee 3000) for Eleanor.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;
create function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
end;
$$;

create temp table admin_staff as select id from public.staff_profiles where user_id = 'a0000000-0000-4000-8000-000000000006';
create temp table pa_staff as select id from public.staff_profiles where user_id = 'a0000000-0000-4000-8000-000000000003';
grant all on admin_staff, pa_staff to public;

-- Four orders: paid, paid with results in, unpaid, and one more unpaid. A PA makes them.
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
create temp table made as
  select public.create_lab_order('d0000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'tdl_site', null, null, '  For the lab only.  ') as paid,
         public.create_lab_order('d0000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'tdl_site', null, null, null) as results,
         public.create_lab_order('d0000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'tdl_site', null, null, null) as unpaid,
         public.create_lab_order('d0000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'tdl_site', null, null, null) as old_unpaid;
grant all on made to public;
reset role;
select pg_temp.service();
select public.mark_lab_order_paid((select paid from made), 'cs_a', 'pi_a', 34000);
select public.mark_lab_order_paid((select results from made), 'cs_b', 'pi_b', 34000);
reset role;
update public.lab_orders set status = 'results_in' where id = (select results from made);

-- 1. A refund made in Stripe itself -------------------------------------------------------------------
select pg_temp.service();
select is((select public.record_lab_order_refund((select paid from made), 're_a', 34000, null)), true, 'a refund made in Stripe is recorded with no one asking');
select is((select public.record_lab_order_refund((select paid from made), 're_a', 34000, null)), false, 'and only once');
select throws_ok($$ select public.record_lab_order_refund((select unpaid from made), 're_x', 34000, null) $$, '22023', 'Only a paid order whose results have not arrived can be refunded.', 'an unpaid order has nothing to refund, even from Stripe');
select throws_ok($$ select public.record_lab_order_refund((select results from made), 're_b', 100, null) $$, '22023', 'The refund does not match the price paid.', 'a part refund made in Stripe is not recorded');
select is((select public.record_lab_order_refund((select results from made), 're_b', 34000, null)), true, 'a whole refund made in Stripe after results is recorded');
reset role;
select is((select status::text from public.lab_orders where id = (select paid from made)), 'cancelled', 'a refund before results cancels the order');
select is((select refunded_by from public.lab_orders where id = (select paid from made)), null, 'and says no one in Clinic Hub asked');
select is((select status::text from public.lab_orders where id = (select results from made)), 'results_in', 'a refund after results leaves the order and its results as they are');
select isnt((select refunded_at from public.lab_orders where id = (select results from made)), null, 'but the refund is recorded');

-- Stripe's message first, then the admin's record: the admin is added and nothing is counted twice
select pg_temp.service();
select is((select public.record_lab_order_refund((select paid from made), 're_a', 34000, (select id from admin_staff))), false, 'the admin''s record after Stripe''s is not a second refund');
reset role;
select is((select refunded_by from public.lab_orders where id = (select paid from made)), (select id from admin_staff), 'but it adds who asked');

-- Asked from Clinic Hub: only an admin
select pg_temp.service();
select throws_ok($$ select public.record_lab_order_refund((select unpaid from made), 're_c', 34000, (select id from pa_staff)) $$, '22023', null, 'a PA cannot be the person who asked');
reset role;

-- 2. The fee of a repeat request ----------------------------------------------------------------------
select pg_temp.service();
select throws_ok($$ select public.record_repeat_request_refund('e1000000-0000-4000-8000-000000000001', 're_r', 3000, 'a0000000-0000-4000-8000-000000000006') $$, '22023', 'Only the fee of a declined request can be refunded.', 'the fee of a request that was not declined is not refunded from Clinic Hub');
select throws_ok($$ select public.record_repeat_request_refund('e1000000-0000-4000-8000-000000000001', 're_r', 3000, 'a0000000-0000-4000-8000-000000000003') $$, '22023', 'Only the fee of a declined request can be refunded.', 'the state is checked first');
reset role;
update public.repeat_requests set status = 'declined' where id = 'e1000000-0000-4000-8000-000000000001';
select pg_temp.become('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.record_repeat_request_refund('e1000000-0000-4000-8000-000000000001', 're_r', 3000, 'a0000000-0000-4000-8000-000000000006') $$, '42501', null, 'a signed-in admin cannot record a fee refund by calling the function');
reset role;
select pg_temp.service();
select throws_ok($$ select public.record_repeat_request_refund('e1000000-0000-4000-8000-000000000001', 're_r', 3000, 'a0000000-0000-4000-8000-000000000003') $$, '22023', 'The refund needs its Stripe id and who asked.', 'a PA cannot be the person who asked');
select throws_ok($$ select public.record_repeat_request_refund('e1000000-0000-4000-8000-000000000001', 're_r', 100, 'a0000000-0000-4000-8000-000000000006') $$, '22023', 'The refund does not match the fee paid.', 'a part refund is not recorded');
select is((select public.record_repeat_request_refund('e1000000-0000-4000-8000-000000000001', 're_r', 3000, 'a0000000-0000-4000-8000-000000000006')), true, 'an admin refunds the fee of a declined request');
select is((select public.record_repeat_request_refund('e1000000-0000-4000-8000-000000000001', 're_r', 3000, 'a0000000-0000-4000-8000-000000000006')), false, 'and only once');
reset role;
select is((select refund_pence from public.repeat_requests where id = 'e1000000-0000-4000-8000-000000000001'), 3000, 'the amount is kept');
select is((select status::text from public.repeat_requests where id = 'e1000000-0000-4000-8000-000000000001'), 'declined', 'the request stays declined');
select ok(exists (select 1 from public.audit_log where entity = 'repeat_requests' and entity_id = 'e1000000-0000-4000-8000-000000000001' and action = 'updated' and actor_id = 'a0000000-0000-4000-8000-000000000006' and metadata -> 'changed' ? 'refunded_at'), 'the audit log names the admin');
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ update public.repeat_requests set refunded_at = null where id = 'e1000000-0000-4000-8000-000000000001' $$, '42501', null, 'a PA cannot unwrite a refund');
reset role;

-- 3. Unpaid orders: chase at 3 and 7 days, lapse at 30 -------------------------------------------------
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select * from public.unpaid_orders_to_chase() $$, '42501', null, 'a PA cannot ask which orders to chase');
select throws_ok($$ select * from public.lapse_unpaid_lab_orders() $$, '42501', null, 'nor lapse orders');
reset role;
select pg_temp.service();
select is((select count(*)::int from public.unpaid_orders_to_chase() where order_id = (select unpaid from made)), 0, 'a new order is not chased');
reset role;
update public.lab_orders set created_at = now() - interval '4 days' where id = (select unpaid from made);
update public.lab_orders set created_at = now() - interval '31 days' where id = (select old_unpaid from made);
select pg_temp.service();
select is((select reminder from public.unpaid_orders_to_chase() where order_id = (select unpaid from made)), 1::smallint, 'at 3 days the first reminder is due');
select is((select count(*)::int from public.unpaid_orders_to_chase() where order_id = (select old_unpaid from made)), 0, 'an order past 30 days is not chased');
select is((select public.mark_lab_order_chased((select unpaid from made), 1::smallint)), true, 'the first reminder is counted');
select is((select public.mark_lab_order_chased((select unpaid from made), 1::smallint)), false, 'the same reminder is not counted twice, even if the job runs twice');
select is((select public.mark_lab_order_chased((select old_unpaid from made), 2::smallint)), false, 'and the second cannot be counted on an order that never had the first');
select is((select count(*)::int from public.unpaid_orders_to_chase() where order_id = (select unpaid from made)), 0, 'once reminded it waits until 7 days');
reset role;
update public.lab_orders set created_at = now() - interval '8 days' where id = (select unpaid from made);
select pg_temp.service();
select is((select reminder from public.unpaid_orders_to_chase() where order_id = (select unpaid from made)), 2::smallint, 'at 7 days the second reminder is due');
select is((select public.mark_lab_order_chased((select unpaid from made), 2::smallint)), true, 'the second reminder is counted');
select is((select count(*)::int from public.unpaid_orders_to_chase() where order_id = (select unpaid from made)), 0, 'after two reminders there are no more');
select is((select count(*)::int from public.lapse_unpaid_lab_orders() where order_id = (select old_unpaid from made)), 1, 'an order unpaid for 30 days lapses');
reset role;
select is((select status::text from public.lab_orders where id = (select old_unpaid from made)), 'cancelled', 'it is cancelled and stays on the record');
select is((select status::text from public.lab_orders where id = (select unpaid from made)), 'sent_to_patient', 'a younger one is left open');
select is((select chase_count::int from public.lab_orders where id = (select unpaid from made)), 2, 'a reminder is counted at most twice');

-- 4. Notes on an order are for staff ------------------------------------------------------------------
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select throws_ok($$ select clinical_notes from public.lab_orders $$, '42501', null, 'a patient cannot read the notes on an order');
select throws_ok($$ select public.lab_order_notes((select paid from made)) $$, '42501', null, 'nor ask for them');
select is((select price_pence from public.lab_orders where id = (select paid from made)), 34000, 'but still reads the rest of their order');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select clinical_notes from public.lab_orders $$, '42501', null, 'a PA cannot read the column through the table either');
select is((select public.lab_order_notes((select paid from made))), 'For the lab only.', 'a PA in scope reads the notes through the function');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select throws_ok($$ select refunded_by from public.lab_orders $$, '42501', null, 'the refund bookkeeping columns are not for clients either');
reset role;

-- 5. Online bookings nobody checked ------------------------------------------------------------------
select is(private.working_days_between('2026-11-13', '2026-11-16'), 1, 'Friday to Monday is one working day');
select is(private.working_days_between('2026-11-12', '2026-11-16'), 2, 'Thursday to Monday is two');
select is(private.working_days_between('2026-11-16', '2026-11-16'), 0, 'the same day is none');
insert into public.patient_profiles (clinic_ref, first_name, last_name, date_of_birth, contact_email, contact_phone, booked_online_at)
values ('SC-990001', 'Una', 'Checked', '1980-01-01', 'una@example.test', '07700 900901', now() - interval '10 days'),
       ('SC-990002', 'Ivy', 'Invited', '1980-01-02', 'ivy@example.test', '07700 900902', now() - interval '10 days'),
       ('SC-990003', 'Nia', 'New', '1980-01-03', 'nia@example.test', '07700 900903', now());
insert into public.invitations (email, kind, patient_id, invited_by, token_hash, expires_at)
select 'ivy@example.test', 'patient', id, (select id from pa_staff), repeat('a', 64), now() + interval '7 days' from public.patient_profiles where clinic_ref = 'SC-990002';
select pg_temp.service();
select is((select count(*)::int from public.unchecked_online_patients() u join public.patient_profiles p on p.id = u.for_patient where p.clinic_ref = 'SC-990001'), 1, 'an online booking with no invitation after two working days is listed');
select is((select count(*)::int from public.unchecked_online_patients() u join public.patient_profiles p on p.id = u.for_patient where p.clinic_ref in ('SC-990002', 'SC-990003')), 0, 'an invited one, and a new one, are not');
select public.mark_online_check_reminded(array(select id from public.patient_profiles where clinic_ref = 'SC-990001'));
select is((select count(*)::int from public.unchecked_online_patients() u join public.patient_profiles p on p.id = u.for_patient where p.clinic_ref = 'SC-990001'), 0, 'it is reminded once');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select * from public.unchecked_online_patients() $$, '42501', null, 'a PA cannot list them through the server function');
select throws_ok($$ update public.patient_profiles set online_check_reminded_at = null where clinic_ref = 'SC-990001' $$, '42501', null, 'nor clear the reminder');
reset role;

-- 6. A no-show ------------------------------------------------------------------------------------------
insert into public.appointments (id, patient_id, clinician_id, starts_at, duration_min, type, status, source)
values ('f9000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', now() - interval '3 hours', 30, 'Follow-up', 'booked', 'clinic_hub'),
       ('f9000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', now() + interval '3 hours', 30, 'Follow-up', 'booked', 'clinic_hub');
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select throws_ok($$ select public.mark_appointment_no_show('f9000000-0000-4000-8000-000000000001') $$, '42501', null, 'a patient cannot mark a no-show');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.mark_appointment_no_show('f9000000-0000-4000-8000-000000000002') $$, '22023', 'An appointment can be marked as a no-show once it has ended.', 'one that has not ended cannot be marked');
select lives_ok($$ select public.mark_appointment_no_show('f9000000-0000-4000-8000-000000000001') $$, 'a PA marks an appointment that has ended');
select throws_ok($$ select public.mark_appointment_no_show('f9000000-0000-4000-8000-000000000001') $$, '22023', 'This appointment is not open.', 'and only once');
reset role;
select is((select status::text from public.appointments where id = 'f9000000-0000-4000-8000-000000000001'), 'no_show', 'the appointment shows as a no-show and stays on the record');
select pg_temp.become('a0000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.mark_appointment_no_show('f9000000-0000-4000-8000-000000000002') $$, '42501', null, 'a health coach cannot mark a no-show');
reset role;
-- A doctor marks their own appointments only; a PA can put a wrong mark right
insert into public.appointments (id, patient_id, clinician_id, starts_at, duration_min, type, status, source)
values ('f9000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', now() - interval '5 hours', 30, 'Follow-up', 'booked', 'clinic_hub'),
       ('f9000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', now() - interval '5 hours', 30, 'Follow-up', 'booked', 'clinic_hub');
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.mark_appointment_no_show('f9000000-0000-4000-8000-000000000003') $$, '42501', null, 'a doctor cannot mark another clinician''s appointment');
select lives_ok($$ select public.mark_appointment_no_show('f9000000-0000-4000-8000-000000000004') $$, 'a doctor marks their own');
select throws_ok($$ select public.undo_appointment_no_show('f9000000-0000-4000-8000-000000000004') $$, '42501', null, 'a doctor cannot undo a mark');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select lives_ok($$ select public.undo_appointment_no_show('f9000000-0000-4000-8000-000000000004') $$, 'a PA puts a wrong mark right');
select throws_ok($$ select public.undo_appointment_no_show('f9000000-0000-4000-8000-000000000004') $$, '22023', 'This appointment is not marked as a no-show.', 'only a no-show can be undone');
reset role;
select is((select status::text from public.appointments where id = 'f9000000-0000-4000-8000-000000000004'), 'booked', 'it goes back to booked');

select * from finish();
rollback;
