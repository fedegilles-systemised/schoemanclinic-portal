-- Who sees whose photo (knowledge base question 23, decided 11 November 2026).
--
--   Staff see the photos of the team, and of the patients they can open (PAs and admins: every
--   patient; doctors, nurses and health coaches: their care team's). Patients and guardians see
--   only their own photo: never staff photos, and the staff directory gives them no photo path.

alter policy "People read their own avatar, staff avatars, and the team reads all" on storage.objects
  using (
    bucket_id = 'avatars'
    and (
      split_part(name, '/', 1) = (select auth.uid())::text
      or (
        (select private.is_active_staff((select auth.uid())))
        and (
          private.is_active_staff(private.try_uuid(split_part(name, '/', 1)))
          or exists (
            select 1 from public.patient_profiles pp
            where pp.user_id = private.try_uuid(split_part(name, '/', 1))
              and private.in_scope(pp.id)
          )
        )
      )
    )
  );

create or replace function private.get_staff_directory()
returns table (staff_id uuid, profile_id uuid, full_name text, job_title text, clinical_role public.staff_role, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.user_id, p.full_name, s.job_title, s.clinical_role,
    -- Photos are for the team only.
    case when private.is_active_staff((select auth.uid())) then p.avatar_path end
  from public.staff_profiles s
  join public.profiles p on p.id = s.user_id
  where (select auth.uid()) is not null
    and s.active
    and s.archived_at is null
  order by p.full_name;
$$;
