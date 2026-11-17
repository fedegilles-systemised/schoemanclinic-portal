-- Ordering bloods: made by the database (price, due date, sex check), paid only by the server,
-- cancelled only while unpaid. Ids from supabase/seed.sql: Gina (doctor) a..01, Priya (PA) a..03,
-- admin a..06, health coach a..05, Eleanor (F) a..11 / d..01, Thomas (M) a..12 / d..02.
-- Panels: GS5 (F only, 29500) 11..01, MHP (M only, 21000) 11..02, THY (anyone, 14000) 11..05.
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

-- 1. Making an order ------------------------------------------------------------------------------

select pg_temp.become('a0000000-0000-4000-8000-000000000003');
create temp table made as
  select public.create_lab_order('d0000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'tdl_site', 'f0000000-0000-4000-8000-000000000011', current_date + 20, '  Fasting sample.  ') as id;
grant all on made to public;

select is((select price_pence from public.lab_orders o join made m on m.id = o.id), 29500 + 4500, 'price is the panel plus the site fee');
select is((select fee_pence from public.lab_orders o join made m on m.id = o.id), 4500, 'the fee is frozen on the order');
select is((select status::text from public.lab_orders o join made m on m.id = o.id), 'sent_to_patient', 'a new order starts as sent to patient');
select is((select fasting from public.lab_orders o join made m on m.id = o.id), true, 'fasting comes from the panel');
select is((select clinical_notes from public.lab_orders o join made m on m.id = o.id), 'Fasting sample.', 'notes are trimmed');
select is((select barcode from public.lab_orders o join made m on m.id = o.id), null, 'there is no barcode before payment');
select matches((select order_ref from public.lab_orders o join made m on m.id = o.id), '^LO-\d{4}-\d{3,}$', 'the order reference is made by the database');
select is(
  (select due_by from public.lab_orders o join made m on m.id = o.id),
  (select (starts_at at time zone 'Europe/London')::date - 14 from public.appointments where id = 'f0000000-0000-4000-8000-000000000011'),
  'due date is the appointment minus 14 days'
);
select is((select public.create_lab_order('d0000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000005', 'tdl_kit', null, null, null) is not null), true, 'a home kit order works with no appointment');
select is((select price_pence from public.lab_orders where panel_id = '11000000-0000-4000-8000-000000000005' and route = 'tdl_kit' order by created_at desc limit 1), 14000 + 1500, 'the kit fee is added');

select throws_ok($$ select public.create_lab_order('d0000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 'tdl_site', null, null, null) $$, '22023', 'That panel is not available for this patient.', 'a male panel cannot be ordered for a female patient');
select throws_ok($$ select public.create_lab_order('d0000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', null, null, null, null) $$, '22023', 'Choose how the sample will be taken.', 'a route is needed');
select throws_ok($$ select public.create_lab_order('d0000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000001', 'tdl_site', 'f0000000-0000-4000-8000-000000000011', null, null) $$, '22023', null, 'an appointment of another patient is refused');
select throws_ok($$ insert into public.lab_orders (order_ref, patient_id, panel_id, lab_partner_id, ordered_by, price_pence) values ('X-1', 'd0000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 0) $$, '42501', null, 'a PA cannot insert an order row directly');
select throws_ok($$ update public.lab_orders set price_pence = 1 where id = (select id from made) $$, '42501', null, 'a PA cannot change the price');
select throws_ok($$ update public.lab_orders set appointment_id = 'f0000000-0000-4000-8000-000000000001' where id = (select id from made) $$, '42501', null, 'a PA cannot move an order to another appointment');
select throws_ok($$ update public.lab_orders set status = 'sample_taken' where id = (select id from made) $$, '42501', null, 'a PA cannot skip a step by writing the status');

-- A patient with no sex at birth stops the order.
reset role;
update public.patient_profiles set sex = null where id = 'd0000000-0000-4000-8000-000000000002';
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.create_lab_order('d0000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000005', 'tdl_site', null, null, null) $$, '22023', 'Record the patient''s sex at birth before ordering bloods.', 'a missing sex at birth stops the order');
reset role;
update public.patient_profiles set sex = 'M' where id = 'd0000000-0000-4000-8000-000000000002';

-- 2. Who may order --------------------------------------------------------------------------------

select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select throws_ok($$ select public.create_lab_order('d0000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000005', 'tdl_site', null, null, null) $$, '42501', null, 'a patient cannot order');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.create_lab_order('d0000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000005', 'tdl_site', null, null, null) $$, '42501', null, 'an admin cannot order');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.create_lab_order('d0000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000005', 'tdl_site', null, null, null) $$, '42501', null, 'a health coach cannot order');
reset role;

-- The patient sees their own order, and the catalogue.
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select ok((select count(*) from public.lab_orders where id = (select id from made)) = 1, 'the patient reads their own order');
select ok((select count(*) from public.lab_panels) > 0, 'anyone signed in reads the catalogue');
select throws_ok($$ select public.cancel_lab_order((select id from made)) $$, '42501', null, 'a patient cannot cancel an order');
reset role;

-- 3. Payment: server only ---------------------------------------------------------------------------

select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.mark_lab_order_paid((select id from made), 'cs_x', 'pi_x', 34000) $$, '42501', null, 'a PA cannot mark an order paid');
reset role;

select pg_temp.service();
select throws_ok($$ select public.mark_lab_order_paid((select id from made), 'cs_x', 'pi_x', 100) $$, '22023', 'The amount paid does not match the price.', 'a wrong amount is refused');
select is((select public.mark_lab_order_paid((select id from made), 'cs_x', 'pi_x', 34000)), true, 'the right amount marks it paid');
select is((select public.mark_lab_order_paid((select id from made), 'cs_x', 'pi_x', 34000)), false, 'a repeated webhook does nothing');
reset role;
select is((select status::text from public.lab_orders where id = (select id from made)), 'paid', 'the order is paid');
select matches((select barcode from public.lab_orders where id = (select id from made)), '^SCH-\d{7}$', 'a barcode exists once it is paid');
select ok((select paid_at is not null from public.lab_orders where id = (select id from made)), 'the payment time is kept');

-- 4. Cancelling and the sample ------------------------------------------------------------------------

select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.cancel_lab_order((select id from made)) $$, '22023', 'Only an order that has not been paid for can be cancelled.', 'a paid order cannot be cancelled');
select lives_ok($$ select public.cancel_lab_order((select id from public.lab_orders where route = 'tdl_kit' and patient_id = 'd0000000-0000-4000-8000-000000000001' order by created_at desc limit 1)) $$, 'an unpaid order can be cancelled');
select throws_ok($$ select public.record_sample_taken((select id from public.lab_orders where status = 'cancelled' limit 1)) $$, '22023', null, 'a cancelled order has no sample');
select lives_ok($$ select public.record_sample_taken((select id from made)) $$, 'the sample is recorded once paid');
select is((select status::text from public.lab_orders where id = (select id from made)), 'sample_taken', 'the order is at sample taken');
reset role;

select pg_temp.service();
select throws_ok($$ select public.mark_lab_order_paid((select id from public.lab_orders where status = 'cancelled' limit 1), 'cs_y', 'pi_y', 15500) $$, '22023', 'The order was cancelled before it was paid for.', 'a cancelled order cannot be paid');
reset role;

-- 5. Route fees: an admin sets them -----------------------------------------------------------------------

select pg_temp.become('a0000000-0000-4000-8000-000000000006');
select lives_ok($$ update public.lab_route_fees set fee_pence = 5000 where route = 'tdl_site' $$, 'an admin changes a route fee');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
update public.lab_route_fees set fee_pence = 1 where route = 'tdl_site';
reset role;
select is((select fee_pence from public.lab_route_fees where route = 'tdl_site'), 5000, 'the fee is unchanged by the PA');

select * from finish();
rollback;
