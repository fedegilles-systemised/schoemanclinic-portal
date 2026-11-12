-- SignatureRx: a doctor sends an approved repeat request to SignatureRx as a prescription (knowledge
-- base flow 8). Prescribing and signing stay in SignatureRx; Clinic Hub creates the prescription
-- there and keeps only its reference and its state. The doctor's signing PIN is never stored: it
-- goes from the form to SignatureRx and nowhere else, so there is no column for it.
--
--   1. The patient's postal address, which every SignatureRx prescription needs.
--   2. Each doctor's SignatureRx integration code, readable by server code only.
--   3. One row for each prescription sent, with its state, readable by the clinical team in scope.

-- 1. The patient's address ------------------------------------------------------------------------

alter table public.patient_profiles
  add column address_line1 text,
  add column address_line2 text,
  add column city text,
  add column postcode text;
alter table public.patient_profiles
  add constraint patient_profiles_address_length check (
    (address_line1 is null or char_length(address_line1) <= 200)
    and (address_line2 is null or char_length(address_line2) <= 200)
    and (city is null or char_length(city) <= 100)
    and (postcode is null or char_length(postcode) <= 20)
  );
comment on column public.patient_profiles.address_line1 is 'Postal address, first line. SignatureRx needs it for every prescription. Set by clinic staff.';
comment on column public.patient_profiles.postcode is 'Postal code. Held with the rest of the address, which only the clinical team reads.';

grant insert (address_line1, address_line2, city, postcode) on public.patient_profiles to authenticated;
grant update (address_line1, address_line2, city, postcode) on public.patient_profiles to authenticated;

-- 2. Each doctor's integration code ---------------------------------------------------------------

