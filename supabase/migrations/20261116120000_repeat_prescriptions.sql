-- Repeat prescriptions in the portal, replacing the clinic's Typeform (knowledge base flow 8 and
-- question 13). A patient, a guardian who can act, or a PA asks for up to ten medicines at once: the
-- patient's current medicines, medicines on the clinic's list, or one typed in. Each comes as one or
-- two months' supply (Dr Schoeman, 10 November 2026). Weight-loss medicines need four extra answers.
-- The £30 fee is paid through Stripe; the webhook marks the request paid. A doctor or PA then
-- approves, declines or marks it sent to the pharmacy, as flow 8 says; admins write no clinical data.
-- Prescribing itself stays in SignatureRx.

-- The clinic's list of medicines patients can ask for -------------------------------------------

create table public.prescribable_medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  weight_loss boolean not null default false,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.prescribable_medicines is 'The clinic''s list of medicines a patient can ask to repeat. Admins and doctors keep it.';
comment on column public.prescribable_medicines.weight_loss is 'A weight-loss medicine (GLP-1): asking for it brings up the weight and side-effect questions.';
create unique index prescribable_medicines_name_key on public.prescribable_medicines (lower(btrim(name))) where archived_at is null;

create trigger prescribable_medicines_write_audit_log after insert or update or delete on public.prescribable_medicines
  for each row execute function private.write_audit_log();

alter table public.prescribable_medicines enable row level security;
alter table public.prescribable_medicines force row level security;
revoke all on table public.prescribable_medicines from public, anon, authenticated;
revoke delete, truncate on public.prescribable_medicines from service_role;
grant select on public.prescribable_medicines to authenticated;
grant insert (name, weight_loss, sort_order) on public.prescribable_medicines to authenticated;
grant update (name, weight_loss, sort_order, archived_at) on public.prescribable_medicines to authenticated;

create policy "Signed-in people read the clinic's medicine list" on public.prescribable_medicines
  for select to authenticated
  using (archived_at is null or (select private.has_role('admin')) or (select private.has_role('doctor')));
create policy "Admins and doctors add to the medicine list" on public.prescribable_medicines
  for insert to authenticated
  with check ((select private.has_role('admin')) or (select private.has_role('doctor')));
create policy "Admins and doctors change the medicine list" on public.prescribable_medicines
  for update to authenticated
  using ((select private.has_role('admin')) or (select private.has_role('doctor')))
  with check ((select private.has_role('admin')) or (select private.has_role('doctor')));

-- The list from the clinic's Typeform, with its spelling tidied.
insert into public.prescribable_medicines (name, weight_loss, sort_order) values
  ('Androfemme', false, 10),
  ('Armour Thyroid', false, 20),
  ('Cyclogest (progesterone) pessaries', false, 30),
  ('DHEA capsules', false, 40),
  ('Elleste Solo', false, 50),
  ('Euthyral 100', false, 60),
  ('H2 Hair Tonic', false, 70),
  ('HUX D3 20,000 IU', false, 80),
  ('Levothyroxine', false, 90),
  ('Melatonin', false, 100),
  ('Mounjaro', true, 110),
  ('Novothyral', false, 120),
  ('Oestrogel', false, 130),
  ('Oestrogel pump', false, 140),
  ('Ovestin', false, 150),
  ('Ozempic', true, 160),
  ('Progesterone compounded capsules', false, 170),
  ('Semaglutide', true, 180),
  ('Testosterone cream', false, 190),
  ('Testosterone lozenge', false, 200),
  ('Thybon', false, 210),
  ('Utrogestan (progesterone) capsules', false, 220),
  ('Vagifem (oestradiol) vaginal tablets', false, 230),
  ('Wegovy (semaglutide)', true, 240);

-- The request ----------------------------------------------------------------------------------

