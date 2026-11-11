-- Who sees which patient, as decided by the clinic on 11 November 2026 (knowledge base questions 1 to 3, 7).
--
--   PAs and admins: every patient.
--   Doctors, nurses and health coaches: only the patients whose care team they are on, from the
--   `since` day until the `until` day, which is the day they leave: access stops at its start, so
--   setting `until` to today removes someone at once. Inside that, they see the whole record.
--   Safeguarding alerts stay with doctors, diagnoses and prescribing stay with doctors, and only a
--   doctor releases results to the patient. A nurse works like a doctor otherwise: reads the record,
--   enters results and adds allergies.
--   PAs, admins and doctors keep the care team up to date.
--
-- Every read and write policy on a patient's record already goes through private.in_scope(), so the
-- scope is changed there once. Policies that also named a role are widened below where needed.

-- The clinic's day. The database runs in UTC, and the app writes care-team dates in London time,
-- so access must change at London midnight, not an hour late during British Summer Time.
create function private.london_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Europe/London')::date $$;
comment on function private.london_today() is 'Today''s date in London, for care-team start and leaving days.';
grant execute on function private.london_today() to authenticated, service_role;

-- The care team is now what decides access for doctors, nurses and health coaches.
create or replace function private.in_scope(_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Nobody opens their own record, or that of someone they look after, as staff: as a patient or
  -- guardian they see what any patient sees (knowledge base question 4).
  select _patient_id is not null
  and _patient_id not in (select private.my_patient_ids())
  and (
    private.has_role('admin')
    or private.has_role('pa')
    or (
      (private.has_role('doctor') or private.has_role('nurse') or private.has_role('health_coach'))
      and exists (
        select 1 from public.care_team ct
        where ct.patient_id = _patient_id
          and ct.staff_id = private.my_staff_id()
          and ct.since <= private.london_today()
          and (ct.until is null or ct.until > private.london_today())
      )
    )
  );
$$;
comment on function private.in_scope(uuid) is 'Can this staff member open this patient''s record? PAs and admins: every patient. Doctors, nurses and health coaches: patients whose care team they are currently on. Decided by the clinic, 11 November 2026.';

-- The nurse is clinical staff.
create or replace function private.is_clinical_staff()
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
    where r.user_id = (select auth.uid())
      and r.role in ('doctor', 'nurse', 'pa', 'health_coach')
      and p.status <> 'suspended'
      and private.is_active_staff(r.user_id)
  );
$$;
comment on function private.is_clinical_staff() is 'Doctor, nurse, PA or health coach. Admins are not clinical staff, though they can read every record (in_scope).';

-- Opening a record is logged for anyone who may open it, admins included.
create or replace function private.log_record_view(_patient uuid, _entity text, _entity_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  role_held public.app_role;
  target uuid := coalesce(_entity_id, _patient);
begin
  if actor is null or not private.in_scope(_patient) then
    raise exception 'You cannot open this record.' using errcode = '42501';
  end if;
  if _entity is null or _entity not in ('patient_profiles', 'lab_reports') then
    raise exception 'That record cannot be logged.' using errcode = '22023';
  end if;
  -- The record named must exist and belong to this patient, so the log cannot be filled with made-up
  -- ids or point one patient's record at another patient.
  if _entity = 'patient_profiles' and _entity_id is not null and _entity_id <> _patient then
    raise exception 'That record does not belong to this patient.' using errcode = '22023';
  end if;
  if _entity = 'lab_reports' and (
    _entity_id is null
    or not exists (select 1 from public.lab_reports l where l.id = _entity_id and l.patient_id = _patient)
  ) then
    raise exception 'That record does not belong to this patient.' using errcode = '22023';
  end if;

  select r.role into role_held
  from public.user_roles r
  where r.user_id = actor and r.role in ('doctor', 'nurse', 'pa', 'health_coach', 'admin')
  order by array_position(array['doctor', 'nurse', 'pa', 'health_coach', 'admin']::public.app_role[], r.role)
  limit 1;

  if exists (
    select 1 from public.audit_log a
    where a.actor_id = actor and a.action = 'viewed' and a.entity = _entity and a.entity_id = target
      and a.created_at > now() - interval '10 minutes'
  ) then
    return;
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, metadata)
  values (actor, role_held, 'viewed', _entity, target, jsonb_build_object('patient_id', _patient));
end;
$function$;

