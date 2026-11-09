-- Results, part one: getting results in and out, without AI.
-- A PA (or doctor) enters the values from a PDF or a paper report, and the database converts each
-- one to the clinic's UK unit and flags it against the marker's range. A doctor then releases the
-- report, which is the moment a patient can see it. Patients and guardians can send in a PDF of
-- their own, which lands in the same queue. All writes go through the functions below: the tables
-- themselves still give signed-in people no way to insert or change a report or a result.

alter type public.document_source add value if not exists 'staff_upload';

-- Units ----------------------------------------------------------------------------------------
-- How to turn a value in another unit into the marker's unit: value * factor + offset_value.
-- The factors are the standard ones; the clinic's own list replaces them when it arrives.

create table public.marker_conversions (
  marker_id uuid not null references public.markers (id) on delete restrict,
  from_unit text not null check (char_length(from_unit) between 1 and 20),
  factor numeric not null check (factor > 0),
  offset_value numeric not null default 0,
  created_at timestamptz not null default now(),
  primary key (marker_id, from_unit)
);
comment on table public.marker_conversions is 'How to convert a value reported in another unit to the marker''s own unit: value * factor + offset_value.';

alter table public.marker_conversions enable row level security;
alter table public.marker_conversions force row level security;
revoke all on table public.marker_conversions from public, anon, authenticated;
grant select, insert, update on public.marker_conversions to authenticated;

create policy "Anyone signed in reads marker conversions" on public.marker_conversions
  for select to authenticated using (true);
create policy "Admins add marker conversions" on public.marker_conversions
  for insert to authenticated with check ((select private.has_role('admin')));
create policy "Admins change marker conversions" on public.marker_conversions
  for update to authenticated using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));

create trigger marker_conversions_write_audit_log after insert or update or delete on public.marker_conversions
  for each row execute function private.write_audit_log();

insert into public.marker_conversions (marker_id, from_unit, factor, offset_value)
select m.id, c.from_unit, c.factor, c.offset_value
from (values
  ('TESTO',    'ng/dL',  0.03467,  0),
  ('OEST',     'pg/mL',  3.671,    0),
  ('PROG',     'ng/mL',  3.18,     0),
  ('GLUCOSE',  'mg/dL',  0.05551,  0),
  ('TCHOL',    'mg/dL',  0.02586,  0),
  ('LDL',      'mg/dL',  0.02586,  0),
  ('HDL',      'mg/dL',  0.02586,  0),
  ('TRIG',     'mg/dL',  0.01129,  0),
  ('VITD',     'ng/mL',  2.496,    0),
  ('HBA1C',    '%',      10.929,   -23.497),
  ('B12',      'pmol/L', 1.355,    0),
  ('FERRITIN', 'ng/mL',  1,        0),
  ('PSA',      'ng/mL',  1,        0),
  ('CRP',      'mg/dL',  10,       0),
  ('DHEAS',    'µg/dL',  0.02714,  0),
  ('HB',       'g/dL',   10,       0),
  ('FT4',      'ng/dL',  12.87,    0),
  ('FT3',      'pg/mL',  1.536,    0)
) as c (code, from_unit, factor, offset_value)
join public.markers m on m.code = c.code
on conflict do nothing;

-- The value as reported, next to the converted one.
alter table public.results
  add column original_value numeric,
  add column original_unit text;
comment on column public.results.original_value is 'The value as the lab reported it, before conversion to the marker''s unit.';
grant select (original_value, original_unit) on public.results to authenticated;

-- Which flag a value gets. Borderline means inside the range but within 5% of its width (or of
-- the limit, when there is only one) of an edge. Critical is never worked out: a doctor sets it.
create function private.result_flag(_value numeric, _low numeric, _high numeric)
returns public.result_flag
language sql
immutable
set search_path = ''
as $$
  select case
    when _low is not null and _value < _low then 'low'
    when _high is not null and _value > _high then 'high'
    when _low is not null and _value < _low + 0.05 * coalesce(_high - _low, abs(_low)) then 'borderline'
    when _high is not null and _value > _high - 0.05 * coalesce(_high - _low, abs(_high)) then 'borderline'
    else 'normal'
  end::public.result_flag;
$$;

-- Registering a file for entry --------------------------------------------------------------------

create function private.register_import(_document_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
      (select private.has_role('pa') or private.has_role('doctor'))
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
$$;

-- Entering a report ------------------------------------------------------------------------------

create function private.enter_report(
  _patient uuid,
  _sample_date date,
  _lab_name text,
  _document_id uuid,
  _import_id uuid,
  _items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
  if staff is null or not (select private.has_role('pa') or private.has_role('doctor')) or not private.in_scope(_patient) then
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
$$;

-- Releasing a report ---------------------------------------------------------------------------

create function private.release_report(_report uuid, _comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff uuid := private.my_staff_id();
  r public.lab_reports;
  patient_user uuid;
begin
  select * into r from public.lab_reports x where x.id = _report for update;
  if not found or staff is null or not (select private.has_role('doctor')) or not private.in_scope(r.patient_id) then
    raise exception 'You cannot release this report.' using errcode = '42501';
  end if;
  if r.released_at is not null then
    raise exception 'This report has already been released.' using errcode = '23505';
  end if;
  if _comment is not null and char_length(_comment) > 2000 then
    raise exception 'Use 2,000 characters or fewer for the comment.' using errcode = '22023';
  end if;

  update public.lab_reports
  set status = 'released', reviewed_by = staff, reviewed_at = now(), released_at = now(),
      patient_comment = nullif(btrim(_comment), '')
  where id = _report;

  if r.lab_order_id is not null then
    update public.lab_orders set status = 'reviewed' where id = r.lab_order_id and status = 'results_in';
  end if;

  select p.user_id into patient_user from public.patient_profiles p where p.id = r.patient_id;
  if patient_user is not null then
    insert into public.notifications (user_id, topic, title, body, link)
    values (patient_user, 'results', 'Your results are ready', 'A doctor has reviewed them and added them to your account.', '/portal/results');
  end if;
end;
$$;

-- Wrappers and grants ------------------------------------------------------------------------------

create function public.register_import(_document_id uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.register_import(_document_id); $$;

create function public.enter_report(
  _patient uuid, _sample_date date, _items jsonb,
  _lab_name text default null, _document_id uuid default null, _import_id uuid default null
)
returns uuid language sql security invoker set search_path = ''
as $$ select private.enter_report(_patient, _sample_date, _lab_name, _document_id, _import_id, _items); $$;

create function public.release_report(_report uuid, _comment text default null)
returns void language sql security invoker set search_path = ''
as $$ select private.release_report(_report, _comment); $$;

revoke all on function
  private.result_flag(numeric, numeric, numeric),
  private.register_import(uuid),
  private.enter_report(uuid, date, text, uuid, uuid, jsonb),
  private.release_report(uuid, text),
  public.register_import(uuid),
  public.enter_report(uuid, date, jsonb, text, uuid, uuid),
  public.release_report(uuid, text)
from public, anon, authenticated;

grant execute on function
  private.result_flag(numeric, numeric, numeric),
  private.register_import(uuid),
  private.enter_report(uuid, date, text, uuid, uuid, jsonb),
  private.release_report(uuid, text),
  public.register_import(uuid),
  public.enter_report(uuid, date, jsonb, text, uuid, uuid),
  public.release_report(uuid, text)
to authenticated;
