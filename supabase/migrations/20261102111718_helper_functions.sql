-- Permission helpers. SECURITY DEFINER so they can read user_roles and care_team
-- without tripping the policies that call them. All are stable, with an empty search_path.
-- Execute is granted to authenticated only, in the grants migration.

-- Offboarding a team member takes effect here, without touching their roles.
create function private.is_active_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles s
    where s.user_id = _user_id and s.active and s.archived_at is null
  );
$$;
comment on function private.is_active_staff(uuid) is 'Has this person an active, unarchived staff profile? A staff role counts only with one.';

create function private.has_role(_role public.app_role)
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
      and r.role = _role
      and p.status <> 'suspended'
      and (_role = 'patient' or private.is_active_staff(r.user_id))
  );
$$;
comment on function private.has_role(public.app_role) is 'Does the signed-in person hold this role? Suspended accounts hold none, and a staff role needs an active staff profile.';

create function private.is_clinical_staff()
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
      and r.role in ('doctor', 'pa', 'health_coach')
      and p.status <> 'suspended'
      and private.is_active_staff(r.user_id)
  );
$$;
comment on function private.is_clinical_staff() is 'Doctor, PA or health coach: the clinical team of the draft''s Patient record level. Admins are not clinical staff.';

create function private.is_team()
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
      and r.role in ('doctor', 'pa', 'admin')
      and p.status <> 'suspended'
      and private.is_active_staff(r.user_id)
  );
$$;
comment on function private.is_team() is 'Doctor, PA or admin: the draft''s Team only level.';

create function private.my_patient_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pp.id
  from public.patient_profiles pp
  join public.profiles p on p.id = (select auth.uid()) and p.status <> 'suspended'
  where pp.user_id = p.id
    and pp.archived_at is null
  union
  select g.patient_id
  from public.patient_guardians g
  join public.profiles p on p.id = (select auth.uid()) and p.status <> 'suspended'
  join public.patient_profiles pp on pp.id = g.patient_id and pp.archived_at is null
  where g.guardian_user_id = p.id
    and g.can_view
    and g.verified_by is not null;
$$;
comment on function private.my_patient_ids() is 'The patients this person can see as a patient or a verified guardian with can_view.';

create function private.is_own_patient(_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.patient_profiles pp
    join public.profiles p on p.id = pp.user_id
    where pp.id = _patient_id
      and pp.user_id = (select auth.uid())
      and pp.archived_at is null
      and p.status <> 'suspended'
  );
$$;
comment on function private.is_own_patient(uuid) is 'Is this patient record the signed-in person''s own?';

create function private.can_act_for(_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_own_patient(_patient_id)
    or exists (
      select 1
      from public.patient_guardians g
      join public.profiles p on p.id = g.guardian_user_id
      join public.patient_profiles pp on pp.id = g.patient_id and pp.archived_at is null
      where g.patient_id = _patient_id
        and g.guardian_user_id = (select auth.uid())
        and g.can_act
        and g.verified_by is not null
        and p.status <> 'suspended'
    );
$$;
comment on function private.can_act_for(uuid) is 'Can this person pay, request or ask for this patient: the patient, or a verified guardian with can_act.';

-- OPEN QUESTION: the clinic has not yet decided whether staff see every patient or only
-- those on their care team. Until then this returns true for any clinical staff member.
-- When decided, limit it here through public.care_team, and add it to the write policies
-- that do not call it yet (see docs/SECURITY.md, S-10).
create function private.in_scope(_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _patient_id is not null and private.is_clinical_staff();
$$;
comment on function private.in_scope(uuid) is 'Can this staff member open this patient''s record? OPEN QUESTION: true for any clinical staff member until the clinic answers.';

create function private.my_staff_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.staff_profiles s
  join public.profiles p on p.id = s.user_id
  where s.user_id = (select auth.uid())
    and p.status <> 'suspended'
    and s.active
    and s.archived_at is null;
$$;
comment on function private.my_staff_id() is 'The signed-in person''s staff_profiles id, so a write cannot be attributed to someone else.';

create function private.report_is_released(_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lab_reports r
    where r.id = _report_id and r.released_at is not null
  );
$$;
comment on function private.report_is_released(uuid) is 'The release gate for results.';

-- The gate depends on the link to a report as well as the label: a lab PDF filed under
-- another kind stays hidden while any report using it is unreleased.
create function private.document_gate_open(_document_id uuid, _kind public.doc_kind)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _kind = 'patient_upload'
    or (
      not exists (
        select 1 from public.lab_reports r
        where r.document_id = _document_id and r.released_at is null
      )
      and (
        _kind <> 'lab_report'
        or exists (
          select 1 from public.lab_reports r
          where r.document_id = _document_id and r.released_at is not null
        )
      )
    );
$$;
comment on function private.document_gate_open(uuid, public.doc_kind) is 'The release gate for files. Definer rights, because a patient cannot see the unreleased report it must check. A patient''s own upload is always theirs to see.';

-- A patient registers only a file they uploaded themselves. Without this they could claim
-- someone else's file, or create a row first and read whatever lands at that path later.
create function private.storage_object_is_mine(_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from storage.objects o
    where o.bucket_id = 'documents'
      and o.name = _path
      and o.owner_id = (select auth.uid())::text
  );
$$;
comment on function private.storage_object_is_mine(text) is 'Has the signed-in person already uploaded the file at this path?';

-- Casts a storage path segment to a uuid without raising on junk.
create function private.try_uuid(_value text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when _value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then _value::uuid
  end;
$$;
comment on function private.try_uuid(text) is 'Returns the uuid in this text, or null.';
