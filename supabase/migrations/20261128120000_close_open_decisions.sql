-- Decisions taken on 18 November 2026 to close the open points we can settle ourselves:
--  1. A refund made in Stripe itself is recorded in Clinic Hub (S-264), and an admin can refund the fee of a
--     declined repeat prescription request from Clinic Hub. Only an admin can ask for either.
--  2. An unpaid blood test order is chased at 3 and 7 days and lapses on its own after 30 days.
--  3. The clinical notes on an order are for staff only: patients can no longer read the column.
--  4. A patient who booked online and has not been invited after 2 working days is reminded to the team, once.
--  5. A PA, a doctor or an admin can mark an appointment that has ended as a no-show.

-- 1. Refunds ----------------------------------------------------------------------------------------

alter table public.repeat_requests
  add column refunded_at timestamptz,
  add column refund_pence integer check (refund_pence >= 0),
  add column stripe_refund_id text,
  add column refunded_by uuid references public.profiles (id) on delete restrict;
comment on column public.repeat_requests.refunded_at is 'When the whole fee was refunded. The request stays as it was decided.';
comment on column public.repeat_requests.refund_pence is 'The amount Stripe refunded. Always the whole fee.';
comment on column public.repeat_requests.stripe_refund_id is 'Stripe''s id for the refund.';
comment on column public.repeat_requests.refunded_by is 'The admin who asked for the refund. Empty when the refund was made in Stripe itself.';
create index repeat_requests_refunded_by_idx on public.repeat_requests (refunded_by);
drop trigger repeat_requests_reject_client_changes on public.repeat_requests;
create trigger repeat_requests_reject_client_changes before update on public.repeat_requests
  for each row execute function private.reject_client_changes(
    'id', 'patient_id', 'medication_id', 'requested_by', 'fee_pence', 'stripe_payment_intent_id', 'ghl_task_id',
    'refunded_at', 'refund_pence', 'stripe_refund_id', 'refunded_by'
  );

