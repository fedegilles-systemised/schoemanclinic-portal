-- Decisions of 27 November 2026 (Dr Schoeman, for the clinic).
--
-- 1. Doctors, nurses, health coaches, PAs and admins see and write in every patient's record. The care
--    team no longer limits who can open a record; it still says who looks after a patient and where
--    results and alerts are sent. What each role may do is unchanged (a nurse does not prescribe or
--    record diagnoses, a health coach does not release results, and so on).
-- 2. The whole team sees every clinician's diary.
-- 3. Safeguarding alerts are read by doctors, nurses, health coaches, PAs and admins. Only doctors add
--    or change them.
--
-- Nobody opens their own record, or that of someone they look after, as staff (question 4): that stays.
-- A suspended or inactive account holds no role, so it sees nothing.

create or replace function private.in_scope(_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _patient_id is not null
  and _patient_id not in (select private.my_patient_ids())
  and (
    private.has_role('admin')
    or private.has_role('pa')
    or private.has_role('doctor')
    or private.has_role('nurse')
    or private.has_role('health_coach')
  );
$$;
comment on function private.in_scope(uuid) is 'Can this staff member open this patient''s record? Every doctor, nurse, health coach, PA and admin: every patient, except their own record and that of anyone they look after. Decided by the clinic, 27 November 2026 (it was the care team for doctors, nurses and health coaches from 11 November).';

-- Safeguarding alerts: read by the whole team, added and changed by doctors only. -----------------

alter policy "Doctors read safeguarding alerts" on public.safeguarding_alerts
  rename to "Clinical staff, PAs and admins read safeguarding alerts";
alter policy "Clinical staff, PAs and admins read safeguarding alerts" on public.safeguarding_alerts
  using (
    (
      (select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('health_coach'))
      or (select private.has_role('pa')) or (select private.has_role('admin'))
    )
    and private.in_scope(patient_id)
  );

-- The care team ------------------------------------------------------------------------------------
-- The care team still decides a few things on purpose: who may send a prescription through SignatureRx,
-- which patients a doctor invites, who gets a patient's red feedback alert and which clinicians a
-- patient books. If every doctor could add themselves to any care team, those rules would mean
-- nothing. So a doctor changes a care team only when they are already on it; PAs and admins change any.

create function private.on_care_team(_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.care_team ct
    where ct.patient_id = _patient
      and ct.staff_id = private.my_staff_id()
      and ct.since <= private.london_today()
      and (ct.until is null or ct.until > private.london_today())
  );
$$;
comment on function private.on_care_team(uuid) is 'Is the signed-in staff member currently on this patient''s care team?';
revoke all on function private.on_care_team(uuid) from public, anon;
grant execute on function private.on_care_team(uuid) to authenticated, service_role;

alter policy "PAs and doctors add to the care team" on public.care_team
  with check (
    private.in_scope(patient_id)
    and (
      (select private.has_role('pa')) or (select private.has_role('admin'))
      or ((select private.has_role('doctor')) and private.on_care_team(patient_id))
    )
  );
alter policy "PAs and doctors change the care team" on public.care_team
  using (
    private.in_scope(patient_id)
    and (
      (select private.has_role('pa')) or (select private.has_role('admin'))
      or ((select private.has_role('doctor')) and private.on_care_team(patient_id))
    )
  )
  with check (
    private.in_scope(patient_id)
    and (
      (select private.has_role('pa')) or (select private.has_role('admin'))
      or ((select private.has_role('doctor')) and private.on_care_team(patient_id))
    )
  );

-- Moving a booking -------------------------------------------------------------------------------------

create or replace function private.move_appointment(_appointment uuid, _staff uuid, _starts_at timestamptz, _location uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.appointments;
  kind public.appointment_types;
  local_start timestamp := _starts_at at time zone 'Europe/London';
  local_end timestamp;
  chosen_location uuid;
begin
  select * into a from public.appointments x where x.id = _appointment for update;
  if not found or not private.in_scope(a.patient_id)
    or exists (select 1 from public.patient_profiles p where p.id = a.patient_id and p.archived_at is not null)
    or not (
    private.has_role('admin') or private.has_role('pa') or private.has_role('doctor')
    or private.has_role('nurse') or private.has_role('health_coach')
  ) then
    raise exception 'You cannot move this appointment.' using errcode = '42501';
  end if;
  if a.status not in ('booked', 'confirmed') then
    raise exception 'This appointment is not open.' using errcode = '22023';
  end if;
  if a.source <> 'clinic_hub' then
    raise exception 'This appointment was booked in another system. Move it there.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.staff_profiles s join public.profiles u on u.id = s.user_id
    where s.id = _staff and s.active and s.archived_at is null and u.status = 'active' and s.clinical_role in ('doctor', 'nurse', 'health_coach')
  ) then
    raise exception 'That clinician cannot be booked.' using errcode = '22023';
  end if;
  if _starts_at <= now() or _starts_at > now() + interval '366 days' then
    raise exception 'Choose a time in the coming year.' using errcode = '22023';
  end if;
  if a.appointment_type_id is not null then
    select * into kind from public.appointment_types t where t.id = a.appointment_type_id;
    if _location is not null and not exists (select 1 from public.locations l where l.id = _location and l.kind = kind.location_kind) then
      raise exception 'That location does not suit this appointment.' using errcode = '22023';
    end if;
  end if;
  local_end := local_start + make_interval(mins => a.duration_min);
  -- The place comes from the new clinician's hours at that time, unless one is named.
  select coalesce(_location, h.location_id) into chosen_location
  from public.clinician_availability h
  where h.staff_id = _staff and h.active
    and h.weekday = extract(isodow from local_start)
    and h.start_time <= local_start::time and h.end_time >= local_end::time
    and (_location is null or h.location_id is null or h.location_id = _location)
  order by h.location_id nulls last
  limit 1;
  if local_end::date <> local_start::date or not found then
    raise exception 'That time is outside the clinician''s hours.' using errcode = '22023';
  end if;
  if chosen_location is not null and a.appointment_type_id is not null
    and not exists (select 1 from public.locations l where l.id = chosen_location and l.kind = kind.location_kind) then
    raise exception 'That location does not suit this appointment.' using errcode = '22023';
  end if;
  perform 1 from public.staff_profiles where id = _staff for no key update;
  if exists (
    select 1 from public.appointments x
    where x.clinician_id = _staff and x.id <> _appointment and x.status in ('booked', 'confirmed')
      and x.starts_at < _starts_at + make_interval(mins => a.duration_min)
      and x.starts_at + make_interval(mins => x.duration_min) > _starts_at
  ) then
    raise exception 'That time is already taken. Please choose another.' using errcode = '23505';
  end if;
  -- A confirmed booking stays confirmed.
  update public.appointments
  set clinician_id = _staff, starts_at = _starts_at, location_id = chosen_location
  where id = _appointment;

  -- The clinician the booking moves to joins the care team, if not already on it, so they can prepare.
  -- Only when a PA or admin moves it, or the person moving it is already on the care team: otherwise
  -- moving a booking to yourself would be a way onto any patient's care team (27 November 2026).
  insert into public.care_team (patient_id, staff_id, relationship, since)
  select a.patient_id, st.id, (case st.clinical_role when 'doctor' then 'doctor' when 'nurse' then 'nurse' else 'health_coach' end)::public.care_relationship, private.london_today()
  from public.staff_profiles st
  where st.id = _staff
    and (private.has_role('admin') or private.has_role('pa') or private.on_care_team(a.patient_id))
    and not exists (
    select 1 from public.care_team ct
    where ct.patient_id = a.patient_id and ct.staff_id = _staff
      and ct.since <= private.london_today() and (ct.until is null or ct.until > private.london_today())
  );
end;
$$;

-- The invitation form -------------------------------------------------------------------------------
-- A doctor still invites only the patients on their own care team (decision 6), so the form lists those
-- only. Admins and PAs list every patient, as before.

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
      or ((select private.has_role('pa')) and private.in_scope(p.id))
      or (
        (select private.has_role('doctor')) and private.in_scope(p.id)
        and exists (
          select 1 from public.care_team ct
          where ct.patient_id = p.id
            and ct.staff_id = (select private.my_staff_id())
            and ct.since <= private.london_today()
            and (ct.until is null or ct.until > private.london_today())
        )
      )
    )
  order by p.last_name, p.first_name;
