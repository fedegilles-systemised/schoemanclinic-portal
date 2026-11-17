-- Ordering bloods in Clinic Hub (the clinic's decisions of 12 November 2026, and the call of 17 November).
--
--   1. How the sample is taken (TDL site or TDL home kit) and the fee for each, set by an admin.
--   2. Panel details the request form needs: tubes, and which sex a panel is for.
--   3. Order details: route, fee, fasting, notes. Price is frozen on the order when it is made.
--   4. Functions: create, cancel, mark paid (Stripe, server only), record the sample taken.
--
-- A doctor or PA no longer inserts an order row directly: the price, the due date and the sex check
-- are made in the database, not trusted from the browser. Orders are cancelled, never deleted.

-- 1. Routes and fees --------------------------------------------------------------------------------

create type public.order_route as enum ('tdl_site', 'tdl_kit');

create table public.lab_route_fees (
  route public.order_route primary key,
  label text not null check (char_length(label) between 1 and 100),
  fee_pence integer not null check (fee_pence >= 0),
  updated_at timestamptz not null default now()
);
comment on table public.lab_route_fees is 'The fee added to a panel for each way of taking the sample. Set by an admin. Starting values are the clinic''s current Semble fees, to be confirmed.';

insert into public.lab_route_fees (route, label, fee_pence) values
  ('tdl_site', 'Blood taking at a TDL site', 4500),
  ('tdl_kit', 'TDL home kit (administration)', 1500);

create trigger lab_route_fees_set_updated_at before update on public.lab_route_fees
  for each row execute function private.set_updated_at();
create trigger lab_route_fees_write_audit_log after insert or update or delete on public.lab_route_fees
  for each row execute function private.write_audit_log();

alter table public.lab_route_fees enable row level security;
alter table public.lab_route_fees force row level security;
revoke all on table public.lab_route_fees from public, anon, authenticated, service_role;
grant select on public.lab_route_fees to authenticated;
grant update (label, fee_pence) on public.lab_route_fees to authenticated;

create policy "Anyone signed in reads route fees" on public.lab_route_fees
  for select to authenticated using (true);
create policy "Admins change route fees" on public.lab_route_fees
  for update to authenticated
  using ((select private.has_role('admin')))
  with check ((select private.has_role('admin')));

-- 2. Panel details ----------------------------------------------------------------------------------

alter table public.lab_panels
  add column tubes text check (char_length(tubes) <= 200),
  add column sex_restriction text check (sex_restriction in ('F', 'M'));
comment on column public.lab_panels.tubes is 'The tubes the lab needs, for example "1 purple, 2 gold, 1 grey". Printed on the home-kit request.';
comment on column public.lab_panels.sex_restriction is 'F or M when the panel is for one sex at birth only; empty when for anyone.';

-- The lab the clinic is moving to. Added only when no TDL row exists yet, so a clinic that already has one keeps it.
insert into public.lab_partners (name, results_channel, api_enabled)
select 'TDL (The Doctors Laboratory)', 'upload', false
where not exists (select 1 from public.lab_partners where name ~* 'tdl|doctors laboratory');

-- 3. Order details ----------------------------------------------------------------------------------

alter table public.lab_orders
  add column route public.order_route,
  add column fee_pence integer not null default 0 check (fee_pence >= 0),
  add column fasting boolean not null default false,
  add column sample_date date,
  add column clinical_notes text check (char_length(clinical_notes) <= 2000),
  add column stripe_payment_intent_id text,
  add column cancelled_at timestamptz;
comment on column public.lab_orders.route is 'How the sample is taken. Empty on orders made before this was recorded.';
comment on column public.lab_orders.fee_pence is 'The route fee inside price_pence, frozen when the order is made.';
comment on column public.lab_orders.price_pence is 'Panel price plus route fee, frozen when the order is made.';
comment on column public.lab_orders.clinical_notes is 'Printed on the request form. Not for the patient to edit.';
comment on column public.lab_orders.cancelled_at is 'When the order was cancelled. Cancelled orders stay on the record.';

create sequence public.lab_order_ref_seq start 100;
create sequence public.lab_barcode_seq start 1000200;
revoke all on sequence public.lab_order_ref_seq, public.lab_barcode_seq from public, anon, authenticated, service_role;

-- Price and panel are set when the order is made and never by the browser afterwards. Making an order
-- and marking one paid go through the functions below.
drop policy "Doctors and PAs add lab orders" on public.lab_orders;
revoke insert on public.lab_orders from authenticated;
-- Status and the sample time move only through cancel_lab_order, record_sample_taken, the Stripe webhook
-- and the release of a report, so no one can skip a step by writing the column.
revoke update (panel_id, lab_partner_id, price_pence, status, sample_taken_at, appointment_id, due_by) on public.lab_orders from authenticated;
drop trigger lab_orders_reject_client_changes on public.lab_orders;
create trigger lab_orders_reject_client_changes before update on public.lab_orders
  for each row execute function private.reject_client_changes(
    'id', 'order_ref', 'patient_id', 'barcode', 'stripe_checkout_id', 'stripe_payment_intent_id', 'paid_at',
    'panel_id', 'lab_partner_id', 'price_pence', 'fee_pence', 'route', 'fasting', 'clinical_notes', 'cancelled_at',
    'status', 'sample_taken_at', 'appointment_id', 'due_by'
  );

-- 4. Functions --------------------------------------------------------------------------------------

-- A doctor or PA orders a panel for a patient in their scope. Returns the order id.
create function private.create_lab_order(
  _patient uuid,
  _panel uuid,
  _route public.order_route,
  _appointment uuid,
  _sample_date date,
  _clinical_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff uuid := (select private.my_staff_id());
  p public.patient_profiles;
  panel public.lab_panels;
  fee integer;
  due date;
  notes text := nullif(btrim(coalesce(_clinical_notes, '')), '');
  new_id uuid;
begin
  if not (private.has_role('doctor') or private.has_role('pa')) or staff is null or not private.in_scope(_patient) then
    raise exception 'You cannot order bloods for this patient.' using errcode = '42501';
  end if;
  select * into p from public.patient_profiles where id = _patient and archived_at is null;
  if not found then
    raise exception 'You cannot order bloods for this patient.' using errcode = '42501';
  end if;
  if p.sex is null or p.sex not in ('F', 'M') then
    raise exception 'Record the patient''s sex at birth before ordering bloods.' using errcode = '22023';
  end if;
  select * into panel from public.lab_panels where id = _panel and active and archived_at is null;
  if not found then
    raise exception 'That panel is not available.' using errcode = '22023';
  end if;
  if panel.sex_restriction is not null and panel.sex_restriction <> p.sex then
    raise exception 'That panel is not available for this patient.' using errcode = '22023';
  end if;
  if _route is null then
    raise exception 'Choose how the sample will be taken.' using errcode = '22023';
  end if;
  select f.fee_pence into fee from public.lab_route_fees f where f.route = _route;
  if char_length(coalesce(notes, '')) > 2000 then
    raise exception 'Use 2,000 characters or fewer for the notes.' using errcode = '22023';
  end if;
  if _appointment is not null then
    select (a.starts_at at time zone 'Europe/London')::date - 14 into due
      from public.appointments a where a.id = _appointment and a.patient_id = _patient;
    if not found then
      raise exception 'That appointment does not belong to this patient.' using errcode = '22023';
    end if;
  end if;

  insert into public.lab_orders (
    order_ref, patient_id, panel_id, lab_partner_id, ordered_by, appointment_id, due_by,
    price_pence, fee_pence, route, fasting, sample_date, clinical_notes
  ) values (
    'LO-' || to_char(now() at time zone 'Europe/London', 'YYYY') || '-' || lpad(nextval('public.lab_order_ref_seq')::text, 3, '0'),
    _patient, _panel, panel.lab_partner_id, staff, _appointment, due,
    panel.price_pence + fee, fee, _route, panel.fasting_required, _sample_date, notes
  ) returning id into new_id;
  return new_id;
end;
$$;
comment on function private.create_lab_order(uuid, uuid, public.order_route, uuid, date, text) is 'A doctor or PA orders a panel. Checks the patient''s sex at birth against the panel, adds the route fee, and sets the due date to the appointment minus 14 days.';

-- An order that has not been paid for can be cancelled. A paid order is refunded in Stripe first.
create function private.cancel_lab_order(_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.lab_orders;
begin
  select * into o from public.lab_orders where id = _order for update;
  if not found or not (private.has_role('doctor') or private.has_role('pa')) or not private.in_scope(o.patient_id) then
    raise exception 'You cannot change this order.' using errcode = '42501';
  end if;
  if o.status <> 'sent_to_patient' then
    raise exception 'Only an order that has not been paid for can be cancelled.' using errcode = '22023';
  end if;
  update public.lab_orders set status = 'cancelled', cancelled_at = now() where id = _order;
end;
$$;

-- The sample has been taken, as far as the clinic knows. A feed from the lab can do the same later.
create function private.record_sample_taken(_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.lab_orders;
begin
  select * into o from public.lab_orders where id = _order for update;
  if not found or not (private.has_role('doctor') or private.has_role('pa')) or not private.in_scope(o.patient_id) then
    raise exception 'You cannot change this order.' using errcode = '42501';
  end if;
  if o.status <> 'paid' then
    raise exception 'The sample can be recorded once the order is paid.' using errcode = '22023';
  end if;
  update public.lab_orders set status = 'sample_taken', sample_taken_at = now() where id = _order;
end;
$$;

-- Stripe has confirmed the payment. Server only. True the first time; false when already recorded or
-- not found, so a repeated webhook does nothing. The barcode exists from now on, never before.
create function private.mark_lab_order_paid(_order uuid, _session text, _payment_intent text, _amount integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.lab_orders;
begin
  perform set_config('app.system_actor', 'stripe', true);
  select * into o from public.lab_orders where id = _order for update;
  if not found or o.paid_at is not null then
    perform set_config('app.system_actor', '', true);
    return false;
  end if;
  if _amount is distinct from o.price_pence then
    raise exception 'The amount paid does not match the price.' using errcode = '22023';
  end if;
  if o.status <> 'sent_to_patient' then
    raise exception 'The order was cancelled before it was paid for.' using errcode = '22023';
  end if;
  update public.lab_orders
  set status = 'paid',
      paid_at = now(),
      barcode = 'SCH-' || nextval('public.lab_barcode_seq')::text,
      stripe_checkout_id = _session,
      stripe_payment_intent_id = _payment_intent
  where id = _order;
  perform set_config('app.system_actor', '', true);
  return true;
end;
$$;

create function public.create_lab_order(_patient uuid, _panel uuid, _route public.order_route, _appointment uuid, _sample_date date, _clinical_notes text)
returns uuid language sql security invoker set search_path = '' as $$ select private.create_lab_order(_patient, _panel, _route, _appointment, _sample_date, _clinical_notes); $$;
create function public.cancel_lab_order(_order uuid)
returns void language sql security invoker set search_path = '' as $$ select private.cancel_lab_order(_order); $$;
create function public.record_sample_taken(_order uuid)
returns void language sql security invoker set search_path = '' as $$ select private.record_sample_taken(_order); $$;
create function public.mark_lab_order_paid(_order uuid, _session text, _payment_intent text, _amount integer)
returns boolean language sql security invoker set search_path = '' as $$ select private.mark_lab_order_paid(_order, _session, _payment_intent, _amount); $$;

revoke all on function
  private.create_lab_order(uuid, uuid, public.order_route, uuid, date, text),
  private.cancel_lab_order(uuid),
  private.record_sample_taken(uuid),
  private.mark_lab_order_paid(uuid, text, text, integer),
  public.create_lab_order(uuid, uuid, public.order_route, uuid, date, text),
  public.cancel_lab_order(uuid),
  public.record_sample_taken(uuid),
  public.mark_lab_order_paid(uuid, text, text, integer)
from public, anon, authenticated;
grant execute on function
  private.create_lab_order(uuid, uuid, public.order_route, uuid, date, text),
  private.cancel_lab_order(uuid),
  private.record_sample_taken(uuid),
  public.create_lab_order(uuid, uuid, public.order_route, uuid, date, text),
  public.cancel_lab_order(uuid),
  public.record_sample_taken(uuid)
to authenticated;
grant execute on function
  private.mark_lab_order_paid(uuid, text, text, integer),
  public.mark_lab_order_paid(uuid, text, text, integer)
to service_role;
