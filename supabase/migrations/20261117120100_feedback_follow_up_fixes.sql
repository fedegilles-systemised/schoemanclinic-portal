-- Follow-up to 20261117120000_forms_and_feedback.sql, from its review.
--
-- 1. Follow-up due dates skip bank holidays in England and Wales as well as weekends.
-- 2. A quote is checked by a person before it can leave Clinic Hub as CQC evidence: the patient
--    agreed to be quoted without their name, but what they wrote may still name someone or say
--    something about their health. Only checked quotes go into the evidence download.
-- 3. Each feedback download is written to the audit log: who, when, which download and how many rows.

-- 1. Bank holidays ---------------------------------------------------------------------------------

-- Easter Sunday in the Gregorian calendar (the anonymous Gregorian algorithm).
create function private.easter_sunday(_year integer)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  a integer := _year % 19;
  b integer := _year / 100;
  c integer := _year % 100;
  d integer := b / 4;
  e integer := b % 4;
  f integer := (b + 8) / 25;
  g integer := (b - f + 1) / 3;
  h integer := (19 * a + b - d - g + 15) % 30;
  i integer := c / 4;
  k integer := c % 4;
  l integer := (32 + 2 * e + 2 * i - h - k) % 7;
  m integer := (a + 11 * h + 22 * l) / 451;
begin
  return make_date(_year, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
end;
$$;

-- The regular bank holidays in England and Wales, with the substitute days when one falls at a
-- weekend. One-off holidays (a coronation, a jubilee) are not included.
create function private.is_bank_holiday(_day date)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  y integer := extract(year from _day)::int;
  easter date := private.easter_sunday(y);
  new_year date := make_date(y, 1, 1);
  christmas date := make_date(y, 12, 25);
  may_first date := make_date(y, 5, 1);
  may_last date := make_date(y, 5, 31);
  august_last date := make_date(y, 8, 31);
  holidays date[];
begin
  holidays := array[
    -- New Year's Day, or the Monday after when it falls at a weekend.
    case extract(isodow from new_year)::int when 6 then new_year + 2 when 7 then new_year + 1 else new_year end,
    easter - 2,
    easter + 1,
    -- The first Monday in May, the last Monday in May and the last Monday in August.
    may_first + ((8 - extract(isodow from may_first)::int) % 7),
    may_last - ((extract(isodow from may_last)::int - 1) % 7),
    august_last - ((extract(isodow from august_last)::int - 1) % 7),
    -- Christmas Day and Boxing Day, moved to the next weekdays when either falls at a weekend.
    case extract(isodow from christmas)::int when 6 then christmas + 2 when 7 then christmas + 2 else christmas end,
    case extract(isodow from christmas)::int when 5 then christmas + 3 when 6 then christmas + 3 when 7 then christmas + 1 else christmas + 1 end
  ];
  return _day = any (holidays);
end;
$$;

-- The first working day on or after a date: not a Saturday, Sunday or bank holiday.
create or replace function private.working_day_from(_day date)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  d date := _day;
begin
  while extract(isodow from d)::int in (6, 7) or private.is_bank_holiday(d) loop
    d := d + 1;
  end loop;
  return d;
end;
$$;

-- 2. Checking a quote before it is used as evidence ----------------------------------------------------

alter table public.patient_feedback
  add column quote_checked_by uuid references public.staff_profiles (id) on delete restrict,
  add column quote_checked_at timestamptz,
  add constraint patient_feedback_quote_checked_whole check ((quote_checked_by is null) = (quote_checked_at is null));
comment on column public.patient_feedback.quote_checked_by is 'Who checked the comments hold no name or health detail before they are used as CQC evidence. Only checked quotes are downloaded as evidence.';
create index patient_feedback_quote_checked_by_idx on public.patient_feedback (quote_checked_by);

-- An admin, PA or doctor who can read the feedback marks its comments as checked for use as
-- evidence, or takes the check back. Only answers the patient agreed may be quoted, with a comment.
create function private.check_feedback_quote(_feedback uuid, _checked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff uuid := private.my_staff_id();
  f public.patient_feedback;
begin
  select * into f from public.patient_feedback x where x.id = _feedback for update;
  if not found or staff is null or not private.can_read_feedback(f.patient_id) then
    raise exception 'You cannot check this feedback.' using errcode = '42501';
  end if;
  if _checked is null then
    raise exception 'Say whether the quote is checked.' using errcode = '22023';
  end if;
  if _checked and (f.answered_at is null or not f.may_quote or (f.went_well is null and f.could_improve is null)) then
    raise exception 'Only comments the patient agreed may be quoted can be checked.' using errcode = '22023';
  end if;
  update public.patient_feedback
  set quote_checked_by = case when _checked then staff end,
      quote_checked_at = case when _checked then now() end
  where id = _feedback;
end;
$$;

-- 3. Logging downloads -----------------------------------------------------------------------------------

-- Writes one audit row for a feedback download. Admins, PAs and doctors only.
create function private.log_feedback_export(_set text, _rows integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  role_held public.app_role;
begin
  if actor is null or not (private.has_role('admin') or private.has_role('pa') or private.has_role('doctor')) then
    raise exception 'You cannot download feedback.' using errcode = '42501';
  end if;
  if _set is null or _set not in ('evidence', 'all') or _rows is null or _rows < 0 then
    raise exception 'That download cannot be logged.' using errcode = '22023';
  end if;
  select r.role into role_held
  from public.user_roles r
  where r.user_id = actor and r.role in ('doctor', 'pa', 'admin')
  order by array_position(array['doctor', 'pa', 'admin']::public.app_role[], r.role)
  limit 1;
  insert into public.audit_log (actor_id, actor_role, action, entity, metadata)
  values (actor, role_held, 'exported', 'patient_feedback', jsonb_build_object('set', _set, 'rows', _rows));
end;
$$;

create function public.check_feedback_quote(_feedback uuid, _checked boolean)
returns void language sql security invoker set search_path = ''
as $$ select private.check_feedback_quote(_feedback, _checked); $$;
create function public.log_feedback_export(_set text, _rows integer)
returns void language sql security invoker set search_path = ''
as $$ select private.log_feedback_export(_set, _rows); $$;

revoke all on function
  private.easter_sunday(integer),
  private.is_bank_holiday(date),
  private.working_day_from(date),
  private.check_feedback_quote(uuid, boolean),
  private.log_feedback_export(text, integer),
  public.check_feedback_quote(uuid, boolean),
  public.log_feedback_export(text, integer)
from public, anon, authenticated;
grant execute on function
  private.check_feedback_quote(uuid, boolean),
  private.log_feedback_export(text, integer),
  public.check_feedback_quote(uuid, boolean),
  public.log_feedback_export(text, integer)
to authenticated;
