-- The clinic diary and online booking for new patients (Dr Schoeman, 12 November 2026: a day, week
-- and month overview of every clinician's bookings, as in Semble, and new patients booking natively
-- instead of through GoHighLevel calendars).
--
-- 1. The diary. Every team member reads every clinician's bookings with the patient's name, as in
--    Semble (the clinic's default until it decides otherwise); opening the patient's record still
--    follows the care team. Admins, PAs and staff who can open the record move a booking to another
--    time or clinician, within the clinician's hours and without overlapping another booking.
-- 2. Online booking. An appointment type can be offered for online booking. A new patient picks a
--    clinician (or any), a free time, and gives their name, date of birth, email and phone. The
--    server, as the named job 'online-booking', creates a patient record marked as booked online and
--    the appointment. The patient has no portal account until the team invites them.

-- Appointment types offered online -----------------------------------------------------------------

alter table public.appointment_types
  add column bookable_online boolean not null default false;
comment on column public.appointment_types.bookable_online is 'New patients may book this type themselves on the public booking page.';
grant insert (bookable_online) on public.appointment_types to authenticated;
grant update (bookable_online) on public.appointment_types to authenticated;

-- Patients and appointments made online ---------------------------------------------------------------

alter table public.patient_profiles
  add column booked_online_at timestamptz;
comment on column public.patient_profiles.booked_online_at is 'Set when the record was made by a new patient booking online. The team checks the details and invites them.';

alter table public.appointments
  add column booked_online boolean not null default false;
comment on column public.appointments.booked_online is 'Booked by a new patient on the public booking page.';

-- 1. The diary --------------------------------------------------------------------------------------------

-- Every clinician's bookings between two times, for the team. Cancelled bookings are left out. The
-- range is at most six weeks. can_open says whether the reader may open the patient's record.
create function private.clinic_diary(_from timestamptz, _to timestamptz)
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
  new_patient boolean
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
      p.booked_online_at is not null and p.user_id is null
    from public.appointments a
    join public.patient_profiles p on p.id = a.patient_id
    where a.starts_at < _to
      and a.starts_at + make_interval(mins => a.duration_min) > _from
      and a.status <> 'cancelled'
    order by a.starts_at, a.clinician_id;
end;
$$;

-- Moves a booking to another time, and optionally another clinician and place. The same checks as
-- booking: the clinician can be booked, the time is inside their hours, and it overlaps no other
-- live booking of theirs.
create function private.move_appointment(_appointment uuid, _staff uuid, _starts_at timestamptz, _location uuid default null)
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
begin
  select * into a from public.appointments x where x.id = _appointment for update;
  if not found or not private.in_scope(a.patient_id) or not (
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
  if not exists (select 1 from public.staff_profiles s where s.id = _staff and s.active and s.archived_at is null and s.clinical_role in ('doctor', 'nurse', 'health_coach')) then
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
  if local_end::date <> local_start::date or not exists (
    select 1 from public.clinician_availability h
    where h.staff_id = _staff and h.active
      and h.weekday = extract(isodow from local_start)
      and h.start_time <= local_start::time and h.end_time >= local_end::time
      and (_location is null or h.location_id is null or h.location_id = _location)
  ) then
    raise exception 'That time is outside the clinician''s hours.' using errcode = '22023';
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
  update public.appointments
  set clinician_id = _staff, starts_at = _starts_at, location_id = _location, status = 'booked'
  where id = _appointment;
end;
$$;

-- 2. Online booking ------------------------------------------------------------------------------------------

-- The clinicians a new patient may choose from for a type: doctors, nurses and health coaches with
-- hours. Names and job titles only. For the server's public booking page.
create function private.online_booking_clinicians()
returns table (staff_id uuid, profile_id uuid, full_name text, job_title text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.user_id, p.full_name, s.job_title
  from public.staff_profiles s
  join public.profiles p on p.id = s.user_id
  where s.active and s.archived_at is null and s.clinical_role in ('doctor', 'nurse', 'health_coach')
    and p.status = 'active'
    and exists (select 1 from public.clinician_availability h where h.staff_id = s.id and h.active)
  order by p.full_name;
$$;

-- When a clinician is busy, with no patient details, for the public booking page's free times.
create function private.online_busy(_staff uuid, _from timestamptz, _to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.starts_at, a.starts_at + make_interval(mins => a.duration_min)
  from public.appointments a
  where a.clinician_id = _staff and a.status in ('booked', 'confirmed')
    and a.starts_at < least(_to, now() + interval '121 days')
    and a.starts_at + make_interval(mins => a.duration_min) > greatest(_from, now())
  order by a.starts_at;
$$;

-- A new patient books online. Called by the server only, after its own checks and rate limits.
-- Creates the patient record and the appointment together, or neither.
create function private.book_online(
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
  if _date_of_birth > (current_date - interval '18 years')::date then
    raise exception 'Online booking is for adults. Please call the clinic to book for a child.' using errcode = '22023';
  end if;
  if address !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(address) > 254 then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  if _phone is null or btrim(_phone) !~ '^\+?[0-9 ()-]{7,20}$' then
    raise exception 'Enter a phone number.' using errcode = '22023';
  end if;
  -- One person may hold two open online bookings at most.
  if (
    select count(*) from public.appointments a join public.patient_profiles p on p.id = a.patient_id
    where a.booked_online and lower(p.contact_email) = address and a.status in ('booked', 'confirmed') and a.starts_at > now()
  ) >= 2 then
    raise exception 'You already have bookings with us. Please contact the clinic to book more.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.staff_profiles s where s.id = _staff and s.active and s.archived_at is null and s.clinical_role in ('doctor', 'nurse', 'health_coach')) then
    raise exception 'That clinician cannot be booked.' using errcode = '22023';
  end if;
  if _starts_at <= now() + interval '24 hours' or _starts_at > now() + interval '120 days' then
    raise exception 'Choose a time from tomorrow up to four months ahead.' using errcode = '22023';
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

  insert into public.patient_profiles (clinic_ref, first_name, last_name, date_of_birth, contact_email, contact_phone, booked_online_at)
  values ('SC-' || lpad(nextval('private.patient_ref_seq')::text, 6, '0'), btrim(_first_name), btrim(_last_name), _date_of_birth, address, btrim(_phone), now())
  returning id into new_patient;

  insert into public.appointments (patient_id, clinician_id, location_id, starts_at, duration_min, type, status, source, appointment_type_id, booked_online)
  values (new_patient, _staff, _location, _starts_at, kind.duration_min, kind.name, 'booked', 'clinic_hub', _type, true)
  returning id into appt;

  -- Admins and PAs are told, with a link and no name.
  insert into public.notifications (user_id, topic, title, body, link)
  select distinct r.user_id, 'appointments'::public.notification_topic, 'New online booking',
    'A new patient has booked online. Check their details and invite them to the portal.', '/clinic/diary/' || appt::text
  from public.user_roles r join public.profiles u on u.id = r.user_id
  where r.role in ('admin', 'pa') and u.status <> 'suspended';

  perform set_config('app.system_actor', '', true);
  appointment_id := appt;
  patient_id := new_patient;
  return next;
end;
$$;

-- Wrappers and grants ---------------------------------------------------------------------------------------

create function public.clinic_diary(_from timestamptz, _to timestamptz)
returns table (id uuid, starts_at timestamptz, duration_min integer, type text, status public.appt_status, clinician_id uuid, location_id uuid,
  patient_id uuid, patient_name text, clinic_ref text, can_open boolean, booked_online boolean, new_patient boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.clinic_diary(_from, _to); $$;
create function public.move_appointment(_appointment uuid, _staff uuid, _starts_at timestamptz, _location uuid default null)
returns void language sql security invoker set search_path = ''
as $$ select private.move_appointment(_appointment, _staff, _starts_at, _location); $$;
create function public.online_booking_clinicians()
returns table (staff_id uuid, profile_id uuid, full_name text, job_title text)
language sql stable security invoker set search_path = ''
as $$ select * from private.online_booking_clinicians(); $$;
create function public.online_busy(_staff uuid, _from timestamptz, _to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.online_busy(_staff, _from, _to); $$;
create function public.book_online(_type uuid, _staff uuid, _starts_at timestamptz, _location uuid, _first_name text, _last_name text, _date_of_birth date, _email text, _phone text)
returns table (appointment_id uuid, patient_id uuid)
language sql security invoker set search_path = ''
as $$ select * from private.book_online(_type, _staff, _starts_at, _location, _first_name, _last_name, _date_of_birth, _email, _phone); $$;

revoke all on function
  private.clinic_diary(timestamptz, timestamptz),
  private.move_appointment(uuid, uuid, timestamptz, uuid),
  private.online_booking_clinicians(),
  private.online_busy(uuid, timestamptz, timestamptz),
  private.book_online(uuid, uuid, timestamptz, uuid, text, text, date, text, text),
  public.clinic_diary(timestamptz, timestamptz),
  public.move_appointment(uuid, uuid, timestamptz, uuid),
  public.online_booking_clinicians(),
  public.online_busy(uuid, timestamptz, timestamptz),
  public.book_online(uuid, uuid, timestamptz, uuid, text, text, date, text, text)
from public, anon, authenticated;
grant execute on function
  private.clinic_diary(timestamptz, timestamptz),
  private.move_appointment(uuid, uuid, timestamptz, uuid),
  public.clinic_diary(timestamptz, timestamptz),
  public.move_appointment(uuid, uuid, timestamptz, uuid)
to authenticated;
-- The public booking page runs on the server, which alone may list clinicians and book online.
grant execute on function
  private.online_booking_clinicians(),
  private.online_busy(uuid, timestamptz, timestamptz),
  private.book_online(uuid, uuid, timestamptz, uuid, text, text, date, text, text),
  public.online_booking_clinicians(),
  public.online_busy(uuid, timestamptz, timestamptz),
  public.book_online(uuid, uuid, timestamptz, uuid, text, text, date, text, text)
to service_role;