-- One request now holds several medicines (repeat_request_items), so the single medicine becomes
-- optional; it stays for requests made before this change.
alter table public.repeat_requests
  alter column medication_id drop not null,
  add column has_future_appointment boolean,
  add column wants_appointment boolean,
  add column still_losing_weight boolean,
  add column weight_lost_last_month text check (char_length(weight_lost_last_month) <= 200),
  add column has_side_effects boolean,
  add column side_effects text check (char_length(side_effects) <= 2000),
  add column paid_at timestamptz,
  add column stripe_checkout_session_id text unique,
  add column cancelled_at timestamptz,
  add column decided_by uuid references public.profiles (id) on delete restrict,
  add column decision_note text check (char_length(decision_note) <= 2000),
  add constraint repeat_requests_note_length check (char_length(note) <= 2000),
  add constraint repeat_requests_id_patient_unique unique (id, patient_id);
comment on column public.repeat_requests.medication_id is 'Requests made before 16 November 2026 named one medicine here. Newer requests list theirs in repeat_request_items.';
comment on column public.repeat_requests.paid_at is 'When Stripe confirmed the fee. Written by the webhook only.';
comment on column public.repeat_requests.cancelled_at is 'The patient side withdrew a request before paying.';
comment on column public.repeat_requests.decided_by is 'The team member who last moved the request on.';
comment on column public.repeat_requests.decision_note is 'The team''s note to the patient, for example why a request was declined.';
create index repeat_requests_decided_by_idx on public.repeat_requests (decided_by);
create index repeat_requests_paid_idx on public.repeat_requests (paid_at desc) where paid_at is not null;

create table public.repeat_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  medication_id uuid,
  medicine_id uuid references public.prescribable_medicines (id) on delete restrict,
  other_name text check (char_length(btrim(other_name)) between 1 and 200),
  supply_months smallint not null check (supply_months in (1, 2)),
  created_at timestamptz not null default now(),
  constraint repeat_request_items_one_medicine check (num_nonnulls(medication_id, medicine_id, other_name) = 1),
  constraint repeat_request_items_request_fkey foreign key (request_id, patient_id)
    references public.repeat_requests (id, patient_id) on delete restrict,
  -- A current medicine must be the same patient's.
  constraint repeat_request_items_medication_fkey foreign key (medication_id, patient_id)
    references public.medications (id, patient_id) on delete restrict
);
comment on table public.repeat_request_items is 'The medicines in a repeat request: the patient''s own, one from the clinic''s list, or one typed in, each for one or two months.';
create index repeat_request_items_request_idx on public.repeat_request_items (request_id, patient_id);
create index repeat_request_items_patient_idx on public.repeat_request_items (patient_id);
create index repeat_request_items_medication_idx on public.repeat_request_items (medication_id, patient_id);
create index repeat_request_items_medicine_idx on public.repeat_request_items (medicine_id);

create trigger repeat_request_items_write_audit_log after insert or update or delete on public.repeat_request_items
  for each row execute function private.write_audit_log();

alter table public.repeat_request_items enable row level security;
alter table public.repeat_request_items force row level security;
revoke all on table public.repeat_request_items from public, anon, authenticated;
revoke delete, truncate on public.repeat_request_items from service_role;
grant select on public.repeat_request_items to authenticated;

create policy "Patients, guardians and staff in scope read requested medicines" on public.repeat_request_items
  for select to authenticated
  using (patient_id in (select private.my_patient_ids()) or private.in_scope(patient_id));

-- Requests are now made, withdrawn and moved on only through the functions below, so nobody can
-- mark their own request paid or approved.
drop policy "Patients and guardians who can act, and PAs, add repeat requests" on public.repeat_requests;
drop policy "PAs and doctors change repeat request status" on public.repeat_requests;
revoke insert, update on public.repeat_requests from authenticated;

