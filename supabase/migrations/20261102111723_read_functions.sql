-- Read functions for hidden columns. RLS filters rows, not columns, so patients get
-- what they need through these, which return only the allowed columns.
-- The SECURITY DEFINER work is in private; the public wrappers are SECURITY INVOKER,
-- so the only callable definer code is not in an exposed schema.

create function private.get_my_patient_record()
returns table (
  id uuid,
  clinic_ref text,
  first_name text,
  last_name text,
  date_of_birth date,
  sex text,
  contact_email text,
  contact_phone text,
  country text,
  primary_clinician_id uuid,
  is_self boolean,
  can_act boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pp.id, pp.clinic_ref, pp.first_name, pp.last_name, pp.date_of_birth, pp.sex,
    pp.contact_email, pp.contact_phone, pp.country, pp.primary_clinician_id,
    pp.user_id is not distinct from (select auth.uid()) as is_self,
    private.can_act_for(pp.id) as can_act
  from public.patient_profiles pp
  where (select auth.uid()) is not null
    and pp.id in (select private.my_patient_ids())
  order by is_self desc, pp.last_name, pp.first_name;
$$;
comment on function private.get_my_patient_record() is 'The caller''s own patient record and those they are a verified guardian of, without external ids.';

create function public.get_my_patient_record()
returns table (
  id uuid,
  clinic_ref text,
  first_name text,
  last_name text,
  date_of_birth date,
  sex text,
  contact_email text,
  contact_phone text,
  country text,
  primary_clinician_id uuid,
  is_self boolean,
  can_act boolean
)
language sql
stable
set search_path = ''
as $$
  select * from private.get_my_patient_record();
$$;
comment on function public.get_my_patient_record() is 'What a patient or guardian may read of patient_profiles. Own record first.';

create function private.get_staff_directory()
returns table (
  staff_id uuid,
  profile_id uuid,
  full_name text,
  job_title text,
  clinical_role public.staff_role,
  avatar_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.user_id, p.full_name, s.job_title, s.clinical_role, p.avatar_path
  from public.staff_profiles s
  join public.profiles p on p.id = s.user_id
  where (select auth.uid()) is not null
    and s.active
    and s.archived_at is null
  order by p.full_name;
$$;
comment on function private.get_staff_directory() is 'Name, title and photo of the active team, without GMC number, signature or external ids.';

create function public.get_staff_directory()
returns table (
  staff_id uuid,
  profile_id uuid,
  full_name text,
  job_title text,
  clinical_role public.staff_role,
  avatar_path text
)
language sql
stable
set search_path = ''
as $$
  select * from private.get_staff_directory();
$$;
comment on function public.get_staff_directory() is 'What anyone signed in may read about the team: name, title and photo.';