-- Nurses enter results and send files in for entry, as doctors and PAs do. Release stays with doctors.
create or replace function private.enter_report(_patient uuid, _sample_date date, _lab_name text, _document_id uuid, _import_id uuid, _items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  staff uuid := private.my_staff_id();
  report_id uuid;
  item jsonb;
  m public.markers;
  conv public.marker_conversions;
  v numeric;
  u text;
  converted numeric;
  seen uuid[] := array[]::uuid[];
begin
  if staff is null or not (select private.has_role('pa') or private.has_role('doctor') or private.has_role('nurse')) or not private.in_scope(_patient) then
    raise exception 'You cannot enter results for this patient.' using errcode = '42501';
  end if;
  if _sample_date is null or _sample_date > current_date or _sample_date < date '1990-01-01' then
    raise exception 'Enter a valid sample date.' using errcode = '22023';
  end if;
  if _lab_name is not null and char_length(_lab_name) > 120 then
    raise exception 'Use 120 characters or fewer for the lab name.' using errcode = '22023';
  end if;
  if jsonb_typeof(_items) is distinct from 'array' or jsonb_array_length(_items) not between 1 and 80 then
    raise exception 'Add between 1 and 80 results.' using errcode = '22023';
  end if;

  if _document_id is not null then
    -- A file whose path still starts with unmatched/ must be moved to the patient's folder first.
    if not exists (select 1 from public.documents d where d.id = _document_id and d.patient_id = _patient) then
      raise exception 'That file is not filed under this patient.' using errcode = '22023';
    end if;
  end if;

  insert into public.lab_reports (patient_id, document_id, external_lab_name, sample_date, status)
  values (_patient, _document_id, nullif(btrim(_lab_name), ''), _sample_date, 'awaiting_review')
  returning id into report_id;

  for item in select * from jsonb_array_elements(_items) loop
    select * into m from public.markers where id = private.try_uuid(item ->> 'marker_id');
    if not found then
      raise exception 'Choose a marker for every row.' using errcode = '22023';
    end if;
    if m.id = any (seen) then
      raise exception '% appears more than once.', m.name using errcode = '22023';
    end if;
    seen := seen || m.id;

    begin
      v := (item ->> 'value')::numeric;
    exception when others then
      raise exception 'Enter a number for %.', m.name using errcode = '22023';
    end;
    if v is null or v::text in ('NaN', 'Infinity', '-Infinity') or abs(v) > 1000000000 then
      raise exception 'Enter a number for %.', m.name using errcode = '22023';
    end if;
    u := nullif(btrim(item ->> 'unit'), '');

    if u is null or u = m.unit then
      converted := v;
    else
      select * into conv from public.marker_conversions c where c.marker_id = m.id and c.from_unit = u;
      if not found then
        raise exception 'There is no conversion from % to % for %.', u, coalesce(m.unit, 'its unit'), m.name using errcode = '22023';
      end if;
      converted := round(v * conv.factor + conv.offset_value, 4);
    end if;

    insert into public.results (
      lab_report_id, patient_id, marker_id, value_numeric, unit, ref_low, ref_high, flag, original_value, original_unit
    ) values (
      report_id, _patient, m.id, converted, m.unit, m.ref_low, m.ref_high,
      private.result_flag(converted, m.ref_low, m.ref_high),
      case when u is not null and u is distinct from m.unit then v end,
      case when u is not null and u is distinct from m.unit then u end
    );
  end loop;

  if _import_id is not null then
    -- The file waiting for entry must be this patient's, whether or not the document is passed.
    if not exists (
      select 1 from public.result_imports i
      where i.id = _import_id and i.patient_id = _patient
        and (_document_id is null or i.document_id = _document_id)
    ) then
      raise exception 'That file belongs to another patient.' using errcode = '22023';
    end if;
    update public.result_imports i
    set status = 'confirmed', lab_report_id = report_id, patient_id = _patient, handled_by = staff
    where i.id = _import_id and i.status in ('needs_match', 'matched')
      and (_document_id is null or i.document_id = _document_id);
    if not found then
      raise exception 'This file has already been dealt with.' using errcode = '23505';
    end if;
  end if;

  return report_id;
end;
$function$;

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
      (select private.has_role('pa') or private.has_role('doctor') or private.has_role('nurse'))
      and (doc.patient_id is null or private.in_scope(doc.patient_id))
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

-- Results and reports: in-scope staff read everything, released or not. Patients still see released only.
alter policy "Patients, guardians and the health coach read released results " on public.results
  using (
    ((patient_id in (select private.my_patient_ids())) and private.report_is_released(lab_report_id))
    or private.in_scope(patient_id)
  );
alter policy "Patients, guardians and the health coach read released reports " on public.lab_reports
  using (
    ((released_at is not null) and (patient_id in (select private.my_patient_ids())))
    or private.in_scope(patient_id)
  );

-- Documents: in-scope staff read a patient's files; unmatched files are for the people who match them.
alter policy "Patients and guardians read shared documents and staff in scope" on public.documents
  using (
    ((archived_at is null) and shared_with_patient and (patient_id in (select private.my_patient_ids())) and private.document_gate_open(id, kind))
    or private.in_scope(patient_id)
    or (patient_id is null and ((select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('pa'))))
  );
alter policy "Patients and guardians upload their own and doctors and PAs add" on public.documents
  with check (
    (uploaded_by = (select auth.uid()))
    and (
      ((kind = 'patient_upload') and (source = 'patient_upload') and shared_with_patient and private.can_act_for(patient_id) and private.storage_object_is_mine(storage_path))
      or (((select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('pa'))) and ((patient_id is null) or private.in_scope(patient_id)))
    )
  );
alter policy "Doctors and PAs change documents" on public.documents
  using ((((select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('pa'))) and ((patient_id is null) or private.in_scope(patient_id))))
  with check ((((select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('pa'))) and ((patient_id is null) or private.in_scope(patient_id))));

-- The import queue: nurses work it with doctors and PAs.
alter policy "PAs and doctors read result imports" on public.result_imports
  using (
    ((select private.has_role('pa')) or (select private.has_role('doctor')) or (select private.has_role('nurse')))
    and (patient_id is null or private.in_scope(patient_id))
  );
alter policy "PAs and doctors match and reject result imports" on public.result_imports
  using (
    ((select private.has_role('pa')) or (select private.has_role('doctor')) or (select private.has_role('nurse')))
    and (patient_id is null or private.in_scope(patient_id))
    and status <> 'confirmed'
  )
  with check (
    ((select private.has_role('pa')) or (select private.has_role('doctor')) or (select private.has_role('nurse')))
    and (patient_id is null or private.in_scope(patient_id))
    and status in ('needs_match', 'matched', 'rejected')
    and (handled_by is null or handled_by = (select private.my_staff_id()))
    and (
      patient_id is null
      or exists (
        select 1 from public.documents d
        where d.id = document_id and (d.patient_id is null or d.patient_id = result_imports.patient_id)
      )
    )
  );
alter policy "PAs and doctors read import items" on public.import_items
  using (
    ((select private.has_role('pa')) or (select private.has_role('doctor')) or (select private.has_role('nurse')))
    and import_id in (select i.id from public.result_imports i)
  );
alter policy "PAs and doctors decide import items" on public.import_items
  using (
    ((select private.has_role('pa')) or (select private.has_role('doctor')) or (select private.has_role('nurse')))
    and import_id in (select i.id from public.result_imports i)
  )
  with check (
    ((select private.has_role('pa')) or (select private.has_role('doctor')) or (select private.has_role('nurse')))
    and import_id in (select i.id from public.result_imports i)
    and decided_by = (select private.my_staff_id())
  );

-- Allergies: nurses record them too.
alter policy "Doctors and PAs add allergies" on public.patient_allergies
  with check (
    ((select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('pa')))
    and private.in_scope(patient_id)
    and recorded_by = (select private.my_staff_id())
  );
alter policy "Doctors and PAs change allergies" on public.patient_allergies
  using ((((select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('pa'))) and private.in_scope(patient_id)))
  with check ((((select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('pa'))) and private.in_scope(patient_id)));

-- The care team decides access, so PAs, admins and doctors keep it up to date. Everyone who can be on
-- it can read it, so a nurse or coach sees who else looks after their patient.
alter policy "PAs and doctors add to the care team" on public.care_team
  with check (
    ((select private.has_role('pa')) or (select private.has_role('admin')) or (select private.has_role('doctor')))
    and private.in_scope(patient_id)
  );
alter policy "PAs and doctors change the care team" on public.care_team
  using (
    ((select private.has_role('pa')) or (select private.has_role('admin')) or (select private.has_role('doctor')))
    and private.in_scope(patient_id)
  )
  with check (
    ((select private.has_role('pa')) or (select private.has_role('admin')) or (select private.has_role('doctor')))
    and private.in_scope(patient_id)
  );
alter policy "The team reads the care team" on public.care_team
  using (private.in_scope(patient_id));

-- Nobody joins the care team of their own patient record, whoever adds them.
create function private.reject_self_care()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.staff_profiles s
    join public.patient_profiles p on p.user_id = s.user_id
    where s.id = new.staff_id and p.id = new.patient_id
  ) then
    raise exception 'A team member cannot be on their own care team.' using errcode = '42501';
  end if;
  return new;
end;
$$;
comment on function private.reject_self_care() is 'Trigger: a staff member who is also a patient is never on their own care team.';
revoke all on function private.reject_self_care() from public, anon, authenticated;
create trigger care_team_reject_self before insert or update on public.care_team
  for each row execute function private.reject_self_care();

-- Nurses enter results with the lab's file, so they upload to the documents bucket as doctors and PAs do.
alter policy "People upload document files for patients they can act for" on storage.objects
  with check (
    bucket_id = 'documents'
    and (
      private.can_act_for(private.try_uuid(split_part(name, '/', 1)))
      or (
        ((select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('pa')))
        and (
          split_part(name, '/', 1) = 'unmatched'
          or private.in_scope(private.try_uuid(split_part(name, '/', 1)))
        )
      )
    )
  );
