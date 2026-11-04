-- Invitations: who can invite whom, how an invitation is created, cancelled and accepted.
-- Sign-up is invitation only. Every write goes through the functions below, called by server
-- code with the service role. Each function re-checks who is asking, so a mistake in the app
-- cannot hand out access, and each names the person it acts for, so the audit log is true.
-- Closes S-03 and S-43 (acceptance checks) and S-07 for this flow.

create type public.invitation_kind as enum ('patient', 'guardian', 'team');

alter table public.invitations
  add column kind public.invitation_kind,
  add column relationship public.guardian_relationship,
  add column can_act boolean,
  add column job_title text,
  add column full_name text,
  add column revoked_at timestamptz,
  add column sent_at timestamptz not null default now();

update public.invitations
set kind = case when role = 'patient' then 'patient'::public.invitation_kind else 'team'::public.invitation_kind end;
alter table public.invitations alter column kind set not null;
-- A guardian has no role of their own: they are a link to a patient.
alter table public.invitations alter column role drop not null;

alter table public.invitations
  add constraint invitations_kind_fields check (
    (kind = 'patient' and role = 'patient' and patient_id is not null and relationship is null and can_act is null and job_title is null)
    or (kind = 'guardian' and role is null and patient_id is not null and relationship is not null and can_act is not null and job_title is null)
    or (kind = 'team' and role in ('doctor', 'pa', 'health_coach', 'admin') and patient_id is null and relationship is null and can_act is null)
  ),
  add constraint invitations_text_length check (
    (full_name is null or char_length(full_name) <= 120)
    and (job_title is null or char_length(job_title) <= 120)
  ),
  add constraint invitations_not_used_and_cancelled check (not (accepted_at is not null and revoked_at is not null));

comment on column public.invitations.kind is 'patient: an account for a patient record. guardian: a link to a patient. team: a staff member.';
comment on column public.invitations.revoked_at is 'Set when the invitation is cancelled, or replaced by a resend. A cancelled invitation can never be accepted.';
comment on column public.invitations.sent_at is 'When the email was last sent. A resend makes a new invitation, with a new link.';

-- A cancelled or expired invitation no longer blocks a new one to the same address.
drop index public.invitations_one_pending_per_email;
create unique index invitations_one_pending_per_email on public.invitations (lower(email)) where accepted_at is null and revoked_at is null;
create unique index invitations_token_hash_idx on public.invitations (token_hash);

grant select (kind, relationship, can_act, job_title, full_name, revoked_at, sent_at) on public.invitations to authenticated;

-- PAs read patient and guardian invitations for patients they can reach. Admins read all.
drop policy "PAs and admins read invitations" on public.invitations;
create policy "PAs read patient and guardian invitations and admins read all" on public.invitations
  for select to authenticated
  using (
    (select private.has_role('admin'))
    or ((select private.has_role('pa')) and kind <> 'team' and private.in_scope(patient_id))
  );

-- Helpers -----------------------------------------------------------------------------

create function private.invitation_lifetime()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '3 days' $$;
comment on function private.invitation_lifetime() is 'How long an invitation link works. The table allows 14 days at most.';

-- Server code has no auth.uid(), so these check a named person with the same rules as has_role.
create function private.person_has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = _user_id
      and r.role = _role
      and p.status <> 'suspended'
      and (_role = 'patient' or private.is_active_staff(r.user_id))
  );
$$;

-- Who may send which kind: PAs and admins send patient and guardian invitations, admins alone send team ones.
create function private.may_invite(_inviter uuid, _kind public.invitation_kind)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when _kind = 'team' then private.person_has_role(_inviter, 'admin')
    else private.person_has_role(_inviter, 'admin') or private.person_has_role(_inviter, 'pa')
  end;
$$;

create sequence private.patient_ref_seq start 100000;

