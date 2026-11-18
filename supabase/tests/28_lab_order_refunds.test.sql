-- Refunding a paid blood test order: recorded only by server code, the whole payment, once.
-- Ids from supabase/seed.sql: Priya (PA) user a..03, admin user a..06, Eleanor d..01, GS5 (29500) panel 11..01.
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

-- Two orders made by a PA: one left unpaid, one paid.
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
create temp table made as
  select public.create_lab_order('d0000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'tdl_site', null, null, null) as unpaid,
         public.create_lab_order('d0000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'tdl_site', null, null, null) as paid;
grant all on made to public;
reset role;

create temp table admin_staff as select id from public.staff_profiles where user_id = 'a0000000-0000-4000-8000-000000000006';
grant all on admin_staff to public;

select pg_temp.service();
select is((select public.mark_lab_order_paid((select paid from made), 'cs_r1', 'pi_r1', 34000)), true, 'the second order is paid');
reset role;

-- 1. Only server code can record a refund --------------------------------------------------------------
select pg_temp.become('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.record_lab_order_refund((select paid from made), 're_x', 34000, (select id from admin_staff)) $$, '42501', null, 'an admin signed in cannot record a refund by calling the function');
select throws_ok($$ update public.lab_orders set refunded_at = now() where id = (select paid from made) $$, '42501', null, 'an admin cannot write the refund columns');
select throws_ok($$ update public.lab_orders set status = 'cancelled' where id = (select paid from made) $$, '42501', null, 'an admin cannot cancel a paid order by writing the status');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.record_lab_order_refund((select paid from made), 're_x', 34000, (select id from admin_staff)) $$, '42501', null, 'a PA cannot record a refund');
reset role;
select pg_temp.become('d0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.record_lab_order_refund((select paid from made), 're_x', 34000, (select id from admin_staff)) $$, '42501', null, 'a patient cannot record a refund');
reset role;
select is((select refunded_at from public.lab_orders where id = (select paid from made)), null, 'nothing was refunded by any of those');

-- 2. The rules, as server code ---------------------------------------------------------------------------
select pg_temp.service();
select throws_ok($$ select public.record_lab_order_refund((select unpaid from made), 're_1', 34000, (select id from admin_staff)) $$, '22023', 'Only a paid order whose results have not arrived can be refunded.', 'an unpaid order cannot be refunded');
select throws_ok($$ select public.record_lab_order_refund((select paid from made), 're_1', 100, (select id from admin_staff)) $$, '22023', 'The refund does not match the price paid.', 'a part refund is not recorded');
select throws_ok($$ select public.record_lab_order_refund((select paid from made), '', 34000, (select id from admin_staff)) $$, '22023', 'The refund needs its Stripe id and who asked.', 'the Stripe id is needed');
select throws_ok($$ select public.record_lab_order_refund((select paid from made), 're_1', 34000, '00000000-0000-4000-8000-00000000dead') $$, '22023', 'The refund needs its Stripe id and who asked.', 'the person who asked must be a staff member');
select throws_ok($$ select public.record_lab_order_refund('00000000-0000-4000-8000-00000000dead', 're_1', 34000, (select id from admin_staff)) $$, '22023', 'That order was not found.', 'an order that does not exist is refused');
select is((select public.record_lab_order_refund((select paid from made), 're_1', 34000, (select id from admin_staff))), true, 'the whole payment can be refunded once');
select is((select public.record_lab_order_refund((select paid from made), 're_1', 34000, (select id from admin_staff))), false, 'repeating it does nothing');
reset role;

select is((select status::text from public.lab_orders where id = (select paid from made)), 'cancelled', 'a refunded order is cancelled');
select isnt((select cancelled_at from public.lab_orders where id = (select paid from made)), null, 'with the time it was cancelled');
select isnt((select refunded_at from public.lab_orders where id = (select paid from made)), null, 'the time it was refunded is kept');
select is((select refund_pence from public.lab_orders where id = (select paid from made)), 34000, 'the amount refunded is kept');
select is((select stripe_refund_id from public.lab_orders where id = (select paid from made)), 're_1', 'the Stripe refund id is kept');
select is((select refunded_by from public.lab_orders where id = (select paid from made)), (select id from admin_staff), 'who asked is kept');
select isnt((select barcode from public.lab_orders where id = (select paid from made)), null, 'the order and its barcode stay on the record');

-- 3. A second refund, a refund after results, and the audit log ---------------------------------------

select pg_temp.become('a0000000-0000-4000-8000-000000000003');
create temp table made2 as
  select public.create_lab_order('d0000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'tdl_site', null, null, null) as id;
grant all on made2 to public;
reset role;
select pg_temp.service();
select public.mark_lab_order_paid((select id from made2), 'cs_r2', 'pi_r2', 34000);
reset role;
update public.lab_orders set status = 'results_in' where id = (select id from made2);
select pg_temp.service();
select throws_ok($$ select public.record_lab_order_refund((select id from made2), 're_3', 34000, (select id from admin_staff)) $$, '22023', 'Only a paid order whose results have not arrived can be refunded.', 'an order with results in cannot be refunded here');
reset role;
update public.lab_orders set status = 'sample_taken' where id = (select id from made2);
select pg_temp.service();
select is((select public.record_lab_order_refund((select id from made2), 're_3', 34000, (select id from admin_staff))), true, 'an order whose sample was taken can be refunded');
reset role;

select ok(
  exists (
    select 1 from public.audit_log
    where entity = 'lab_orders' and entity_id = (select paid from made) and action = 'updated'
      and actor_id = 'a0000000-0000-4000-8000-000000000006' and metadata -> 'changed' ? 'refunded_at'
  ),
  'the refund is in the audit log, in the name of the admin who asked'
);

select * from finish();
rollback;
