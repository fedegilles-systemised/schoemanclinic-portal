-- The education builder and player, made to work like a course platform (George, 12 November 2026).
--
-- Courses gain a cover image. Lessons (education_modules) gain formatted content, written in an
-- editor and stored as a document of a fixed set of blocks, and a draft or published state: a
-- patient sees only published lessons. Lessons carry files (PDF handouts and images) in a private
-- bucket. Admins reorder sections and lessons, and move a lesson to another section, through one
-- function. Patients, and guardians who can act, mark lessons complete; the team on the patient's
-- care team sees their progress. Nothing is deleted: lessons, sections and files are archived.

-- Courses: a cover image ------------------------------------------------------------------------

alter table public.education_courses
  add column cover_path text,
  add constraint education_courses_cover_path check (
    cover_path is null
    or (split_part(cover_path, '/', 1) = 'courses' and split_part(cover_path, '/', 2) = id::text
        and cover_path ~ '^courses/[0-9a-f-]{36}/cover-[0-9a-f-]{36}\.(png|jpg)$')
  );
comment on column public.education_courses.cover_path is 'The cover image in the education bucket: courses/<course id>/cover-<random id>.<png|jpg>.';
grant update (cover_path) on public.education_courses to authenticated;

-- Lessons: formatted content and a draft state --------------------------------------------------------

alter table public.education_modules
  add column content jsonb check (content is null or (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 200000)),
  add column published boolean not null default true;
-- Lessons made before the builder count as published; every new lesson starts as a draft.
alter table public.education_modules alter column published set default false;
comment on column public.education_modules.content is 'The lesson text from the editor: a document of headings, paragraphs, lists, quotes and links, checked by the server before it is saved. Replaces body for new lessons.';
comment on column public.education_modules.published is 'A draft lesson is seen by the team only. New lessons start as drafts; lessons made before the builder count as published.';
grant insert (content, published) on public.education_modules to authenticated;
grant update (content, published) on public.education_modules to authenticated;

alter policy "Staff read modules and patients read those of their courses" on public.education_modules
  using (
    (select private.is_clinical_staff()) or (select private.has_role('admin'))
    or (archived_at is null and published and exists (
      select 1 from public.education_sections s
      where s.id = section_id and s.archived_at is null and private.course_is_mine(s.course_id)
    ))
  );

-- Can the signed-in person, as a patient or guardian, read this lesson? Published, not archived, in
-- a section and course they have been given.
create function private.lesson_is_mine(_module uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.education_modules m
    join public.education_sections s on s.id = m.section_id
    where m.id = _module and m.archived_at is null and m.published and s.archived_at is null
      and private.course_is_mine(s.course_id)
  );
$$;

-- Lesson files --------------------------------------------------------------------------------------

