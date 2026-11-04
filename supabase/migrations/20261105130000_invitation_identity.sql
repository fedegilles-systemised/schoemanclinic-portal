-- Invitations, part two: proof that the right person accepts, and notices.
-- A patient or guardian invitation now needs the patient's date of birth at acceptance, and the
-- link is cancelled after five wrong dates. Sending to an address that differs from the one in the
-- patient's record needs the sender to confirm. Inviting a doctor or an admin tells the other
-- admins, and inviting a guardian who can act tells the other PAs. Closes S-74, and eases S-75.

alter table public.invitations add column failed_attempts smallint not null default 0;
comment on column public.invitations.failed_attempts is 'Wrong dates of birth entered for this link. The fifth cancels it.';

-- The create and accept functions gain an argument, so they are replaced.
drop function public.create_invitation(uuid, public.invitation_kind, text, text, text, public.app_role, uuid, public.guardian_relationship, boolean, text, jsonb);
drop function private.create_invitation(uuid, public.invitation_kind, text, text, public.app_role, uuid, public.guardian_relationship, boolean, text, text, jsonb);
drop function public.accept_invitation(text, uuid, text);
drop function private.accept_invitation(text, uuid, text);

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
  _new_patient jsonb default null,
  _confirm_mismatch boolean default false
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
      -- The address should be the one the clinic holds. A different one needs the sender to confirm.
      if _new_patient is null and not coalesce(_confirm_mismatch, false) and exists (
        select 1 from public.patient_profiles p
        where p.id = patient and p.contact_email is not null and lower(p.contact_email) <> address
      ) then
        raise exception 'This address is different from the one in the clinic''s record for this patient.'
          using errcode = '22023', hint = 'email_mismatch';
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

  -- Notices, so nobody is added to the clinic quietly. Neither blocks the invitation.
  if _kind = 'team' and _role in ('doctor', 'admin') then
    insert into public.notifications (user_id, topic, title, body, link)
    select r.user_id, 'messages',
      'A ' || case when _role = 'doctor' then 'doctor' else 'admin' end || ' invitation was sent',
      coalesce((select p.full_name from public.profiles p where p.id = _inviter), 'A colleague') || ' invited ' || address || '.',
      '/clinic/team'
    from public.user_roles r
    where r.role = 'admin' and r.user_id <> _inviter and private.person_has_role(r.user_id, 'admin');
  elsif _kind = 'guardian' and _can_act then
    insert into public.notifications (user_id, topic, title, body, link)
    select r.user_id, 'messages',
      'A guardian who can act for a patient was invited',
      'Invited by ' || coalesce((select p.full_name from public.profiles p where p.id = _inviter), 'a colleague') || '.',
      '/clinic/team'
    from public.user_roles r
    where r.role = 'pa' and r.user_id <> _inviter and private.person_has_role(r.user_id, 'pa');
  end if;

  return invitation;
end;
$$;

create function private.accept_invitation(_token_hash text, _user_id uuid, _full_name text default null, _date_of_birth date default null)
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

  -- Patient and guardian invitations need the patient's date of birth, as the clinic holds it.
  if inv.kind in ('patient', 'guardian') and (
    _date_of_birth is null
    or not exists (select 1 from public.patient_profiles p where p.id = inv.patient_id and p.date_of_birth = _date_of_birth)
  ) then
    raise exception 'The date of birth does not match.' using errcode = '22023';
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

-- Checks the date of birth before an account is made, and counts wrong tries. It returns a
-- word instead of raising, so the count is kept. Team invitations need no date.
create function private.verify_invitation_identity(_token_hash text, _date_of_birth date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invitations;
  inviter_user uuid;
  attempts smallint;
begin
  perform set_config('app.system_actor', 'invitation-identity-check', true);
  select * into inv from public.invitations i where i.token_hash = _token_hash for update;
  if not found or inv.accepted_at is not null or inv.revoked_at is not null or inv.expires_at <= now() then
    return 'invalid';
  end if;
  if inv.kind = 'team' then
    return 'ok';
  end if;
  if _date_of_birth is not null and exists (
    select 1 from public.patient_profiles p where p.id = inv.patient_id and p.date_of_birth = _date_of_birth
  ) then
    return 'ok';
  end if;

  attempts := inv.failed_attempts + 1;
  if attempts >= 5 then
    update public.invitations set failed_attempts = attempts, revoked_at = now() where id = inv.id;
    select s.user_id into inviter_user from public.staff_profiles s where s.id = inv.invited_by;
    if inviter_user is not null then
      insert into public.notifications (user_id, topic, title, body, link)
      values (inviter_user, 'messages', 'An invitation was cancelled',
        'Five wrong dates of birth were entered for ' || inv.email || '. Send it again if it reached the right person.', '/clinic/team');
    end if;
    return 'locked';
  end if;
  update public.invitations set failed_attempts = attempts where id = inv.id;
  return 'wrong';
end;
$$;

create function public.create_invitation(
  _inviter uuid, _kind public.invitation_kind, _email text, _token_hash text,
  _full_name text default null, _role public.app_role default null, _patient_id uuid default null,
  _relationship public.guardian_relationship default null, _can_act boolean default null,
  _job_title text default null, _new_patient jsonb default null, _confirm_email_mismatch boolean default false
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_invitation(_inviter, _kind, _email, _full_name, _role, _patient_id, _relationship, _can_act, _job_title, _token_hash, _new_patient, _confirm_email_mismatch);
$$;

create function public.accept_invitation(_token_hash text, _user_id uuid, _full_name text default null, _date_of_birth date default null)
returns public.invitation_kind
language sql
security invoker
set search_path = ''
as $$ select private.accept_invitation(_token_hash, _user_id, _full_name, _date_of_birth); $$;

create function public.verify_invitation_identity(_token_hash text, _date_of_birth date default null)
returns text
language sql
security invoker
set search_path = ''
as $$ select private.verify_invitation_identity(_token_hash, _date_of_birth); $$;

revoke all on function private.create_invitation(uuid, public.invitation_kind, text, text, public.app_role, uuid, public.guardian_relationship, boolean, text, text, jsonb, boolean), public.create_invitation(uuid, public.invitation_kind, text, text, text, public.app_role, uuid, public.guardian_relationship, boolean, text, jsonb, boolean), private.accept_invitation(text, uuid, text, date), public.accept_invitation(text, uuid, text, date), private.verify_invitation_identity(text, date), public.verify_invitation_identity(text, date) from public, anon, authenticated;
-- Server code only.
grant execute on function private.create_invitation(uuid, public.invitation_kind, text, text, public.app_role, uuid, public.guardian_relationship, boolean, text, text, jsonb, boolean), public.create_invitation(uuid, public.invitation_kind, text, text, text, public.app_role, uuid, public.guardian_relationship, boolean, text, jsonb, boolean), private.accept_invitation(text, uuid, text, date), public.accept_invitation(text, uuid, text, date), private.verify_invitation_identity(text, date), public.verify_invitation_identity(text, date) to service_role;