-- Is this a weight-loss medicine? True for one on the clinic's list marked so, and for a current or
-- typed-in medicine whose name contains the first word of one (Mounjaro 5 mg, Wegovy pen).
create function private.is_weight_loss_name(_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.prescribable_medicines m
    where m.weight_loss and m.archived_at is null
      and position(lower(split_part(btrim(m.name), ' ', 1)) in lower(coalesce(_name, ''))) > 0
  );
$$;

-- Asking for a repeat. _items is a list of {"medication_id" | "medicine_id" | "other_name", "supply_months"}.
create function private.request_repeat(
  _patient uuid,
  _items jsonb,
  _has_future_appointment boolean,
  _wants_appointment boolean,
  _still_losing_weight boolean,
  _weight_lost_last_month text,
  _has_side_effects boolean,
  _side_effects text,
  _note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  request uuid;
  item jsonb;
  medication uuid;
  medicine uuid;
  other text;
  months smallint;
  weight_loss boolean := false;
  seen_medications uuid[] := '{}';
  seen_medicines uuid[] := '{}';
begin
  if actor is null or not (
    private.can_act_for(_patient)
    or (private.has_role('pa') and private.in_scope(_patient))
  ) then
    raise exception 'You cannot request a repeat for this patient.' using errcode = '42501';
  end if;
  if _has_future_appointment is null then
    raise exception 'Say whether a future appointment is booked.' using errcode = '22023';
  end if;
  if _items is null or jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) not between 1 and 10 then
    raise exception 'Choose between one and ten medicines.' using errcode = '22023';
  end if;
  if char_length(_note) > 2000 or char_length(_weight_lost_last_month) > 200 or char_length(_side_effects) > 2000 then
    raise exception 'One of the answers is too long.' using errcode = '22023';
  end if;

  -- Check every medicine before writing anything.
  for item in select * from jsonb_array_elements(_items) loop
    medication := private.try_uuid(item ->> 'medication_id');
    medicine := private.try_uuid(item ->> 'medicine_id');
    other := nullif(btrim(item ->> 'other_name'), '');
    months := case when item ->> 'supply_months' in ('1', '2') then (item ->> 'supply_months')::smallint end;
    if months is null then
      raise exception 'Choose one or two months for each medicine.' using errcode = '22023';
    end if;
    if num_nonnulls(medication, medicine, other) <> 1 then
      raise exception 'Each line must name one medicine.' using errcode = '22023';
    end if;
    if medication is not null then
      if medication = any (seen_medications) or not exists (
        select 1 from public.medications m
        where m.id = medication and m.patient_id = _patient and m.status = 'active' and m.archived_at is null
      ) then
        raise exception 'One of the medicines is not on the current list.' using errcode = '22023';
      end if;
      seen_medications := seen_medications || medication;
      weight_loss := weight_loss or private.is_weight_loss_name((select m.name from public.medications m where m.id = medication));
    elsif medicine is not null then
      if medicine = any (seen_medicines) or not exists (
        select 1 from public.prescribable_medicines p where p.id = medicine and p.archived_at is null
      ) then
        raise exception 'One of the medicines is not on the clinic''s list.' using errcode = '22023';
      end if;
      seen_medicines := seen_medicines || medicine;
      weight_loss := weight_loss or (select p.weight_loss from public.prescribable_medicines p where p.id = medicine);
    else
      if char_length(other) > 200 then
        raise exception 'Use 200 characters or fewer for a medicine name.' using errcode = '22023';
      end if;
      weight_loss := weight_loss or private.is_weight_loss_name(other);
    end if;
  end loop;

  if weight_loss and (_still_losing_weight is null or _has_side_effects is null) then
    raise exception 'Answer the weight-loss questions.' using errcode = '22023';
  end if;
  if weight_loss and _has_side_effects and nullif(btrim(_side_effects), '') is null then
    raise exception 'Describe the side effects.' using errcode = '22023';
  end if;

  insert into public.repeat_requests (
    patient_id, requested_by, note, has_future_appointment, wants_appointment,
    still_losing_weight, weight_lost_last_month, has_side_effects, side_effects
  ) values (
    _patient, actor, nullif(btrim(_note), ''), _has_future_appointment,
    case when _has_future_appointment then null else _wants_appointment end,
    case when weight_loss then _still_losing_weight end,
    case when weight_loss and _still_losing_weight then nullif(btrim(_weight_lost_last_month), '') end,
    case when weight_loss then _has_side_effects end,
    case when weight_loss and _has_side_effects then btrim(_side_effects) end
  )
  returning id into request;

  insert into public.repeat_request_items (request_id, patient_id, medication_id, medicine_id, other_name, supply_months)
  select request, _patient,
    private.try_uuid(i ->> 'medication_id'),
    private.try_uuid(i ->> 'medicine_id'),
    nullif(btrim(i ->> 'other_name'), ''),
    (i ->> 'supply_months')::smallint
  from jsonb_array_elements(_items) i;

  return request;
