-- Finalising the open points from the reviews of 11 to 13 November 2026 (docs/SECURITY.md, docs/CONTEXT.md).
-- Each change names the finding it closes.

-- C88: a removed guardian can be invited again; accepting turns their old link back on.
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
        select 1 from public.patient_guardians g where g.patient_id = patient and g.guardian_user_id = existing and (g.can_view or g.can_act)
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

create or replace function private.accept_invitation(_token_hash text, _user_id uuid, _full_name text DEFAULT NULL::text, _date_of_birth date DEFAULT NULL::date)
 RETURNS invitation_kind
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    -- A guardian removed earlier keeps their switched-off row; accepting a new invitation turns it back on.
    insert into public.patient_guardians (patient_id, guardian_user_id, relationship, can_view, can_act, verified_by)
    values (inv.patient_id, _user_id, inv.relationship, true, inv.can_act, inv.invited_by)
    on conflict (patient_id, guardian_user_id) do update
      set relationship = excluded.relationship, can_view = true, can_act = excluded.can_act, verified_by = excluded.verified_by;
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
$function$;

-- C87: an import of a file not yet matched to a patient is for PAs and admins only, like the file itself.
create or replace function private.register_import(_document_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  doc public.documents;
  import_id uuid;
begin
  select * into doc from public.documents d where d.id = _document_id and d.archived_at is null;
  if not found then
    raise exception 'That file was not found.' using errcode = '22023';
  end if;

  if not (
    (doc.uploaded_by = (select auth.uid()) and doc.kind = 'patient_upload' and private.can_act_for(doc.patient_id))
    or (
      (doc.patient_id is not null and (select private.has_role('pa') or private.has_role('doctor') or private.has_role('nurse')) and private.in_scope(doc.patient_id))
      or (doc.patient_id is null and (select private.has_role('pa') or private.has_role('admin')))
    )
  ) then
    raise exception 'You cannot send this file in for entry.' using errcode = '42501';
  end if;

  if exists (select 1 from public.result_imports i where i.document_id = _document_id) then
    raise exception 'This file is already waiting for entry.' using errcode = '23505';
  end if;

  insert into public.result_imports (document_id, patient_id, status)
  values (_document_id, doc.patient_id, case when doc.patient_id is null then 'needs_match'::public.import_status else 'matched'::public.import_status end)
  returning id into import_id;
  return import_id;
end;
$function$;

-- S-127, C93: a booking's location must suit the appointment type; the clinician row lock no longer
-- blocks unrelated updates to staff profiles.
create or replace function private.book_appointment(_patient uuid, _staff uuid, _type uuid, _starts_at timestamp with time zone, _location uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := (select auth.uid());
  kind public.appointment_types;
  local_start timestamp := _starts_at at time zone 'Europe/London';
  local_end timestamp;
  as_patient boolean;
  appt uuid;
begin
  select * into kind from public.appointment_types where id = _type and active;
  if not found then
    raise exception 'That appointment type is not available.' using errcode = '22023';
  end if;
  as_patient := private.can_act_for(_patient);
  if not as_patient and not private.in_scope(_patient) then
    raise exception 'You cannot book for this patient.' using errcode = '42501';
  end if;
  if as_patient and not private.in_scope(_patient) then
    if not kind.bookable_by_patients then
      raise exception 'Please contact the clinic to book this appointment.' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.care_team ct
      where ct.patient_id = _patient and ct.staff_id = _staff
        and ct.since <= private.london_today() and (ct.until is null or ct.until > private.london_today())
    ) then
      raise exception 'You can book with the clinicians who look after you.' using errcode = '42501';
    end if;
    -- A patient holds a few open bookings at most; the team books beyond that.
    if (select count(*) from public.appointments a where a.patient_id = _patient and a.status in ('booked', 'confirmed') and a.starts_at > now()) >= 3 then
      raise exception 'You already have three appointments booked. Please contact the clinic to book more.' using errcode = '22023';
    end if;
  end if;
  if not exists (select 1 from public.staff_profiles s where s.id = _staff and s.active and s.archived_at is null and s.clinical_role in ('doctor', 'nurse', 'health_coach')) then
    raise exception 'That clinician cannot be booked.' using errcode = '22023';
  end if;
  if _starts_at <= now() + interval '1 hour' or _starts_at > now() + interval '120 days' then
    raise exception 'Choose a time between an hour and four months from now.' using errcode = '22023';
  end if;
  local_end := local_start + make_interval(mins => kind.duration_min);
  if local_end::date <> local_start::date or not exists (
    select 1 from public.clinician_availability h
    where h.staff_id = _staff and h.active
      and h.weekday = extract(isodow from local_start)
      and h.start_time <= local_start::time and h.end_time >= local_end::time
      and (_location is null or h.location_id is null or h.location_id = _location)
  ) then
    raise exception 'That time is outside the clinician''s hours.' using errcode = '22023';
  end if;
  -- The place must suit the type: a video appointment has the video location or none, a clinic one a clinic.
  if _location is not null and not exists (
    select 1 from public.locations l where l.id = _location and l.kind = kind.location_kind
  ) then
    raise exception 'That location does not suit this appointment.' using errcode = '22023';
  end if;
  -- One booking at a time per clinician: lock their row, then check for an overlap.
  perform 1 from public.staff_profiles where id = _staff for no key update;
  if exists (
    select 1 from public.appointments a
    where a.clinician_id = _staff and a.status in ('booked', 'confirmed')
      and a.starts_at < _starts_at + make_interval(mins => kind.duration_min)
      and a.starts_at + make_interval(mins => a.duration_min) > _starts_at
  ) then
    raise exception 'That time has just been taken. Please choose another.' using errcode = '23505';
  end if;
  insert into public.appointments (patient_id, clinician_id, location_id, starts_at, duration_min, type, status, source, appointment_type_id, booked_by)
  values (_patient, _staff, _location, _starts_at, kind.duration_min, kind.name, 'booked', 'clinic_hub', _type, me)
  returning id into appt;
  return appt;
end;
$function$;

-- S-125: removing a guardian cannot also rewrite who verified the link.
create function private.guard_guardian_verifier()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and new.verified_by is distinct from old.verified_by
     and new.verified_by is distinct from private.my_staff_id() then
    raise exception 'A link records who verified it; nobody else can be named.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger patient_guardians_guard_verifier before update on public.patient_guardians
  for each row execute function private.guard_guardian_verifier();

-- C77: a care-team role must match the person's own role (a PA cannot be someone's primary doctor).
create function private.care_team_role_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff_role public.staff_role;
begin
  select s.clinical_role into staff_role from public.staff_profiles s where s.id = new.staff_id;
  if staff_role is null or (case new.relationship
       when 'primary_doctor' then staff_role <> 'doctor'
       when 'doctor' then staff_role <> 'doctor'
       when 'nurse' then staff_role <> 'nurse'
       when 'pa' then staff_role <> 'pa'
       when 'health_coach' then staff_role <> 'health_coach'
     end) then
    raise exception 'That role on the care team does not match the person''s own role.' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.care_team_role_matches() from public, anon, authenticated;