create table public.signaturerx_prescribers (
  user_id uuid primary key references public.profiles (id) on delete restrict,
  integration_code text not null check (char_length(integration_code) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.signaturerx_prescribers is 'The SignatureRx integration code of each prescribing doctor. Server code only: nobody signed in can read it, and it is never sent to the browser. The signing PIN is not kept anywhere.';
create trigger signaturerx_prescribers_set_updated_at before update on public.signaturerx_prescribers
  for each row execute function private.set_updated_at();
create trigger signaturerx_prescribers_write_audit_log after insert or update or delete on public.signaturerx_prescribers
  for each row execute function private.write_audit_log();

alter table public.signaturerx_prescribers enable row level security;
alter table public.signaturerx_prescribers force row level security;
revoke all on table public.signaturerx_prescribers from public, anon, authenticated, service_role;
grant select on public.signaturerx_prescribers to service_role;

-- A doctor saves or replaces their own code. Nobody else can set it for them.
create function private.set_my_signaturerx_code(_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  code text := btrim(coalesce(_code, ''));
begin
  if me is null or not (select private.has_role('doctor')) then
    raise exception 'Only a doctor can save a SignatureRx integration code.' using errcode = '42501';
  end if;
  if char_length(code) not between 1 and 200 then
    raise exception 'Enter the integration code from SignatureRx.' using errcode = '22023';
  end if;
  insert into public.signaturerx_prescribers (user_id, integration_code) values (me, code)
  on conflict (user_id) do update set integration_code = excluded.integration_code;
end;
$$;

-- Whether the signed-in doctor has saved a code, so the form knows whether to ask for it.
create function private.has_my_signaturerx_code()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.signaturerx_prescribers p where p.user_id = (select auth.uid()));
$$;

-- 3. Prescriptions sent ---------------------------------------------------------------------------

create table public.signaturerx_prescriptions (
  id uuid primary key default gen_random_uuid(),
  repeat_request_id uuid not null references public.repeat_requests (id) on delete restrict,
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  -- Empty while the send is under way: the row is written first, so a send that fails half way is
  -- never invisible and a second send cannot start.
  srx_prescription_id text unique check (srx_prescription_id is null or char_length(srx_prescription_id) between 1 and 100),
  action text not null check (action in ('draft', 'issueOnly')),
  -- 'sending' and 'failed' are ours; the rest are SignatureRx's own states.
  status text check (status is null or char_length(status) <= 60),
  detailed_status text check (detailed_status is null or char_length(detailed_status) <= 60),
  last_error text check (last_error is null or char_length(last_error) <= 300),
  sent_by uuid not null references public.profiles (id) on delete restrict,
  sent_at timestamptz not null default now(),
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.signaturerx_prescriptions is 'A repeat request sent to SignatureRx as a prescription: its SignatureRx id and its last known state. No medicine, quantity, direction or PIN is kept here; those stay in SignatureRx.';
comment on column public.signaturerx_prescriptions.status is 'sending (under way), failed (SignatureRx refused it, nothing was created), or the state SignatureRx reports.';
create index signaturerx_prescriptions_request_idx on public.signaturerx_prescriptions (repeat_request_id);
create index signaturerx_prescriptions_patient_idx on public.signaturerx_prescriptions (patient_id);
create index signaturerx_prescriptions_sent_by_idx on public.signaturerx_prescriptions (sent_by);
-- One open send for each request: a failed, voided or expired one does not count, so a doctor can
-- try again after those, and never twice at once.
create unique index signaturerx_prescriptions_one_open_idx on public.signaturerx_prescriptions (repeat_request_id)
  where coalesce(status, '') not in ('failed', 'voided', 'expired');
create trigger signaturerx_prescriptions_write_audit_log after insert or update or delete on public.signaturerx_prescriptions
  for each row execute function private.write_audit_log();

alter table public.signaturerx_prescriptions enable row level security;
alter table public.signaturerx_prescriptions force row level security;
revoke all on table public.signaturerx_prescriptions from public, anon, authenticated, service_role;
grant select on public.signaturerx_prescriptions to authenticated, service_role;

create policy "Doctors, PAs and admins in scope read SignatureRx prescriptions" on public.signaturerx_prescriptions
  for select to authenticated
  using (
    ((select private.has_role('doctor')) or (select private.has_role('pa')) or (select private.has_role('admin')))
    and private.in_scope(patient_id)
  );
-- No write policies: only the two server functions below add or change a row.

-- May this doctor send a prescription for this patient? The doctor must be on the patient's care
-- team today, and the patient must not be the doctor or someone the doctor is a guardian of, so a
-- doctor can never prescribe for themselves. Mirrors private.in_scope for a named person, because
-- server code acts for the doctor and has no session of its own.
create function private.staff_may_send_prescription(_by uuid, _patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _by is not null
    and _patient is not null
    and exists (select 1 from public.user_roles x where x.user_id = _by and x.role = 'doctor')
    and private.is_active_staff(_by)
    and exists (
      select 1
      from public.care_team ct
      join public.staff_profiles s on s.id = ct.staff_id
      where s.user_id = _by
        and ct.patient_id = _patient
        and ct.since <= private.london_today()
        and (ct.until is null or ct.until > private.london_today())
    )
    and not exists (select 1 from public.patient_profiles pp where pp.id = _patient and pp.user_id = _by)
    and not exists (select 1 from public.patient_guardians g where g.patient_id = _patient and g.guardian_user_id = _by);
$$;
comment on function private.staff_may_send_prescription(uuid, uuid) is 'A doctor on the patient''s care team today, who is neither the patient nor their guardian. Used before a prescription is sent and again when the send is recorded.';

-- The signed-in doctor asks whether they may send this approved request.
create function private.can_send_to_signaturerx(_request uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.repeat_requests r
    where r.id = _request
      and r.status = 'approved'
      and r.cancelled_at is null
      and private.staff_may_send_prescription((select auth.uid()), r.patient_id)
  );
$$;

-- Server code opens a send, before anything is created at SignatureRx. It fails if the request is
-- not approved, if the sender may not prescribe for this patient, or if a send is already open.
create function private.start_signaturerx_send(_request uuid, _action text, _by uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.repeat_requests;
  new_id uuid;
begin
  perform set_config('app.actor_id', coalesce(_by::text, ''), true);
  select * into r from public.repeat_requests where id = _request for update;
  if not found or r.status <> 'approved' or r.cancelled_at is not null then
    raise exception 'Only an approved request can be sent to SignatureRx.' using errcode = '22023';
  end if;
  if not private.staff_may_send_prescription(_by, r.patient_id) then
    raise exception 'Only a doctor on this patient''s care team can send a prescription for them.' using errcode = '42501';
  end if;
  begin
    insert into public.signaturerx_prescriptions (repeat_request_id, patient_id, action, status, sent_by)
    values (_request, r.patient_id, _action, 'sending', _by)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'This request has already been sent to SignatureRx, or is being sent. Check SignatureRx before sending again.' using errcode = '23505';
  end;
  perform set_config('app.actor_id', '', true);
  return new_id;
end;
$$;

-- Server code closes a send that SignatureRx accepted, with the id and state it gave.
create function private.finish_signaturerx_send(_id uuid, _srx_id text, _status text, _detailed text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.system_actor', 'signaturerx', true);
  update public.signaturerx_prescriptions
  set srx_prescription_id = _srx_id, status = nullif(_status, ''), detailed_status = nullif(_detailed, ''), last_checked_at = now()
  where id = _id and status = 'sending';
  if not found then
    perform set_config('app.system_actor', '', true);
    raise exception 'That send is not open.' using errcode = '22023';
  end if;
  perform set_config('app.system_actor', '', true);
end;
$$;

-- Server code closes a send that SignatureRx refused. Nothing was created there, so another try is allowed.
create function private.fail_signaturerx_send(_id uuid, _reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.system_actor', 'signaturerx', true);
  update public.signaturerx_prescriptions
  set status = 'failed', last_error = left(coalesce(_reason, ''), 300)
  where id = _id and status = 'sending';
  perform set_config('app.system_actor', '', true);
end;
$$;

-- Server code stores the latest state it read from SignatureRx.
create function private.refresh_signaturerx_prescription(_id uuid, _status text, _detailed text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.system_actor', 'signaturerx', true);
  update public.signaturerx_prescriptions
  set status = nullif(_status, ''), detailed_status = nullif(_detailed, ''), last_checked_at = now()
  where id = _id and srx_prescription_id is not null and coalesce(status, '') <> 'failed';
  perform set_config('app.system_actor', '', true);
end;
$$;

-- Wrappers and grants -----------------------------------------------------------------------------

create function public.set_my_signaturerx_code(_code text)
returns void language sql security invoker set search_path = ''
as $$ select private.set_my_signaturerx_code(_code); $$;
create function public.has_my_signaturerx_code()
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.has_my_signaturerx_code(); $$;
create function public.can_send_to_signaturerx(_request uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.can_send_to_signaturerx(_request); $$;
create function public.start_signaturerx_send(_request uuid, _action text, _by uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.start_signaturerx_send(_request, _action, _by); $$;
create function public.finish_signaturerx_send(_id uuid, _srx_id text, _status text, _detailed text)
returns void language sql security invoker set search_path = ''
as $$ select private.finish_signaturerx_send(_id, _srx_id, _status, _detailed); $$;
create function public.fail_signaturerx_send(_id uuid, _reason text)
returns void language sql security invoker set search_path = ''
as $$ select private.fail_signaturerx_send(_id, _reason); $$;
create function public.refresh_signaturerx_prescription(_id uuid, _status text, _detailed text)
returns void language sql security invoker set search_path = ''
as $$ select private.refresh_signaturerx_prescription(_id, _status, _detailed); $$;

revoke all on function
  private.set_my_signaturerx_code(text),
  private.has_my_signaturerx_code(),
  private.staff_may_send_prescription(uuid, uuid),
  private.can_send_to_signaturerx(uuid),
  private.start_signaturerx_send(uuid, text, uuid),
  private.finish_signaturerx_send(uuid, text, text, text),
  private.fail_signaturerx_send(uuid, text),
  private.refresh_signaturerx_prescription(uuid, text, text),
  public.set_my_signaturerx_code(text),
  public.has_my_signaturerx_code(),
  public.can_send_to_signaturerx(uuid),
  public.start_signaturerx_send(uuid, text, uuid),
  public.finish_signaturerx_send(uuid, text, text, text),
  public.fail_signaturerx_send(uuid, text),
  public.refresh_signaturerx_prescription(uuid, text, text)
from public, anon, authenticated;

grant execute on function
  private.set_my_signaturerx_code(text),
  private.has_my_signaturerx_code(),
  private.can_send_to_signaturerx(uuid),
  public.set_my_signaturerx_code(text),
  public.has_my_signaturerx_code(),
  public.can_send_to_signaturerx(uuid)
to authenticated;

grant execute on function
  private.start_signaturerx_send(uuid, text, uuid),
  private.finish_signaturerx_send(uuid, text, text, text),
  private.fail_signaturerx_send(uuid, text),
  private.refresh_signaturerx_prescription(uuid, text, text),
  private.staff_may_send_prescription(uuid, uuid),
  public.start_signaturerx_send(uuid, text, uuid),
  public.finish_signaturerx_send(uuid, text, text, text),
  public.fail_signaturerx_send(uuid, text),
  public.refresh_signaturerx_prescription(uuid, text, text)
to service_role;
