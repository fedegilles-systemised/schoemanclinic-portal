-- Decisions of 12 November 2026 (George, for the clinic).
--
-- 1. The diary: admins and PAs see every clinician's bookings; a doctor, nurse or health coach sees
--    only their own. This replaces the interim "everyone sees everyone" default.
-- 2. Online booking makes no second record: someone already on the clinic's books, matched by email
--    (contact or sign-in) and date of birth, is booked on their own record, and nothing they type
--    changes it. A different date of birth on a shared email is a different person.
-- 3. Bookings already in GoHighLevel calendars stay there; nothing is imported.

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
      -- Admins and PAs see every clinician's bookings; a doctor, nurse or health coach sees their own.
      and (private.has_role('admin') or private.has_role('pa') or a.clinician_id = private.my_staff_id())
    order by a.starts_at, a.clinician_id;
end;
$$;

create or replace function private.book_online(
  _type uuid,
  _staff uuid,
  _starts_at timestamptz,
  _location uuid,
  _first_name text,
  _last_name text,
  _date_of_birth date,
  _email text,
  _phone text
)
returns table (appointment_id uuid, patient_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  kind public.appointment_types;
  local_start timestamp := _starts_at at time zone 'Europe/London';
  local_end timestamp;
  address text := lower(btrim(_email));
  new_patient uuid;
  existing boolean := false;
  matches integer;
  appt uuid;
begin
  perform set_config('app.system_actor', 'online-booking', true);
  select * into kind from public.appointment_types t where t.id = _type and t.active and t.bookable_online;
  if not found then
    raise exception 'That appointment cannot be booked online.' using errcode = '22023';
  end if;
  if nullif(btrim(_first_name), '') is null or nullif(btrim(_last_name), '') is null
    or char_length(btrim(_first_name)) > 80 or char_length(btrim(_last_name)) > 80 then
    raise exception 'Enter your first and last name.' using errcode = '22023';
  end if;
  if _date_of_birth is null or _date_of_birth > current_date or _date_of_birth < date '1900-01-01' then
    raise exception 'Enter your date of birth.' using errcode = '22023';
  end if;
  if _date_of_birth > (private.london_today() - interval '18 years')::date then
    raise exception 'Online booking is for adults. Please call the clinic to book for a child.' using errcode = '22023';
  end if;
  if address !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(address) > 254 then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  if _phone is null or btrim(_phone) !~ '^\+?[0-9 ()-]{7,20}$' then
    raise exception 'Enter a phone number.' using errcode = '22023';
  end if;
  -- One person, one record: someone already on the clinic's books (by their email, as contact or
  -- sign-in address, and date of birth) is booked on their own record. With more than one such
  -- record (twins sharing an email) the first name decides; if it still cannot, the clinic books.
  -- An email shared with a different date of birth is someone else, such as a family member, who
  -- gets their own record. Nothing typed changes an existing record.
  select count(*) into matches
  from public.patient_profiles p left join public.profiles u on u.id = p.user_id
  where p.archived_at is null and p.date_of_birth = _date_of_birth
    and (lower(p.contact_email) = address or lower(u.email) = address);
  if matches = 1 then
    select p.id into new_patient
    from public.patient_profiles p left join public.profiles u on u.id = p.user_id
    where p.archived_at is null and p.date_of_birth = _date_of_birth
      and (lower(p.contact_email) = address or lower(u.email) = address);
  elsif matches > 1 then
    select count(*) into matches
    from public.patient_profiles p left join public.profiles u on u.id = p.user_id
    where p.archived_at is null and p.date_of_birth = _date_of_birth
      and (lower(p.contact_email) = address or lower(u.email) = address)
      and lower(btrim(p.first_name)) = lower(btrim(_first_name));
    if matches <> 1 then
      raise exception 'We cannot take this booking online. Please contact the clinic.' using errcode = '22023';
    end if;
    select p.id into new_patient
    from public.patient_profiles p left join public.profiles u on u.id = p.user_id
    where p.archived_at is null and p.date_of_birth = _date_of_birth
      and (lower(p.contact_email) = address or lower(u.email) = address)
      and lower(btrim(p.first_name)) = lower(btrim(_first_name));
  end if;
  existing := new_patient is not null;

  -- Limits against misuse, with one message that says nothing about who has booked: two open online
  -- bookings per person (their record, email or phone), and at most 20 online bookings in any hour for the clinic.
  if (
    select count(*) from public.appointments a join public.patient_profiles p on p.id = a.patient_id
    where a.booked_online and a.status in ('booked', 'confirmed') and a.starts_at > now()
      and (a.patient_id = new_patient or lower(p.contact_email) = address
           or regexp_replace(p.contact_phone, '[^0-9]', '', 'g') = regexp_replace(_phone, '[^0-9]', '', 'g'))
  ) >= 2 or (
    select count(*) from public.appointments a where a.booked_online and a.created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'We cannot take this booking online. Please contact the clinic.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.staff_profiles s join public.profiles u on u.id = s.user_id
    where s.id = _staff and s.active and s.archived_at is null and u.status = 'active' and s.clinical_role in ('doctor', 'nurse', 'health_coach')
  ) then
    raise exception 'That clinician cannot be booked.' using errcode = '22023';
  end if;
  -- The booking page offers three weeks; the database allows a few days more and nothing beyond.
  if _starts_at <= now() + interval '24 hours' or _starts_at > now() + interval '25 days' then
    raise exception 'Choose a time at least a day ahead, within the next three weeks.' using errcode = '22023';
  end if;
  if _location is not null and not exists (select 1 from public.locations l where l.id = _location and l.kind = kind.location_kind) then
    raise exception 'That location does not suit this appointment.' using errcode = '22023';
  end if;
  local_end := local_start + make_interval(mins => kind.duration_min);
  if local_end::date <> local_start::date or not exists (
    select 1 from public.clinician_availability h
    where h.staff_id = _staff and h.active
      and h.weekday = extract(isodow from local_start)
      and h.start_time <= local_start::time and h.end_time >= local_end::time
      and (_location is null or h.location_id is null or h.location_id = _location)
  ) then
    raise exception 'That time is not available. Please choose another.' using errcode = '22023';
  end if;
  perform 1 from public.staff_profiles where id = _staff for no key update;
  if exists (
    select 1 from public.appointments a
    where a.clinician_id = _staff and a.status in ('booked', 'confirmed')
      and a.starts_at < _starts_at + make_interval(mins => kind.duration_min)
      and a.starts_at + make_interval(mins => a.duration_min) > _starts_at
  ) then
    raise exception 'That time has just been taken. Please choose another.' using errcode = '23505';
  end if;

  if not existing then
    insert into public.patient_profiles (clinic_ref, first_name, last_name, date_of_birth, contact_email, contact_phone, booked_online_at)
    values ('SC-' || lpad(nextval('private.patient_ref_seq')::text, 6, '0'), btrim(_first_name), btrim(_last_name), _date_of_birth, address, btrim(_phone), now())
    returning id into new_patient;
  end if;

  insert into public.appointments (patient_id, clinician_id, location_id, starts_at, duration_min, type, status, source, appointment_type_id, booked_online)
  values (new_patient, _staff, _location, _starts_at, kind.duration_min, kind.name, 'booked', 'clinic_hub', _type, true)
  returning id into appt;

  -- The clinician booked joins the patient's care team, if not already on it, so they can prepare.
  insert into public.care_team (patient_id, staff_id, relationship, since)
  select new_patient, s.id, (case s.clinical_role when 'doctor' then 'doctor' when 'nurse' then 'nurse' else 'health_coach' end)::public.care_relationship, private.london_today()
  from public.staff_profiles s
  where s.id = _staff and not exists (
    select 1 from public.care_team ct
    where ct.patient_id = new_patient and ct.staff_id = _staff
      and ct.since <= private.london_today() and (ct.until is null or ct.until > private.london_today())
  );

  -- Admins and PAs are told, with a link and no name.
  insert into public.notifications (user_id, topic, title, body, link)
  select distinct r.user_id, 'appointments'::public.notification_topic, 'New online booking',
    case when existing then 'An existing patient has booked online, on their own record.'
         else 'A new patient has booked online. Check their details and invite them to the portal.' end,
    '/clinic/diary/' || appt::text
  from public.user_roles r join public.profiles u on u.id = r.user_id
  where r.role in ('admin', 'pa') and u.status = 'active';

  perform set_config('app.system_actor', '', true);
  appointment_id := appt;
  patient_id := new_patient;
  return next;
end;
$$;