$$;

-- The diary ---------------------------------------------------------------------------------------

create or replace function private.clinic_diary(_from timestamptz, _to timestamptz)
returns table (
  id uuid,
  starts_at timestamptz,
  duration_min integer,
  type text,
  status public.appt_status,
  clinician_id uuid,
  location_id uuid,
  patient_id uuid,
  patient_name text,
  clinic_ref text,
  can_open boolean,
  booked_online boolean,
  new_patient boolean,
  source public.appt_source
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.my_staff_id() is null or not (
    private.has_role('doctor') or private.has_role('nurse') or private.has_role('pa')
    or private.has_role('health_coach') or private.has_role('admin')
  ) then
    raise exception 'Only the team reads the diary.' using errcode = '42501';
  end if;
  if _from is null or _to is null or _to <= _from or _to - _from > interval '43 days' then
    raise exception 'Choose up to six weeks at a time.' using errcode = '22023';
  end if;
  return query
    select a.id, a.starts_at, a.duration_min, a.type, a.status, a.clinician_id, a.location_id,
      a.patient_id, p.first_name || ' ' || p.last_name, p.clinic_ref,
      private.in_scope(a.patient_id), a.booked_online,
      p.booked_online_at is not null and p.user_id is null, a.source
    from public.appointments a
    join public.patient_profiles p on p.id = a.patient_id
    where a.starts_at < _to
      and a.starts_at + make_interval(mins => a.duration_min) > _from
      and a.status <> 'cancelled'
      -- Every member of the team sees every clinician's bookings (Dr Schoeman, 27 November 2026).
    order by a.starts_at, a.clinician_id;
end;
$$;

