-- A new online booking that may be someone already on the clinic's books (decided 18 November 2026:
-- tell the team only, never merge). The match by email and date of birth stays as it is; this looks for
-- the near misses it cannot catch: the same name and date of birth with a different email, the same
-- name and email with a different date of birth (a typing slip), and the same date of birth and phone.

-- The matching itself. Returns other records, never the new one. Server code and the check below use it.
create function private.find_possible_duplicates(_patient uuid)
returns table (patient_id uuid, clinic_ref text, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.clinic_ref,
    case
      when lower(btrim(o.first_name)) = lower(btrim(p.first_name)) and lower(btrim(o.last_name)) = lower(btrim(p.last_name)) and o.date_of_birth = p.date_of_birth
        then 'The same name and date of birth'
      when lower(btrim(o.first_name)) = lower(btrim(p.first_name)) and lower(btrim(o.last_name)) = lower(btrim(p.last_name))
        and p.contact_email is not null and lower(o.contact_email) = lower(p.contact_email)
        then 'The same name and email address'
      else 'The same date of birth and phone number'
    end
  from public.patient_profiles p
  join public.patient_profiles o on o.id <> p.id and o.archived_at is null
  where p.id = _patient
    and (
      (lower(btrim(o.first_name)) = lower(btrim(p.first_name)) and lower(btrim(o.last_name)) = lower(btrim(p.last_name))
        and (o.date_of_birth = p.date_of_birth or (p.contact_email is not null and lower(o.contact_email) = lower(p.contact_email))))
      or (o.date_of_birth = p.date_of_birth and length(regexp_replace(coalesce(p.contact_phone, ''), '[^0-9]', '', 'g')) >= 7
        and regexp_replace(coalesce(o.contact_phone, ''), '[^0-9]', '', 'g') = regexp_replace(p.contact_phone, '[^0-9]', '', 'g'))
    )
  order by o.clinic_ref
  limit 5;
$$;
comment on function private.find_possible_duplicates(uuid) is 'Other records that look like the same person as this one: same name and date of birth, same name and email, or same date of birth and phone. For the team to check; nothing is merged.';

-- What a PA or admin sees on the booking page. No names: the clinic reference and why it looks alike.
create function private.possible_duplicates(_patient uuid)
returns table (patient_id uuid, clinic_ref text, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.has_role('admin') or private.has_role('pa')) then
    raise exception 'You cannot check for duplicate records.' using errcode = '42501';
  end if;
  return query select d.patient_id, d.clinic_ref, d.reason from private.find_possible_duplicates(_patient) d;
end;
$$;
comment on function private.possible_duplicates(uuid) is 'Admins and PAs only. Records that may be the same person as this one.';

create function public.possible_duplicates(_patient uuid)
returns table (patient_id uuid, clinic_ref text, reason text)
language sql stable security invoker set search_path = '' as $$ select * from private.possible_duplicates(_patient); $$;

revoke all on function
  private.find_possible_duplicates(uuid),
  private.possible_duplicates(uuid),
  public.possible_duplicates(uuid)
from public, anon, authenticated;
grant execute on function private.possible_duplicates(uuid), public.possible_duplicates(uuid) to authenticated;

-- The online booking, as before, with a sharper note to the team when the new record may be a duplicate.
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
  possible integer := 0;
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
  -- A suspended account is not booked online (one message for every refusal).
  if existing and exists (
    select 1 from public.patient_profiles p join public.profiles u on u.id = p.user_id
    where p.id = new_patient and u.status <> 'active'
  ) then
    raise exception 'We cannot take this booking online. Please contact the clinic.' using errcode = '22023';
  end if;

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

  -- The clinician booked joins the care team of a record this booking made, so they can prepare. An
  -- existing record's care team is never changed by an anonymous booking (S-168): the team decides.
  if not existing then
    insert into public.care_team (patient_id, staff_id, relationship, since)
    select new_patient, s.id, (case s.clinical_role when 'doctor' then 'doctor' when 'nurse' then 'nurse' else 'health_coach' end)::public.care_relationship, private.london_today()
    from public.staff_profiles s
    where s.id = _staff;
  end if;

  -- A new record may be someone already on the clinic's books whose details were typed a little
  -- differently. Nothing is merged: the team is told, so a person decides.
  if not existing then
    select count(*) into possible from private.find_possible_duplicates(new_patient);
  end if;

  -- Admins and PAs are told, with a link and no name.
  insert into public.notifications (user_id, topic, title, body, link)
  select distinct r.user_id, 'appointments'::public.notification_topic, 'New online booking',
    case
      when existing and not exists (
        select 1 from public.care_team ct
        where ct.patient_id = new_patient and ct.staff_id = _staff
          and ct.since <= private.london_today() and (ct.until is null or ct.until > private.london_today())
      ) then 'An existing patient has booked online with a clinician not on their care team. Check the booking, and add the clinician if right.'
      when existing then 'An existing patient has booked online, on their own record. Check the booking is expected.'
      when possible > 0 then 'A new patient has booked online, and may already be on the clinic''s books. Open the booking to check before you invite them to the portal.'
      else 'A new patient has booked online. Check their details and invite them to the portal.'
    end,
    '/clinic/diary/' || appt::text
  from public.user_roles r join public.profiles u on u.id = r.user_id
  where r.role in ('admin', 'pa') and u.status = 'active';

  perform set_config('app.system_actor', '', true);
  appointment_id := appt;
  patient_id := new_patient;
  return next;
end;
$$;