create table public.education_files (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.education_modules (id) on delete restrict,
  storage_path text not null unique check (
    split_part(storage_path, '/', 1) = 'files' and split_part(storage_path, '/', 2) = module_id::text
    and storage_path ~ '^files/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|png|jpg)$'
  ),
  file_name text not null check (char_length(btrim(file_name)) between 1 and 200),
  content_type text not null check (content_type in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes integer not null check (size_bytes between 1 and 20971520),
  created_by uuid not null references public.staff_profiles (id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.education_files is 'A file attached to a lesson (a PDF handout or an image), stored in the private education bucket. Archived, never deleted.';
create index education_files_module_idx on public.education_files (module_id) where archived_at is null;
create index education_files_created_by_idx on public.education_files (created_by);

create trigger education_files_write_audit_log after insert or update or delete on public.education_files
  for each row execute function private.write_audit_log();

alter table public.education_files enable row level security;
alter table public.education_files force row level security;
revoke all on table public.education_files from public, anon, authenticated;
revoke delete, truncate on public.education_files from service_role;
grant select on public.education_files to authenticated;
grant insert (module_id, storage_path, file_name, content_type, size_bytes, created_by) on public.education_files to authenticated;
grant update (archived_at) on public.education_files to authenticated;

create policy "Staff read lesson files and patients read those of their lessons" on public.education_files
  for select to authenticated
  using (
    (select private.is_clinical_staff()) or (select private.has_role('admin'))
    or (archived_at is null and private.lesson_is_mine(module_id))
  );
create policy "Admins add lesson files" on public.education_files
  for insert to authenticated
  with check ((select private.has_role('admin')) and created_by = (select private.my_staff_id()) and archived_at is null);
create policy "Admins archive lesson files" on public.education_files
  for update to authenticated
  using ((select private.has_role('admin')))
  with check ((select private.has_role('admin')));

-- Progress --------------------------------------------------------------------------------------------

create table public.education_progress (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  module_id uuid not null references public.education_modules (id) on delete restrict,
  completed_by uuid not null references public.profiles (id) on delete restrict,
  completed_at timestamptz not null default now(),
  constraint education_progress_unique unique (patient_id, module_id)
);
comment on table public.education_progress is 'A lesson a patient has completed, marked by the patient or a guardian who can act. Read by them and by staff who can open the record.';
create index education_progress_module_idx on public.education_progress (module_id);
create index education_progress_completed_by_idx on public.education_progress (completed_by);

create trigger education_progress_write_audit_log after insert or update or delete on public.education_progress
  for each row execute function private.write_audit_log();

alter table public.education_progress enable row level security;
alter table public.education_progress force row level security;
revoke all on table public.education_progress from public, anon, authenticated;
revoke update, delete, truncate on public.education_progress from service_role;
grant select on public.education_progress to authenticated;
grant insert (patient_id, module_id, completed_by) on public.education_progress to authenticated;

create policy "Patients, guardians and staff in scope read progress" on public.education_progress
  for select to authenticated
  using (patient_id in (select private.my_patient_ids()) or private.in_scope(patient_id));
create policy "Patients and guardians who can act complete lessons of courses given to them" on public.education_progress
  for insert to authenticated
  with check (
    private.can_act_for(patient_id)
    and completed_by = (select auth.uid())
    and exists (
      select 1
      from public.education_modules m
      join public.education_sections s on s.id = m.section_id
      join public.education_courses c on c.id = s.course_id
      join public.education_assignments a on a.course_id = c.id
      where m.id = module_id and m.archived_at is null and m.published and s.archived_at is null
        and c.published and c.archived_at is null
        and a.patient_id = education_progress.patient_id and a.archived_at is null
    )
  );

-- Reordering ------------------------------------------------------------------------------------------

-- An admin sets the order of a course's sections and of the lessons in each, and may move a lesson to
-- another section of the same course. _order is [{"section": uuid, "lessons": [uuid, ...]}, ...] and
-- must name every current section and lesson of the course exactly once.
create function private.reorder_course(_course uuid, _order jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry jsonb;
  lesson jsonb;
  section_index integer := 0;
  lesson_index integer;
  section_ids uuid[] := '{}';
  lesson_ids uuid[] := '{}';
  this_section uuid;
  this_lesson uuid;
begin
  if not (select private.has_role('admin')) then
    raise exception 'Only an admin can change a course.' using errcode = '42501';
  end if;
  if _order is null or jsonb_typeof(_order) <> 'array' or jsonb_array_length(_order) > 200 then
    raise exception 'That order is not valid.' using errcode = '22023';
  end if;

  for entry in select * from jsonb_array_elements(_order) loop
    this_section := private.try_uuid(entry ->> 'section');
    if this_section is null or jsonb_typeof(entry -> 'lessons') <> 'array' then
      raise exception 'That order is not valid.' using errcode = '22023';
    end if;
    section_ids := section_ids || this_section;
    for lesson in select * from jsonb_array_elements(entry -> 'lessons') loop
      this_lesson := private.try_uuid(lesson #>> '{}');
      if this_lesson is null then
        raise exception 'That order is not valid.' using errcode = '22023';
      end if;
      lesson_ids := lesson_ids || this_lesson;
    end loop;
  end loop;

  -- Every current section and lesson of the course, once each, and nothing else.
  if (select count(distinct x) from unnest(section_ids) x) <> cardinality(section_ids)
    or (select count(distinct x) from unnest(lesson_ids) x) <> cardinality(lesson_ids)
    or (select array_agg(s.id order by s.id) from public.education_sections s where s.course_id = _course and s.archived_at is null)
       is distinct from (select array_agg(x order by x) from unnest(section_ids) x)
    or coalesce((select array_agg(m.id order by m.id) from public.education_modules m
                 join public.education_sections s on s.id = m.section_id
                 where s.course_id = _course and s.archived_at is null and m.archived_at is null), '{}')
       is distinct from coalesce((select array_agg(x order by x) from unnest(lesson_ids) x), '{}')
  then
    raise exception 'The course has changed. Reload the page and try again.' using errcode = '40001';
  end if;

  for entry in select * from jsonb_array_elements(_order) loop
    this_section := (entry ->> 'section')::uuid;
    update public.education_sections set position = section_index where id = this_section and position is distinct from section_index;
    lesson_index := 0;
    for lesson in select * from jsonb_array_elements(entry -> 'lessons') loop
      update public.education_modules
      set position = lesson_index, section_id = this_section
      where id = (lesson #>> '{}')::uuid and (position is distinct from lesson_index or section_id is distinct from this_section);
      lesson_index := lesson_index + 1;
    end loop;
    section_index := section_index + 1;
  end loop;
end;
$$;

create function public.reorder_course(_course uuid, _order jsonb)
returns void language sql security invoker set search_path = ''
as $$ select private.reorder_course(_course, _order); $$;

revoke all on function private.lesson_is_mine(uuid), private.reorder_course(uuid, jsonb), public.reorder_course(uuid, jsonb)
  from public, anon, authenticated;
-- Row-level security calls lesson_is_mine for signed-in people.
grant execute on function private.lesson_is_mine(uuid) to authenticated;
grant execute on function private.reorder_course(uuid, jsonb), public.reorder_course(uuid, jsonb) to authenticated;

-- Storage: covers and lesson files in a private bucket -----------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('education', 'education', false, 20971520, array['application/pdf', 'image/png', 'image/jpeg']);

-- Who may read an object in the education bucket: staff, or a patient or guardian for the cover of a
-- course given to them or a file of a lesson they can read.
create function private.can_read_education_object(_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_clinical_staff()) or (select private.has_role('admin'))
    or (
      split_part(_name, '/', 1) = 'courses'
      and exists (
        select 1 from public.education_courses c
        where c.cover_path = _name and private.course_is_mine(c.id)
      )
    )
    or (
      split_part(_name, '/', 1) = 'files'
      and exists (
        select 1 from public.education_files f
        where f.storage_path = _name and f.archived_at is null and private.lesson_is_mine(f.module_id)
      )
    );
$$;
revoke all on function private.can_read_education_object(text) from public, anon, authenticated;
grant execute on function private.can_read_education_object(text) to authenticated;

create policy "Staff, and patients given the course, read education files" on storage.objects
  for select to authenticated
  using (bucket_id = 'education' and private.can_read_education_object(name));

create policy "Admins upload education files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'education'
    and (select private.has_role('admin'))
    and (
      name ~ '^courses/[0-9a-f-]{36}/cover-[0-9a-f-]{36}\.(png|jpg)$'
      or name ~ '^files/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|png|jpg)$'
    )
  );
-- No update or delete policy: a new cover or file is a new object, and the old one is kept.