end;
$$;
comment on function private.request_repeat(uuid, jsonb, boolean, boolean, boolean, text, boolean, text, text) is 'A patient, a guardian who can act, or a PA asks for up to ten medicines. Returns the request id; payment follows.';

-- Withdrawing a request that has not been paid.
create function private.cancel_repeat_request(_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.repeat_requests;
begin
  select * into r from public.repeat_requests where id = _request for update;
  if not found or not (
    private.can_act_for(r.patient_id)
    or ((private.has_role('pa') or private.has_role('doctor')) and private.in_scope(r.patient_id))
  ) then
    raise exception 'You cannot withdraw this request.' using errcode = '42501';
  end if;
  if r.paid_at is not null or r.status <> 'requested' or r.cancelled_at is not null then
    raise exception 'Only an unpaid request can be withdrawn.' using errcode = '22023';
  end if;
  update public.repeat_requests set cancelled_at = now() where id = _request;
end;
$$;

-- A doctor or PA moves a request on: approved, declined, or sent to the pharmacy.
create function private.decide_repeat_request(_request uuid, _status public.request_status, _note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.repeat_requests;
begin
  select * into r from public.repeat_requests where id = _request for update;
  if not found or not (
    (private.has_role('pa') or private.has_role('doctor')) and private.in_scope(r.patient_id)
  ) then
    raise exception 'You cannot change this request.' using errcode = '42501';
  end if;
  if r.cancelled_at is not null then
    raise exception 'This request was withdrawn.' using errcode = '22023';
  end if;
  if not (
    (r.status = 'requested' and _status in ('approved', 'declined', 'sent_to_pharmacy'))
    or (r.status = 'approved' and _status in ('declined', 'sent_to_pharmacy'))
  ) then
    raise exception 'That change is not allowed from the request''s current status.' using errcode = '22023';
  end if;
  if char_length(_note) > 2000 then
    raise exception 'Use 2,000 characters or fewer for the note.' using errcode = '22023';
  end if;
  if _status = 'declined' and nullif(btrim(_note), '') is null then
    raise exception 'Say why the request is declined.' using errcode = '22023';
  end if;
  update public.repeat_requests
  set status = _status,
      decided_by = (select auth.uid()),
      decision_note = coalesce(nullif(btrim(_note), ''), decision_note),
      resolved_at = case when _status in ('declined', 'sent_to_pharmacy') then now() end
  where id = _request;
end;
$$;

-- Stripe has confirmed the fee. Server only. True the first time; false when already recorded or
-- not found, so a repeated webhook does nothing. A late payment on a withdrawn request reinstates it.
create function private.mark_repeat_request_paid(_request uuid, _session text, _payment_intent text, _amount integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.repeat_requests;
begin
  perform set_config('app.system_actor', 'stripe', true);
  select * into r from public.repeat_requests where id = _request for update;
  if not found or r.paid_at is not null then
    perform set_config('app.system_actor', '', true);
    return false;
  end if;
  if _amount is distinct from r.fee_pence then
    raise exception 'The amount paid does not match the fee.' using errcode = '22023';
  end if;
  if r.status = 'declined' then
    raise exception 'The request was declined before it was paid for.' using errcode = '22023';
  end if;
  update public.repeat_requests
  set paid_at = now(), stripe_checkout_session_id = _session, stripe_payment_intent_id = _payment_intent, cancelled_at = null
  where id = _request;
  perform set_config('app.system_actor', '', true);
  return true;
end;
$$;

-- Medicines running out: the daily job remembers which run-out date it has warned about.
alter table public.medications add column run_out_reminded_for date;
comment on column public.medications.run_out_reminded_for is 'The run-out date the patient was last reminded about, three weeks ahead. Written by the daily job only.';

create function private.mark_run_out_reminded(_medication uuid, _run_out date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.system_actor', 'prescription-reminder', true);
  update public.medications set run_out_reminded_for = _run_out where id = _medication;
  perform set_config('app.system_actor', '', true);
end;
$$;

-- Wrappers in the exposed schema, and who may call what.
create function public.request_repeat(
  _patient uuid, _items jsonb, _has_future_appointment boolean, _wants_appointment boolean,
  _still_losing_weight boolean, _weight_lost_last_month text, _has_side_effects boolean, _side_effects text, _note text
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.request_repeat(_patient, _items, _has_future_appointment, _wants_appointment, _still_losing_weight, _weight_lost_last_month, _has_side_effects, _side_effects, _note);
$$;
create function public.cancel_repeat_request(_request uuid)
returns void language sql security invoker set search_path = '' as $$ select private.cancel_repeat_request(_request); $$;
create function public.decide_repeat_request(_request uuid, _status public.request_status, _note text)
returns void language sql security invoker set search_path = '' as $$ select private.decide_repeat_request(_request, _status, _note); $$;
create function public.mark_repeat_request_paid(_request uuid, _session text, _payment_intent text, _amount integer)
returns boolean language sql security invoker set search_path = '' as $$ select private.mark_repeat_request_paid(_request, _session, _payment_intent, _amount); $$;
create function public.mark_run_out_reminded(_medication uuid, _run_out date)
returns void language sql security invoker set search_path = '' as $$ select private.mark_run_out_reminded(_medication, _run_out); $$;

revoke all on function
  private.is_weight_loss_name(text),
  private.request_repeat(uuid, jsonb, boolean, boolean, boolean, text, boolean, text, text),
  private.cancel_repeat_request(uuid),
  private.decide_repeat_request(uuid, public.request_status, text),
  private.mark_repeat_request_paid(uuid, text, text, integer),
  private.mark_run_out_reminded(uuid, date),
  public.request_repeat(uuid, jsonb, boolean, boolean, boolean, text, boolean, text, text),
  public.cancel_repeat_request(uuid),
  public.decide_repeat_request(uuid, public.request_status, text),
  public.mark_repeat_request_paid(uuid, text, text, integer),
  public.mark_run_out_reminded(uuid, date)
from public, anon, authenticated;
grant execute on function
  private.is_weight_loss_name(text),
  private.request_repeat(uuid, jsonb, boolean, boolean, boolean, text, boolean, text, text),
  private.cancel_repeat_request(uuid),
  private.decide_repeat_request(uuid, public.request_status, text),
  public.request_repeat(uuid, jsonb, boolean, boolean, boolean, text, boolean, text, text),
  public.cancel_repeat_request(uuid),
  public.decide_repeat_request(uuid, public.request_status, text)
to authenticated;
grant execute on function
  private.mark_repeat_request_paid(uuid, text, text, integer),
  private.mark_run_out_reminded(uuid, date),
  public.mark_repeat_request_paid(uuid, text, text, integer),
  public.mark_run_out_reminded(uuid, date)
to service_role;