-- Patients for the invitation screen: a name and a reference, nothing clinical. Admins have no
-- clinical access, so this is how they pick the person an invitation is for.
create function private.get_invitable_patients()
returns table (id uuid, first_name text, last_name text, clinic_ref text, has_account boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.first_name, p.last_name, p.clinic_ref, p.user_id is not null
  from public.patient_profiles p
  where p.archived_at is null
    and (
      (select private.has_role('admin'))
      or ((select private.has_role('pa')) and private.in_scope(p.id))
    )
  order by p.last_name, p.first_name;
$$;
comment on function private.get_invitable_patients() is 'Patient names and references for PAs and admins, so an invitation can name a patient. No clinical data.';

-- Create ------------------------------------------------------------------------------

create function private.create_invitation(
  _inviter uuid,
  _kind public.invitation_kind,
  _email text,
  _full_name text,
  _role public.app_role,
  _patient_id uuid,
  _relationship public.guardian_relationship,
  _can_act boolean,
  _job_title text,
  _token_hash text,
  _new_patient jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff uuid;
  address text := lower(btrim(_email));
  existing uuid;
  patient uuid := _patient_id;
  invitation uuid;
begin
  -- The audit log names the person who sends the invitation.
  perform set_config('app.actor_id', _inviter::text, true);

  if not private.may_invite(_inviter, _kind) then
    raise exception 'You cannot send this kind of invitation.' using errcode = '42501';
  end if;
  select s.id into staff from public.staff_profiles s where s.user_id = _inviter;
  if staff is null then
    raise exception 'You cannot send this kind of invitation.' using errcode = '42501';
  end if;
  if address !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(address) > 254 then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users u where u.id = _inviter and lower(u.email) = address) then
    raise exception 'You cannot invite yourself.' using errcode = '22023';
  end if;

  -- An old invitation that has run out no longer blocks a new one.
  update public.invitations
  set revoked_at = now()
  where lower(email) = address and accepted_at is null and revoked_at is null and expires_at <= now();

  select u.id into existing from auth.users u where lower(u.email) = address;

  if _kind = 'team' then
    if _role is null or _role = 'patient' then
      raise exception 'Choose a team role.' using errcode = '22023';
    end if;
    if existing is not null and exists (select 1 from public.staff_profiles s where s.user_id = existing) then
      raise exception 'This person already has a staff profile. Their access is managed from the team screen.' using errcode = '23505';
    end if;
  else
    -- Patient and guardian invitations name a patient, or create the record from minimal details.
    if _new_patient is not null then
      insert into public.patient_profiles (clinic_ref, first_name, last_name, date_of_birth, contact_email)
      values (
        'SC-' || lpad(nextval('private.patient_ref_seq')::text, 6, '0'),
        btrim(_new_patient ->> 'first_name'),
        btrim(_new_patient ->> 'last_name'),
        (_new_patient ->> 'date_of_birth')::date,
        case when _kind = 'patient' then address else null end
      )
      returning id into patient;
    elsif patient is null then
      raise exception 'Choose a patient.' using errcode = '22023';
    end if;

    perform 1 from public.patient_profiles p where p.id = patient and p.archived_at is null for update;
    if not found then
      raise exception 'That patient record was not found.' using errcode = '22023';
    end if;

    if _kind = 'patient' then
      if exists (select 1 from public.patient_profiles p where p.id = patient and p.user_id is not null) then
        raise exception 'That patient already has an account.' using errcode = '23505';
      end if;
      -- Two live links for one record could both be accepted, and the second would fail late.
      if exists (
        select 1 from public.invitations i
        where i.patient_id = patient and i.kind = 'patient' and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
      ) then
        raise exception 'There is already a pending invitation for this patient. Cancel it, or resend it.' using errcode = '23505';
      end if;
      if existing is not null and exists (select 1 from public.patient_profiles p where p.user_id = existing) then
        raise exception 'That email address already belongs to another patient record.' using errcode = '23505';
      end if;
    else
      if _relationship is null or _can_act is null then
        raise exception 'Say how the guardian is related and whether they can act.' using errcode = '22023';
      end if;
      if existing is not null and exists (
        select 1 from public.patient_profiles p where p.id = patient and p.user_id = existing
      ) then
        raise exception 'A patient cannot be their own guardian.' using errcode = '22023';
      end if;
      if existing is not null and exists (
        select 1 from public.patient_guardians g where g.patient_id = patient and g.guardian_user_id = existing
      ) then
        raise exception 'That person is already a guardian of this patient.' using errcode = '23505';
      end if;
    end if;
  end if;

  begin
    insert into public.invitations (
      email, kind, role, patient_id, relationship, can_act, job_title, full_name,
      invited_by, token_hash, expires_at
    )
    values (
      address,
      _kind,
      case when _kind = 'patient' then 'patient'::public.app_role when _kind = 'guardian' then null else _role end,
      patient,
      case when _kind = 'guardian' then _relationship else null end,
      case when _kind = 'guardian' then _can_act else null end,
      case when _kind = 'team' then nullif(btrim(_job_title), '') else null end,
      nullif(btrim(_full_name), ''),
      staff,
      _token_hash,
      now() + private.invitation_lifetime()
    )
    returning id into invitation;
  exception when unique_violation then
    raise exception 'There is already a pending invitation for this address. Cancel it, or resend it.' using errcode = '23505';
  end;

  return invitation;
end;
$$;

-- Resend: the old invitation is cancelled and a new one, with a new link, takes its place.
create function private.resend_invitation(_inviter uuid, _invitation uuid, _token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  old public.invitations;
  staff uuid;
  fresh uuid;
begin
  perform set_config('app.actor_id', _inviter::text, true);

  select * into old from public.invitations where id = _invitation for update;
  if not found then
    raise exception 'That invitation was not found.' using errcode = '22023';
  end if;
  if not private.may_invite(_inviter, old.kind) then
    raise exception 'You cannot send this kind of invitation.' using errcode = '42501';
  end if;
  if old.accepted_at is not null then
    raise exception 'That invitation has already been accepted.' using errcode = '23505';
  end if;
  select s.id into staff from public.staff_profiles s where s.user_id = _inviter;

  if old.kind = 'patient' and exists (
    select 1 from public.patient_profiles p where p.id = old.patient_id and p.user_id is not null
  ) then
    raise exception 'That patient already has an account.' using errcode = '23505';
  end if;

  update public.invitations set revoked_at = now() where id = old.id and revoked_at is null;
  -- Any other unused invitation to the same address is replaced too.
  update public.invitations set revoked_at = now()
  where lower(email) = lower(old.email) and accepted_at is null and revoked_at is null;

  insert into public.invitations (
    email, kind, role, patient_id, relationship, can_act, job_title, full_name, invited_by, token_hash, expires_at
  )
  values (
    old.email, old.kind, old.role, old.patient_id, old.relationship, old.can_act, old.job_title, old.full_name,
    staff, _token_hash, now() + private.invitation_lifetime()
  )
  returning id into fresh;
  return fresh;
end;
$$;

create function private.revoke_invitation(_inviter uuid, _invitation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_kind public.invitation_kind;
  used timestamptz;
begin
  perform set_config('app.actor_id', _inviter::text, true);
  select i.kind, i.accepted_at into found_kind, used from public.invitations i where i.id = _invitation for update;
  if found_kind is null then
    raise exception 'That invitation was not found.' using errcode = '22023';
  end if;
  if not private.may_invite(_inviter, found_kind) then
    raise exception 'You cannot cancel this kind of invitation.' using errcode = '42501';
  end if;
  if used is not null then
    raise exception 'That invitation has already been accepted.' using errcode = '23505';
  end if;
  update public.invitations set revoked_at = now() where id = _invitation and revoked_at is null;
end;
$$;

-- Look up (read only) ------------------------------------------------------------------
-- The accept page calls this with the link's hash. It changes nothing, so a mail scanner that
-- opens the link cannot use it up. It says nothing about who or what an unknown link was for.

create function private.get_invitation(_token_hash text)
returns table (
  status text,
  kind public.invitation_kind,
  role public.app_role,
  email text,
  full_name text,
  job_title text,
  inviter_name text,
  account_exists boolean,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  inv public.invitations;
  inviter_user uuid;
begin
  select * into inv from public.invitations i where i.token_hash = _token_hash;
  if not found then
    return query select 'not_found'::text, null::public.invitation_kind, null::public.app_role, null::text,
      null::text, null::text, null::text, null::boolean, null::timestamptz;
    return;
  end if;
  select s.user_id into inviter_user from public.staff_profiles s where s.id = inv.invited_by;

  return query
  select
    case
      when inv.accepted_at is not null then 'used'
      when inv.revoked_at is not null then 'cancelled'
      when inv.expires_at <= now() then 'expired'
      when inviter_user is null or not private.may_invite(inviter_user, inv.kind) then 'cancelled'
      -- Checked here too, so an account is never made for a link that acceptance would refuse.
      when inv.kind in ('patient', 'guardian') and not exists (
        select 1 from public.patient_profiles p where p.id = inv.patient_id and p.archived_at is null
      ) then 'cancelled'
      when inv.kind = 'patient' and exists (
        select 1 from public.patient_profiles p where p.id = inv.patient_id and p.user_id is not null
      ) then 'cancelled'
      else 'valid'
    end,
    inv.kind,
    inv.role,
    inv.email,
    inv.full_name,
    inv.job_title,
    (select p.full_name from public.profiles p where p.id = inviter_user),
    exists (select 1 from auth.users u where lower(u.email) = lower(inv.email)),
    inv.expires_at;
end;
$$;

-- Accept ------------------------------------------------------------------------------
-- The person is already signed in or created (server code checked the password or made the
-- account). Everything else is checked here, in one transaction: expiry, that the inviter may
-- still invite, that the account's email is the one invited, that the patient has no account.

create function private.accept_invitation(_token_hash text, _user_id uuid, _full_name text default null)
returns public.invitation_kind
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invitations;
  inviter_user uuid;
  account_email text;
  account_status public.account_status;
  patient_name text;
  display_name text;
begin
  select * into inv from public.invitations i where i.token_hash = _token_hash for update;
  if not found then
    raise exception 'This invitation is not valid.' using errcode = '22023';
  end if;
  if inv.accepted_at is not null then
    raise exception 'This invitation has already been used.' using errcode = '22023';
  end if;
  if inv.revoked_at is not null then
    raise exception 'This invitation has been cancelled.' using errcode = '22023';
  end if;
  if inv.expires_at <= now() then
    raise exception 'This invitation has expired.' using errcode = '22023';
  end if;

  select s.user_id into inviter_user from public.staff_profiles s where s.id = inv.invited_by;
  if inviter_user is null or not private.may_invite(inviter_user, inv.kind) then
    raise exception 'This invitation is no longer valid.' using errcode = '22023';
  end if;
  -- The audit log names the person who granted the access.
  perform set_config('app.actor_id', inviter_user::text, true);

  select u.email, p.status into account_email, account_status
  from auth.users u join public.profiles p on p.id = u.id
  where u.id = _user_id;
  if account_email is null or lower(account_email) <> lower(inv.email) then
    raise exception 'Sign in with the address the invitation was sent to.' using errcode = '22023';
  end if;
  if account_status = 'suspended' then
    raise exception 'This account cannot accept invitations.' using errcode = '42501';
  end if;

  if inv.kind = 'team' then
    if exists (select 1 from public.staff_profiles s where s.user_id = _user_id) then
      raise exception 'This account already has a staff profile.' using errcode = '23505';
    end if;
    insert into public.staff_profiles (user_id, job_title, clinical_role, active)
    values (_user_id, inv.job_title, inv.role::text::public.staff_role, true);
    insert into public.user_roles (user_id, role, granted_by) values (_user_id, inv.role, inviter_user);

  elsif inv.kind = 'patient' then
    update public.patient_profiles
    set user_id = _user_id
    where id = inv.patient_id and user_id is null and archived_at is null
    returning first_name || ' ' || last_name into patient_name;
    if patient_name is null then
      raise exception 'This patient record already has an account.' using errcode = '23505';
    end if;
    insert into public.user_roles (user_id, role, granted_by) values (_user_id, 'patient', inviter_user)
    on conflict do nothing;

  else
    if not exists (select 1 from public.patient_profiles p where p.id = inv.patient_id and p.archived_at is null) then
      raise exception 'This invitation is no longer valid.' using errcode = '22023';
    end if;
    if exists (select 1 from public.patient_profiles p where p.id = inv.patient_id and p.user_id = _user_id) then
      raise exception 'A patient cannot be their own guardian.' using errcode = '22023';
    end if;
    insert into public.patient_guardians (patient_id, guardian_user_id, relationship, can_view, can_act, verified_by)
    values (inv.patient_id, _user_id, inv.relationship, true, inv.can_act, inv.invited_by);
  end if;

  display_name := coalesce(nullif(btrim(_full_name), ''), inv.full_name, patient_name, '');
  update public.profiles
  set status = 'active',
      full_name = case when btrim(full_name) = '' then left(display_name, 120) else full_name end
  where id = _user_id;

  update public.invitations set accepted_at = now() where id = inv.id;

  insert into public.notifications (user_id, topic, title, link)
  values (inviter_user, 'messages', coalesce(nullif(display_name, ''), inv.email) || ' accepted your invitation', '/clinic/team');

  return inv.kind;
end;
$$;

-- Access ------------------------------------------------------------------------------
-- Public wrappers are the only way in. They run as the caller, so the service role must hold
-- execute on the private function too. Nobody else can call them.

-- Required arguments first, the rest optional, so server code names only what applies.
create function public.create_invitation(
  _inviter uuid, _kind public.invitation_kind, _email text, _token_hash text,
  _full_name text default null, _role public.app_role default null, _patient_id uuid default null,
  _relationship public.guardian_relationship default null, _can_act boolean default null,
  _job_title text default null, _new_patient jsonb default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_invitation(_inviter, _kind, _email, _full_name, _role, _patient_id, _relationship, _can_act, _job_title, _token_hash, _new_patient);
$$;

create function public.resend_invitation(_inviter uuid, _invitation uuid, _token_hash text)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.resend_invitation(_inviter, _invitation, _token_hash); $$;

create function public.revoke_invitation(_inviter uuid, _invitation uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.revoke_invitation(_inviter, _invitation); $$;

create function public.get_invitation(_token_hash text)
returns table (
  status text, kind public.invitation_kind, role public.app_role, email text, full_name text,
  job_title text, inviter_name text, account_exists boolean, expires_at timestamptz
)
language sql
security invoker
stable
set search_path = ''
as $$ select * from private.get_invitation(_token_hash); $$;

create function public.accept_invitation(_token_hash text, _user_id uuid, _full_name text default null)
returns public.invitation_kind
language sql
security invoker
set search_path = ''
as $$ select private.accept_invitation(_token_hash, _user_id, _full_name); $$;

create function public.get_invitable_patients()
returns table (id uuid, first_name text, last_name text, clinic_ref text, has_account boolean)
language sql
security invoker
stable
set search_path = ''
as $$ select * from private.get_invitable_patients(); $$;

revoke all on function
  private.create_invitation(uuid, public.invitation_kind, text, text, public.app_role, uuid, public.guardian_relationship, boolean, text, text, jsonb),
  private.resend_invitation(uuid, uuid, text),
  private.revoke_invitation(uuid, uuid),
  private.get_invitation(text),
  private.accept_invitation(text, uuid, text),
  private.get_invitable_patients(),
  private.person_has_role(uuid, public.app_role),
  private.may_invite(uuid, public.invitation_kind),
  private.invitation_lifetime()
from public, anon, authenticated;
revoke all on function
  public.create_invitation(uuid, public.invitation_kind, text, text, text, public.app_role, uuid, public.guardian_relationship, boolean, text, jsonb),
  public.resend_invitation(uuid, uuid, text),
  public.revoke_invitation(uuid, uuid),
  public.get_invitation(text),
  public.accept_invitation(text, uuid, text),
  public.get_invitable_patients()
from public, anon, authenticated;

-- Server code only.
grant execute on function
  private.create_invitation(uuid, public.invitation_kind, text, text, public.app_role, uuid, public.guardian_relationship, boolean, text, text, jsonb),
  private.resend_invitation(uuid, uuid, text),
  private.revoke_invitation(uuid, uuid),
  private.get_invitation(text),
  private.accept_invitation(text, uuid, text),
  private.person_has_role(uuid, public.app_role),
  private.may_invite(uuid, public.invitation_kind),
  private.invitation_lifetime(),
  public.create_invitation(uuid, public.invitation_kind, text, text, text, public.app_role, uuid, public.guardian_relationship, boolean, text, jsonb),
  public.resend_invitation(uuid, uuid, text),
  public.revoke_invitation(uuid, uuid),
  public.get_invitation(text),
  public.accept_invitation(text, uuid, text)
to service_role;

-- PAs and admins, signed in: the patient list for the invitation form.
grant execute on function private.get_invitable_patients(), public.get_invitable_patients() to authenticated;
