-- Patient booking in Clinic Hub (knowledge base question 15, decided 11 November 2026).
--
--   Admins set the appointment types. Admins and PAs set each clinician's weekly hours, and a
--   clinician may set their own. A patient (or a guardian who can act) books a free slot with a
--   clinician on their care team; staff book for any patient they can open, with any clinician. A
--   slot is free when it sits inside the clinician's hours in London time and overlaps none of their
--   live appointments. The server checks the clinician's Google Calendar, if connected, when it lists
--   free times and again just before it books.
--   Patients cannot cancel or move a booking: the team does (the clinic's 48-hour policy).

create table public.appointment_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  duration_min integer not null check (duration_min between 5 and 480),
  location_kind public.location_kind not null,
  description text check (char_length(description) <= 1000),
  bookable_by_patients boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.appointment_types is 'What can be booked: name, length and whether it is in clinic or by video.';

create table public.clinician_availability (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles (id) on delete restrict,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  location_id uuid references public.locations (id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint clinician_availability_order check (end_time > start_time)
);
comment on table public.clinician_availability is 'A clinician''s weekly bookable hours, in London time. weekday: 1 = Monday, 7 = Sunday.';
create index clinician_availability_staff_idx on public.clinician_availability (staff_id, weekday);
create index clinician_availability_location_idx on public.clinician_availability (location_id);

alter table public.appointments add column appointment_type_id uuid references public.appointment_types (id) on delete restrict;
alter table public.appointments add column booked_by uuid references public.profiles (id) on delete restrict;
create index appointments_type_idx on public.appointments (appointment_type_id);
create index appointments_booked_by_idx on public.appointments (booked_by);
comment on column public.appointments.booked_by is 'Who booked it in Clinic Hub. Empty for bookings copied from another system.';

do $$
declare
  t text;
begin
  foreach t in array array['appointment_types', 'clinician_availability'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.write_audit_log()', t || '_write_audit_log', t);
  end loop;
end;
$$;
create trigger appointment_types_set_updated_at before update on public.appointment_types
  for each row execute function private.set_updated_at();
revoke delete, truncate on public.appointment_types, public.clinician_availability from service_role;

grant select on public.appointment_types, public.clinician_availability to authenticated;
grant insert (name, duration_min, location_kind, description, bookable_by_patients, active) on public.appointment_types to authenticated;
grant update (name, duration_min, location_kind, description, bookable_by_patients, active) on public.appointment_types to authenticated;
grant insert (staff_id, weekday, start_time, end_time, location_id, active) on public.clinician_availability to authenticated;
grant update (start_time, end_time, location_id, active) on public.clinician_availability to authenticated;

create policy "Anyone signed in reads appointment types" on public.appointment_types
  for select to authenticated using (true);
create policy "Admins add appointment types" on public.appointment_types
  for insert to authenticated with check ((select private.has_role('admin')));
create policy "Admins change appointment types" on public.appointment_types
  for update to authenticated using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));

-- Hours: everyone signed in reads them (patients need them to see free slots). Admins and PAs set
-- anyone's; a clinician sets their own.
create policy "Anyone signed in reads clinician hours" on public.clinician_availability
  for select to authenticated using (true);
create policy "Admins, PAs and the clinician add hours" on public.clinician_availability
  for insert to authenticated
  with check ((select private.has_role('admin')) or (select private.has_role('pa')) or staff_id = (select private.my_staff_id()));
create policy "Admins, PAs and the clinician change hours" on public.clinician_availability
  for update to authenticated
  using ((select private.has_role('admin')) or (select private.has_role('pa')) or staff_id = (select private.my_staff_id()))
  with check ((select private.has_role('admin')) or (select private.has_role('pa')) or staff_id = (select private.my_staff_id()));

-- When a clinician is busy, without saying with whom: what a patient needs to see free slots.
create function private.clinician_busy(_staff uuid, _from timestamptz, _to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.starts_at, a.starts_at + make_interval(mins => a.duration_min)
  from public.appointments a
  where (select auth.uid()) is not null
    and a.clinician_id = _staff
    and a.status in ('booked', 'confirmed')
    and a.starts_at < _to
    and a.starts_at + make_interval(mins => a.duration_min) > _from
  order by a.starts_at;
$$;
comment on function private.clinician_busy(uuid, timestamptz, timestamptz) is 'Busy intervals of one clinician, with no patient details. For working out free slots.';
create function public.clinician_busy(_staff uuid, _from timestamptz, _to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql security invoker set search_path = ''
as $$ select * from private.clinician_busy(_staff, _from, _to); $$;

-- Booking.
create function private.book_appointment(_patient uuid, _staff uuid, _type uuid, _starts_at timestamptz, _location uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
  -- One booking at a time per clinician: lock their rows, then check for an overlap.
  perform 1 from public.staff_profiles where id = _staff for update;
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
$$;
comment on function private.book_appointment(uuid, uuid, uuid, timestamptz, uuid) is 'Books a slot: patients with their care team, staff for patients they can open. Checks hours and overlaps.';
create function public.book_appointment(_patient uuid, _staff uuid, _type uuid, _starts_at timestamptz, _location uuid default null)
returns uuid language sql security invoker set search_path = ''
as $$ select private.book_appointment(_patient, _staff, _type, _starts_at, _location); $$;

-- Cancelling: the team only, for patients they can open. The row is kept, marked cancelled.
create function private.cancel_appointment(_appointment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.appointments;
begin
  select * into a from public.appointments where id = _appointment for update;
  if not found or not private.in_scope(a.patient_id) then
    raise exception 'You cannot cancel this appointment.' using errcode = '42501';
  end if;
  if a.status not in ('booked', 'confirmed') then
    raise exception 'This appointment is not open.' using errcode = '22023';
  end if;
  update public.appointments set status = 'cancelled' where id = _appointment;
end;
$$;
comment on function private.cancel_appointment(uuid) is 'Staff in scope cancel an appointment. Patients contact the team instead.';
create function public.cancel_appointment(_appointment uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.cancel_appointment(_appointment); $$;

-- The server stores the Google Calendar event it made for a booking, as the named job 'calendar-sync'.
create function private.set_appointment_calendar_event(_appointment uuid, _event text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.system_actor', 'calendar-sync', true);
  update public.appointments set external_id = _event, synced_at = now() where id = _appointment and source = 'clinic_hub';
end;
$$;
create function public.set_appointment_calendar_event(_appointment uuid, _event text)
returns void language sql security invoker set search_path = ''
as $$ select private.set_appointment_calendar_event(_appointment, _event); $$;

-- The clinicians a patient (or a guardian who can act) may book with: their current care team's
-- doctors, nurses and health coaches. Names and roles only.
create function private.get_bookable_clinicians(_patient uuid)
returns table (staff_id uuid, profile_id uuid, full_name text, clinical_role public.staff_role)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.user_id, p.full_name, s.clinical_role
  from public.care_team ct
  join public.staff_profiles s on s.id = ct.staff_id and s.active and s.archived_at is null
  join public.profiles p on p.id = s.user_id
  where private.can_act_for(_patient)
    and ct.patient_id = _patient
    and ct.since <= private.london_today()
    and (ct.until is null or ct.until > private.london_today())
    and s.clinical_role in ('doctor', 'nurse', 'health_coach')
  order by p.full_name;
$$;
create function public.get_bookable_clinicians(_patient uuid)
returns table (staff_id uuid, profile_id uuid, full_name text, clinical_role public.staff_role)
language sql security invoker set search_path = ''
as $$ select * from private.get_bookable_clinicians(_patient); $$;
revoke all on function private.get_bookable_clinicians(uuid), public.get_bookable_clinicians(uuid) from public, anon, authenticated;
grant execute on function private.get_bookable_clinicians(uuid), public.get_bookable_clinicians(uuid) to authenticated;

revoke all on function
  private.clinician_busy(uuid, timestamptz, timestamptz), public.clinician_busy(uuid, timestamptz, timestamptz),
  private.book_appointment(uuid, uuid, uuid, timestamptz, uuid), public.book_appointment(uuid, uuid, uuid, timestamptz, uuid),
  private.cancel_appointment(uuid), public.cancel_appointment(uuid),
  private.set_appointment_calendar_event(uuid, text), public.set_appointment_calendar_event(uuid, text)
from public, anon, authenticated;
grant execute on function
  private.clinician_busy(uuid, timestamptz, timestamptz), public.clinician_busy(uuid, timestamptz, timestamptz),
  private.book_appointment(uuid, uuid, uuid, timestamptz, uuid), public.book_appointment(uuid, uuid, uuid, timestamptz, uuid),
  private.cancel_appointment(uuid), public.cancel_appointment(uuid)
to authenticated;
grant execute on function private.set_appointment_calendar_event(uuid, text), public.set_appointment_calendar_event(uuid, text) to service_role;