-- Blood test orders: now also for a refund made in Stripe itself (_by empty), and only ever for an admin.
-- Asked from Clinic Hub (_by is a staff id): the same rules as before, and the person must be an admin.
-- Made in Stripe (_by empty): a fact to record, so the order is cancelled only if its results have not arrived.
create or replace function private.record_lab_order_refund(_order uuid, _refund text, _amount integer, _by uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.lab_orders;
  by_stripe boolean := _by is null;
  cancel_it boolean;
begin
  perform set_config('app.system_actor', case when by_stripe then 'stripe-refund' else 'order-refund' end, true);
  select * into o from public.lab_orders where id = _order for update;
  if not found then
    perform set_config('app.system_actor', '', true);
    raise exception 'That order was not found.' using errcode = '22023';
  end if;
  if o.refunded_at is not null then
    -- Stripe's own message can arrive before the admin's record is made. The refund is already recorded; the
    -- admin who asked is then added, so the audit trail still says who it was.
    if not by_stripe and o.refunded_by is null and exists (
      select 1 from public.staff_profiles s join public.user_roles r on r.user_id = s.user_id where s.id = _by and r.role = 'admin'
    ) then
      perform set_config('app.actor_id', (select s.user_id::text from public.staff_profiles s where s.id = _by), true);
      update public.lab_orders set refunded_by = _by where id = _order;
      perform set_config('app.actor_id', '', true);
    end if;
    perform set_config('app.system_actor', '', true);
    return false;
  end if;
  if o.paid_at is null or o.stripe_payment_intent_id is null or o.stripe_payment_intent_id = ''
    or (not by_stripe and o.status not in ('paid', 'sample_taken')) then
    perform set_config('app.system_actor', '', true);
    raise exception 'Only a paid order whose results have not arrived can be refunded.' using errcode = '22023';
  end if;
  if _amount is distinct from o.price_pence then
    perform set_config('app.system_actor', '', true);
    raise exception 'The refund does not match the price paid.' using errcode = '22023';
  end if;
  if coalesce(_refund, '') = '' or (not by_stripe and not exists (
    select 1 from public.staff_profiles s join public.user_roles r on r.user_id = s.user_id
    where s.id = _by and r.role = 'admin'
  )) then
    perform set_config('app.system_actor', '', true);
    raise exception 'The refund needs its Stripe id and who asked.' using errcode = '22023';
  end if;
  cancel_it := o.status in ('paid', 'sample_taken');
  if not by_stripe then
    perform set_config('app.actor_id', (select s.user_id::text from public.staff_profiles s where s.id = _by), true);
  end if;
  update public.lab_orders
  set status = case when cancel_it then 'cancelled'::public.order_status else status end,
      cancelled_at = case when cancel_it then now() else cancelled_at end,
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

-- The fee of a repeat prescription request. Asked from Clinic Hub (_by is an admin's profile id): only the
-- fee of a declined request. Made in Stripe (_by empty): recorded whatever the request's state.
create function private.record_repeat_request_refund(_request uuid, _refund text, _amount integer, _by uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.repeat_requests;
  by_stripe boolean := _by is null;
begin
  perform set_config('app.system_actor', case when by_stripe then 'stripe-refund' else 'request-refund' end, true);
  select * into r from public.repeat_requests where id = _request for update;
  if not found then
    perform set_config('app.system_actor', '', true);
    raise exception 'That request was not found.' using errcode = '22023';
  end if;
  if r.refunded_at is not null then
    if not by_stripe and r.refunded_by is null and exists (select 1 from public.user_roles ur where ur.user_id = _by and ur.role = 'admin') then
      perform set_config('app.actor_id', _by::text, true);
      update public.repeat_requests set refunded_by = _by where id = _request;
      perform set_config('app.actor_id', '', true);
    end if;
    perform set_config('app.system_actor', '', true);
    return false;
  end if;
  if r.paid_at is null or r.stripe_payment_intent_id is null or r.stripe_payment_intent_id = '' then
    perform set_config('app.system_actor', '', true);
    raise exception 'Only a paid request can be refunded.' using errcode = '22023';
  end if;
  if not by_stripe and r.status <> 'declined' then
    perform set_config('app.system_actor', '', true);
    raise exception 'Only the fee of a declined request can be refunded.' using errcode = '22023';
  end if;
  if _amount is distinct from r.fee_pence then
    perform set_config('app.system_actor', '', true);
    raise exception 'The refund does not match the fee paid.' using errcode = '22023';
  end if;
  if coalesce(_refund, '') = '' or (not by_stripe and not exists (
    select 1 from public.user_roles ur where ur.user_id = _by and ur.role = 'admin'
  )) then
    perform set_config('app.system_actor', '', true);
    raise exception 'The refund needs its Stripe id and who asked.' using errcode = '22023';
  end if;
  if not by_stripe then
    perform set_config('app.actor_id', _by::text, true);
  end if;
  update public.repeat_requests
  set refunded_at = now(), refund_pence = _amount, stripe_refund_id = _refund, refunded_by = _by
  where id = _request;
  perform set_config('app.actor_id', '', true);
  perform set_config('app.system_actor', '', true);
  return true;
end;
$$;
comment on function private.record_repeat_request_refund(uuid, text, integer, uuid) is 'Server only. Records that Stripe refunded the whole fee of a repeat request. True the first time, false when already recorded.';

create function public.record_repeat_request_refund(_request uuid, _refund text, _amount integer, _by uuid)
returns boolean language sql security invoker set search_path = '' as $$ select private.record_repeat_request_refund(_request, _refund, _amount, _by); $$;

revoke all on function
  private.record_repeat_request_refund(uuid, text, integer, uuid),
  public.record_repeat_request_refund(uuid, text, integer, uuid)
from public, anon, authenticated;
grant execute on function
  private.record_repeat_request_refund(uuid, text, integer, uuid),
  public.record_repeat_request_refund(uuid, text, integer, uuid)
to service_role;

-- 2. Unpaid orders: chase at 3 and 7 days, lapse at 30 -------------------------------------------------

alter table public.lab_orders
  add column chase_count smallint not null default 0 check (chase_count between 0 and 2),
  add column last_chased_at timestamptz;
comment on column public.lab_orders.chase_count is 'How many reminders an unpaid order has had: one at 3 days, one at 7. Written by the daily job only.';
comment on column public.lab_orders.last_chased_at is 'When the last reminder was sent.';

drop trigger lab_orders_reject_client_changes on public.lab_orders;
create trigger lab_orders_reject_client_changes before update on public.lab_orders
  for each row execute function private.reject_client_changes(
    'id', 'order_ref', 'patient_id', 'barcode', 'stripe_checkout_id', 'stripe_payment_intent_id', 'paid_at',
    'panel_id', 'lab_partner_id', 'price_pence', 'fee_pence', 'route', 'fasting', 'clinical_notes', 'cancelled_at',
    'status', 'sample_taken_at', 'appointment_id', 'due_by',
    'refunded_at', 'refund_pence', 'stripe_refund_id', 'refunded_by', 'chase_count', 'last_chased_at'
  );

-- Orders that are waiting for a reminder, with which one. Server only.
create function private.unpaid_orders_to_chase()
returns table (order_id uuid, for_patient uuid, reminder smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.patient_id, (o.chase_count + 1)::smallint
  from public.lab_orders o
  where o.status = 'sent_to_patient' and o.cancelled_at is null
    and o.created_at > now() - interval '30 days'
    and ((o.chase_count = 0 and o.created_at <= now() - interval '3 days')
      or (o.chase_count = 1 and o.created_at <= now() - interval '7 days'))
  order by o.created_at
  limit 200;
$$;

-- Counts the reminder just sent (1 or 2) only if the order is still at the one before it, so two runs of the
-- daily job that overlap cannot count one reminder twice or skip the second.
create function private.mark_lab_order_chased(_order uuid, _reminder smallint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  counted integer;
begin
  perform set_config('app.system_actor', 'order-reminder', true);
  update public.lab_orders set chase_count = _reminder, last_chased_at = now()
  where id = _order and status = 'sent_to_patient' and chase_count = _reminder - 1 and _reminder between 1 and 2;
  get diagnostics counted = row_count;
  perform set_config('app.system_actor', '', true);
  return counted = 1;
end;
$$;

-- An order nobody paid for in 30 days is cancelled. It stays on the record. Server only.
create function private.lapse_unpaid_lab_orders()
returns table (order_id uuid, for_patient uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.system_actor', 'order-lapse', true);
  return query
    update public.lab_orders o set status = 'cancelled', cancelled_at = now()
    where o.status = 'sent_to_patient' and o.paid_at is null and o.created_at <= now() - interval '30 days'
    returning o.id, o.patient_id;
  perform set_config('app.system_actor', '', true);
end;
$$;

create function public.unpaid_orders_to_chase()
returns table (order_id uuid, for_patient uuid, reminder smallint)
language sql stable security invoker set search_path = '' as $$ select * from private.unpaid_orders_to_chase(); $$;
create function public.mark_lab_order_chased(_order uuid, _reminder smallint)
returns boolean language sql security invoker set search_path = '' as $$ select private.mark_lab_order_chased(_order, _reminder); $$;
create function public.lapse_unpaid_lab_orders()
returns table (order_id uuid, for_patient uuid)
language sql security invoker set search_path = '' as $$ select * from private.lapse_unpaid_lab_orders(); $$;

-- 3. Clinical notes on an order are for staff ----------------------------------------------------------
-- Table-wide select is replaced by a list of columns without the notes, so no signed-in client can read them
-- through the API. A column added to lab_orders later needs its own grant to be readable. Staff read the notes
-- through lab_order_notes, which checks the role and that the patient is in their scope.
revoke select on public.lab_orders from authenticated;
grant select (
  id, order_ref, patient_id, panel_id, lab_partner_id, ordered_by, appointment_id, due_by, price_pence, status, barcode,
  stripe_checkout_id, stripe_payment_intent_id, paid_at, sample_taken_at, created_at, route, fee_pence, fasting,
  sample_date, cancelled_at, refunded_at, refund_pence
) on public.lab_orders to authenticated;
comment on column public.lab_orders.clinical_notes is 'Printed on the request form. For staff only: no signed-in client can select this column; staff use lab_order_notes().';

create function private.lab_order_notes(_order uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.lab_orders;
begin
  select * into o from public.lab_orders where id = _order;
  if not found or not (private.has_role('doctor') or private.has_role('pa') or private.has_role('admin')) or not private.in_scope(o.patient_id) then
    raise exception 'You cannot read the notes on this order.' using errcode = '42501';
  end if;
  return o.clinical_notes;
end;
$$;
create function public.lab_order_notes(_order uuid)
returns text language sql stable security invoker set search_path = '' as $$ select private.lab_order_notes(_order); $$;

-- 4. Patients who booked online and were not invited ----------------------------------------------------

alter table public.patient_profiles add column online_check_reminded_at timestamptz;
comment on column public.patient_profiles.online_check_reminded_at is 'When the team was reminded that this online booking was not checked. Once only. Written by the daily job only.';
drop trigger patient_profiles_reject_client_changes on public.patient_profiles;
create trigger patient_profiles_reject_client_changes before update on public.patient_profiles
  for each row execute function private.reject_client_changes('id', 'user_id', 'clinic_ref', 'ghl_contact_id', 'semble_patient_id', 'stripe_customer_id', 'online_check_reminded_at');

-- Whole working days (Monday to Friday) after the first date, up to and including the second.
create function private.working_days_between(_from date, _to date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select count(*)::integer from generate_series(_from + 1, _to, interval '1 day') d where extract(isodow from d) < 6;
$$;

-- New online records, two working days old, with no invitation and no account. Server only.
create function private.unchecked_online_patients()
returns table (for_patient uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.patient_profiles p
  where p.booked_online_at is not null and p.user_id is null and p.archived_at is null
    and p.online_check_reminded_at is null
    and private.working_days_between((p.booked_online_at at time zone 'Europe/London')::date, private.london_today()) >= 2
    and not exists (select 1 from public.invitations i where i.patient_id = p.id)
  order by p.booked_online_at
  limit 200;
$$;

create function private.mark_online_check_reminded(_patients uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.system_actor', 'online-check-reminder', true);
  update public.patient_profiles set online_check_reminded_at = now() where id = any(_patients) and online_check_reminded_at is null;
  perform set_config('app.system_actor', '', true);
end;
$$;

create function public.unchecked_online_patients()
returns table (for_patient uuid)
language sql stable security invoker set search_path = '' as $$ select * from private.unchecked_online_patients(); $$;
create function public.mark_online_check_reminded(_patients uuid[])
returns void language sql security invoker set search_path = '' as $$ select private.mark_online_check_reminded(_patients); $$;

-- 5. A no-show ----------------------------------------------------------------------------------------
-- Staff in scope mark an appointment that has ended and was never attended. The row is kept. A visit that
-- has ended and is not marked counts as completed on its own, so this is the one thing a person records.
create function private.mark_appointment_no_show(_appointment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.appointments;
begin
  select * into a from public.appointments where id = _appointment for update;
  -- PAs and admins mark any appointment of a patient they can open. A doctor marks their own appointments only,
  -- as the diary shows a doctor only their own bookings.
  if not found
    or not private.in_scope(a.patient_id)
    or not (
      private.has_role('pa') or private.has_role('admin')
      or (private.has_role('doctor') and a.clinician_id is not null and a.clinician_id = (select private.my_staff_id()))
    ) then
    raise exception 'You cannot change this appointment.' using errcode = '42501';
  end if;
  if a.status not in ('booked', 'confirmed') then
    raise exception 'This appointment is not open.' using errcode = '22023';
  end if;
  if a.starts_at + make_interval(mins => a.duration_min) > now() then
    raise exception 'An appointment can be marked as a no-show once it has ended.' using errcode = '22023';
  end if;
  update public.appointments set status = 'no_show' where id = _appointment;
end;
$$;
comment on function private.mark_appointment_no_show(uuid) is 'A PA or admin in scope, or the doctor whose appointment it is, marks an appointment that has ended as a no-show.';
-- A wrong mark is put right by a PA or admin in scope: the appointment goes back to booked, which for a visit that
-- has ended counts as completed again.
create function private.undo_appointment_no_show(_appointment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.appointments;
begin
  select * into a from public.appointments where id = _appointment for update;
  if not found or not (private.has_role('pa') or private.has_role('admin')) or not private.in_scope(a.patient_id) then
    raise exception 'You cannot change this appointment.' using errcode = '42501';
  end if;
  if a.status <> 'no_show' then
    raise exception 'This appointment is not marked as a no-show.' using errcode = '22023';
  end if;
  update public.appointments set status = 'booked' where id = _appointment;
end;
$$;
comment on function private.undo_appointment_no_show(uuid) is 'A PA or admin in scope puts a wrong no-show right.';
create function public.undo_appointment_no_show(_appointment uuid)
returns void language sql security invoker set search_path = '' as $$ select private.undo_appointment_no_show(_appointment); $$;

create function public.mark_appointment_no_show(_appointment uuid)
returns void language sql security invoker set search_path = '' as $$ select private.mark_appointment_no_show(_appointment); $$;

-- Grants --------------------------------------------------------------------------------------------

revoke all on function
  private.unpaid_orders_to_chase(), private.mark_lab_order_chased(uuid, smallint), private.lapse_unpaid_lab_orders(),
  public.unpaid_orders_to_chase(), public.mark_lab_order_chased(uuid, smallint), public.lapse_unpaid_lab_orders(),
  private.working_days_between(date, date),
  private.unchecked_online_patients(), private.mark_online_check_reminded(uuid[]),
  public.unchecked_online_patients(), public.mark_online_check_reminded(uuid[]),
  private.lab_order_notes(uuid), public.lab_order_notes(uuid)
from public, anon, authenticated;
grant execute on function
  private.unpaid_orders_to_chase(), private.mark_lab_order_chased(uuid, smallint), private.lapse_unpaid_lab_orders(),
  public.unpaid_orders_to_chase(), public.mark_lab_order_chased(uuid, smallint), public.lapse_unpaid_lab_orders(),
  private.working_days_between(date, date),
  private.unchecked_online_patients(), private.mark_online_check_reminded(uuid[]),
  public.unchecked_online_patients(), public.mark_online_check_reminded(uuid[])
to service_role;
grant execute on function private.lab_order_notes(uuid), public.lab_order_notes(uuid) to authenticated;
revoke all on function private.mark_appointment_no_show(uuid), public.mark_appointment_no_show(uuid), private.undo_appointment_no_show(uuid), public.undo_appointment_no_show(uuid) from public, anon, authenticated;
grant execute on function private.mark_appointment_no_show(uuid), public.mark_appointment_no_show(uuid), private.undo_appointment_no_show(uuid), public.undo_appointment_no_show(uuid) to authenticated;
