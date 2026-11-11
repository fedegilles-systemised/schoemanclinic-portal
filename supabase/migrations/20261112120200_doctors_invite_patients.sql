-- Doctors invite their own patients (decided by the clinic on 11 November 2026, knowledge base question 6).
--
--   Admins invite anyone; PAs invite patients and guardians; doctors invite patients, but only
--   patients on their own care team, or a new patient, who joins their care team as primary doctor.
--   A doctor can resend or cancel only invitations for their own patients, and reads the patient
--   invitations they sent. The email alert to Dr Gina Schoeman when a doctor or admin is invited
--   is sent by the server (lib/invitations/actions.ts), after the invitation is saved.

-- A doctor who is neither a PA nor an admin: the narrower rules below apply to them.
create function private.is_doctor_only(_person uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.person_has_role(_person, 'doctor')
    and not private.person_has_role(_person, 'admin')
    and not private.person_has_role(_person, 'pa');
$$;
comment on function private.is_doctor_only(uuid) is 'Holds the doctor role but not PA or admin.';

-- Can this inviter send, resend or cancel an invitation about this patient?
create function private.inviter_covers_patient(_inviter uuid, _kind public.invitation_kind, _patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _kind <> 'patient'
    or not private.is_doctor_only(_inviter)
    or exists (
      select 1
      from public.care_team ct
      join public.staff_profiles s on s.id = ct.staff_id
      where ct.patient_id = _patient
        and s.user_id = _inviter
        and ct.since <= current_date
        and (ct.until is null or ct.until > current_date)
    );
$$;
comment on function private.inviter_covers_patient(uuid, public.invitation_kind, uuid) is 'A doctor-only inviter may act on a patient invitation only for a patient on their care team.';

create or replace function private.may_invite(_inviter uuid, _kind public.invitation_kind)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when _kind = 'team' then private.person_has_role(_inviter, 'admin')
    when _kind = 'guardian' then private.person_has_role(_inviter, 'admin') or private.person_has_role(_inviter, 'pa')
    else private.person_has_role(_inviter, 'admin') or private.person_has_role(_inviter, 'pa') or private.person_has_role(_inviter, 'doctor')
  end;
$$;
comment on function private.may_invite(uuid, public.invitation_kind) is 'Admins invite anyone, PAs patients and guardians, doctors patients (their own: see inviter_covers_patient).';

create or replace function private.create_invitation(_inviter uuid, _kind invitation_kind, _email text, _full_name text, _role app_role, _patient_id uuid, _relationship guardian_relationship, _can_act boolean, _job_title text, _token_hash text, _new_patient jsonb DEFAULT NULL::jsonb, _confirm_mismatch boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

    -- A doctor invites only their own patients. A new patient a doctor adds joins their care team
    -- as primary doctor, so the doctor can see the record they just made.
    if _new_patient is not null and private.is_doctor_only(_inviter) then
      insert into public.care_team (patient_id, staff_id, relationship) values (patient, staff, 'primary_doctor');
    elsif not private.inviter_covers_patient(_inviter, _kind, patient) then
      raise exception 'You can invite only your own patients.' using errcode = '42501';
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
$function$;

create or replace function private.resend_invitation(_inviter uuid, _invitation uuid, _token_hash text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if not private.may_invite(_inviter, old.kind) or not private.inviter_covers_patient(_inviter, old.kind, old.patient_id) then
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
$function$;

create or replace function private.revoke_invitation(_inviter uuid, _invitation uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  found_kind public.invitation_kind;
  found_patient uuid;
  used timestamptz;
begin
  perform set_config('app.actor_id', _inviter::text, true);
  select i.kind, i.accepted_at, i.patient_id into found_kind, used, found_patient from public.invitations i where i.id = _invitation for update;
  if found_kind is null then
    raise exception 'That invitation was not found.' using errcode = '22023';
  end if;
  if not private.may_invite(_inviter, found_kind) or not private.inviter_covers_patient(_inviter, found_kind, found_patient) then
    raise exception 'You cannot cancel this kind of invitation.' using errcode = '42501';
  end if;
  if used is not null then
    raise exception 'That invitation has already been accepted.' using errcode = '23505';
  end if;
  update public.invitations set revoked_at = now() where id = _invitation and revoked_at is null;
end;
$function$;

-- The patient list on the invitation form: a doctor gets their own care-team patients.
create or replace function private.get_invitable_patients()
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
      or (((select private.has_role('pa')) or (select private.has_role('doctor'))) and private.in_scope(p.id))
    )
  order by p.last_name, p.first_name;
$$;

-- A doctor reads the patient invitations they sent.
alter policy "PAs read patient and guardian invitations and admins read all" on public.invitations
  using (
    (select private.has_role('admin'))
    or ((select private.has_role('pa')) and kind <> 'team' and private.in_scope(patient_id))
    or ((select private.has_role('doctor')) and kind = 'patient' and invited_by = (select private.my_staff_id()))
  );

revoke all on function private.is_doctor_only(uuid), private.inviter_covers_patient(uuid, public.invitation_kind, uuid) from public, anon, authenticated;
grant execute on function private.is_doctor_only(uuid), private.inviter_covers_patient(uuid, public.invitation_kind, uuid) to service_role;