create trigger care_team_role_matches before insert or update of staff_id, relationship on public.care_team
  for each row execute function private.care_team_role_matches();

-- S-107, C64: a team member who leaves loses their Google connection at once, so nothing that can
-- call Google is kept for them. Deleting the token does not withdraw the grant at Google: the person
-- or the clinic's Google admin removes Clinic Hub at myaccount.google.com/permissions when they leave.
create function private.drop_leaver_connections()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (not new.active or new.archived_at is not null) and (old.active and old.archived_at is null) then
    perform set_config('app.system_actor', 'offboarding', true);
    delete from public.google_calendar_connections where user_id = new.user_id;
  end if;
  return new;
end;
$$;
revoke all on function private.drop_leaver_connections() from public, anon, authenticated;
create trigger staff_profiles_drop_leaver_connections after update of active, archived_at on public.staff_profiles
  for each row execute function private.drop_leaver_connections();

-- S-126, C97: a call recording file can be written only for a recording row the uploader opened,
-- at exactly that row's path, while it waits for its upload.
alter policy "Clinicians upload call recordings for their patients" on storage.objects
  with check (
    bucket_id = 'recordings'
    and exists (
      select 1 from public.call_recordings r
      where r.storage_path = name
        and r.recorded_by = (select private.my_staff_id())
        and r.status = 'uploading'
        and private.in_scope(r.patient_id)
    )
  );

-- C79: patients see only live assignments of published courses.
alter policy "Staff in scope and the patient read assignments" on public.education_assignments
  using (
    private.in_scope(patient_id)
    or (
      archived_at is null
      and patient_id in (select private.my_patient_ids())
      and exists (select 1 from public.education_courses c where c.id = course_id and c.published and c.archived_at is null)
    )
  );

-- S-116, C81: wearable readings are checked by the database too: no future dates, sensible ranges.
create function private.check_wearable_reading()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  lo numeric;
  hi numeric;
begin
  if new.measured_on > private.london_today() then
    raise exception 'A reading cannot be dated in the future.' using errcode = '22023';
  end if;
  select r.lo, r.hi into lo, hi from (values
    ('sleep_minutes', 0, 1440), ('sleep_score', 0, 100), ('readiness_score', 0, 100), ('resting_heart_rate', 20, 200),
    ('hrv_ms', 0, 400), ('steps', 0, 200000), ('active_minutes', 0, 1440), ('weight_kg', 2, 400),
    ('body_fat_percent', 1, 80), ('vo2_max', 5, 100), ('spo2_percent', 50, 100), ('temperature_deviation_c', -5, 5)
  ) as r (metric, lo, hi) where r.metric = new.metric::text;
  if new.value < lo or new.value > hi then
    raise exception 'That value is outside the range for this reading.' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger wearable_readings_check before insert on public.wearable_readings
  for each row execute function private.check_wearable_reading();
