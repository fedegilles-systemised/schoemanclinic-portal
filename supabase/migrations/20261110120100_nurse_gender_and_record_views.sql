-- Three small changes agreed after reading the clinic's own email flow:
--   1. The nurse can be invited. Until the clinic says what a nurse may see, a nurse has no
--      patient access at all, like an admin: private.is_clinical_staff() is left as it was.
--   2. Gender identity is kept beside sex. `sex` is sex at birth and drives bloods and cycle guidance.
--   3. Who opened a patient's record is written to the audit log, and an admin can read the log.

-- 1. The nurse -------------------------------------------------------------------------

alter table public.invitations drop constraint invitations_kind_fields;
alter table public.invitations
  add constraint invitations_kind_fields check (
    (kind = 'patient' and role = 'patient' and patient_id is not null and relationship is null and can_act is null and job_title is null)
    or (kind = 'guardian' and role is null and patient_id is not null and relationship is not null and can_act is not null and job_title is null)
    or (kind = 'team' and role in ('doctor', 'pa', 'health_coach', 'nurse', 'admin') and patient_id is null and relationship is null and can_act is null)
  );

-- 2. Sex at birth and gender identity --------------------------------------------------

comment on column public.patient_profiles.sex is 'Sex at birth. It decides which blood panels and cycle guidance a patient gets. A missing value must stop those steps, never be guessed.';

alter table public.patient_profiles add column gender_identity text;
alter table public.patient_profiles
  add constraint patient_profiles_gender_identity_length check (gender_identity is null or char_length(gender_identity) <= 60);
comment on column public.patient_profiles.gender_identity is 'How the patient describes their gender, in their own words. Held beside sex at birth, never instead of it.';

grant insert (gender_identity) on public.patient_profiles to authenticated;
grant update (gender_identity) on public.patient_profiles to authenticated;

-- 3. Who opened a record ---------------------------------------------------------------

-- Written by server code when a staff member opens a patient's record. Only the tables listed here
-- may be named, so this cannot be used to put anything else in the log. Opening the same thing
-- again within ten minutes is not written twice.
create function private.log_record_view(_patient uuid, _entity text, _entity_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  role_held public.app_role;
  target uuid := coalesce(_entity_id, _patient);
begin
  if actor is null or not private.is_clinical_staff() or not private.in_scope(_patient) then
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
  where r.user_id = actor and r.role in ('doctor', 'pa', 'health_coach')
  order by array_position(array['doctor', 'pa', 'health_coach']::public.app_role[], r.role)
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
$$;

-- What an admin reads on the Activity screen: who did what, to which kind of record, for which
-- patient. Names only; the log never holds clinical values. Only the kinds of record on the fixed
-- list below are shown. Newest first, a page at a time.
create function private.activity_log(_limit integer default 50, _before bigint default null)
returns table (
  id bigint,
  created_at timestamptz,
  actor_name text,
  actor_role public.app_role,
  action text,
  entity text,
  patient_name text,
  patient_ref text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.has_role('admin')) then
    raise exception 'Only an admin can read the activity log.' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    a.created_at,
    p.full_name,
    a.actor_role,
    a.action,
    a.entity,
    pp.first_name || ' ' || pp.last_name,
    pp.clinic_ref
  from public.audit_log a
  left join public.profiles p on p.id = a.actor_id
  left join public.patient_profiles pp on pp.id = coalesce(
    private.try_uuid(a.metadata ->> 'patient_id'),
    case a.entity
      when 'patient_profiles' then a.entity_id
      when 'lab_reports' then (select l.patient_id from public.lab_reports l where l.id = a.entity_id)
      when 'results' then (select r.patient_id from public.results r where r.id = a.entity_id)
    end
  )
  where (_before is null or a.id < _before)
    -- A fixed list: an admin must not learn that a safeguarding alert, a diagnosis or a medicine exists.
    and a.entity in (
      'patient_profiles', 'lab_reports', 'results', 'lab_orders', 'documents',
      'result_imports', 'invitations', 'staff_profiles', 'user_roles', 'profiles'
    )
  order by a.id desc
  limit least(greatest(coalesce(_limit, 50), 1), 100);
end;
$$;

create function public.log_record_view(_patient uuid, _entity text, _entity_id uuid default null)
returns void language sql security invoker set search_path = ''
as $$ select private.log_record_view(_patient, _entity, _entity_id); $$;

create function public.activity_log(_limit integer default 50, _before bigint default null)
returns table (
  id bigint, created_at timestamptz, actor_name text, actor_role public.app_role,
  action text, entity text, patient_name text, patient_ref text
)
language sql stable security invoker set search_path = ''
as $$ select * from private.activity_log(_limit, _before); $$;

revoke all on function
  private.log_record_view(uuid, text, uuid),
  private.activity_log(integer, bigint),
  public.log_record_view(uuid, text, uuid),
  public.activity_log(integer, bigint)
from public, anon, authenticated;

grant execute on function
  private.log_record_view(uuid, text, uuid),
  private.activity_log(integer, bigint),
  public.log_record_view(uuid, text, uuid),
  public.activity_log(integer, bigint)
to authenticated;
