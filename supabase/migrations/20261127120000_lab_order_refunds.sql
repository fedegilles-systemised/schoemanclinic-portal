-- Refunding a paid blood test order from Clinic Hub (decided 18 November 2026: the whole payment, by an admin).
-- Stripe is asked for the refund by server code; this migration only records it. The order is kept and
-- marked cancelled, with when it was refunded, how much, which Stripe refund it was and who asked.

alter table public.lab_orders
  add column refunded_at timestamptz,
  add column refund_pence integer check (refund_pence >= 0),
  add column stripe_refund_id text,
  add column refunded_by uuid references public.staff_profiles (id) on delete restrict;
comment on column public.lab_orders.refunded_at is 'When the whole payment was refunded. A refunded order is also cancelled and stays on the record.';
comment on column public.lab_orders.refund_pence is 'The amount Stripe refunded. Always the whole price: part refunds are made in Stripe.';
comment on column public.lab_orders.stripe_refund_id is 'Stripe''s id for the refund, so it can be found there.';
comment on column public.lab_orders.refunded_by is 'The admin who asked for the refund.';
create index lab_orders_refunded_by_idx on public.lab_orders (refunded_by);

-- Server code only. No grant gives the browser these columns, and the trigger is a second lock.
drop trigger lab_orders_reject_client_changes on public.lab_orders;
create trigger lab_orders_reject_client_changes before update on public.lab_orders
  for each row execute function private.reject_client_changes(
    'id', 'order_ref', 'patient_id', 'barcode', 'stripe_checkout_id', 'stripe_payment_intent_id', 'paid_at',
    'panel_id', 'lab_partner_id', 'price_pence', 'fee_pence', 'route', 'fasting', 'clinical_notes', 'cancelled_at',
    'status', 'sample_taken_at', 'appointment_id', 'due_by',
    'refunded_at', 'refund_pence', 'stripe_refund_id', 'refunded_by'
  );

-- Stripe has refunded the whole payment. Server only. True the first time; false when it is already
-- recorded, so repeating the call does nothing. Only a paid order, or one whose sample was taken, can be
-- refunded: once results are in, the clinic has done the work and decides that case in Stripe.
create function private.record_lab_order_refund(_order uuid, _refund text, _amount integer, _by uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.lab_orders;
begin
  perform set_config('app.system_actor', 'order-refund', true);
  select * into o from public.lab_orders where id = _order for update;
  if not found then
    perform set_config('app.system_actor', '', true);
    raise exception 'That order was not found.' using errcode = '22023';
  end if;
  if o.refunded_at is not null then
    perform set_config('app.system_actor', '', true);
    return false;
  end if;
  if o.paid_at is null or o.stripe_payment_intent_id is null or o.stripe_payment_intent_id = '' or o.status not in ('paid', 'sample_taken') then
    perform set_config('app.system_actor', '', true);
    raise exception 'Only a paid order whose results have not arrived can be refunded.' using errcode = '22023';
  end if;
  if _amount is distinct from o.price_pence then
    perform set_config('app.system_actor', '', true);
    raise exception 'The refund does not match the price paid.' using errcode = '22023';
  end if;
  if coalesce(_refund, '') = '' or not exists (select 1 from public.staff_profiles s where s.id = _by) then
    perform set_config('app.system_actor', '', true);
    raise exception 'The refund needs its Stripe id and who asked.' using errcode = '22023';
  end if;
  -- The audit log names the admin who asked, not just the system.
  perform set_config('app.actor_id', (select s.user_id::text from public.staff_profiles s where s.id = _by), true);
  update public.lab_orders
  set status = 'cancelled',
      cancelled_at = now(),
      refunded_at = now(),
      refund_pence = _amount,
      stripe_refund_id = _refund,
      refunded_by = _by
  where id = _order;
  perform set_config('app.actor_id', '', true);
  perform set_config('app.system_actor', '', true);
  return true;
end;
$$;
comment on function private.record_lab_order_refund(uuid, text, integer, uuid) is 'Server only. Records that Stripe refunded the whole payment of a paid order and cancels the order. True the first time, false when already recorded.';

create function public.record_lab_order_refund(_order uuid, _refund text, _amount integer, _by uuid)
returns boolean language sql security invoker set search_path = '' as $$ select private.record_lab_order_refund(_order, _refund, _amount, _by); $$;

revoke all on function
  private.record_lab_order_refund(uuid, text, integer, uuid),
  public.record_lab_order_refund(uuid, text, integer, uuid)
from public, anon, authenticated;
grant execute on function
  private.record_lab_order_refund(uuid, text, integer, uuid),
  public.record_lab_order_refund(uuid, text, integer, uuid)
to service_role;
