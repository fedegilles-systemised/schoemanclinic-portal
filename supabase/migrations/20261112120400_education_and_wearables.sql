-- Education content and wearables (decided by the clinic on 11 November 2026, knowledge base
-- questions 21 and 30).
--
--   Education: admins build courses, each with sections, each with modules (text and an optional
--   video link). A course shows on a patient's portal once it is published and assigned to them.
--   Admins assign to anyone; doctors, nurses, PAs and health coaches assign to the patients they can
--   open. The library starts empty, ready for the clinic's own content.
--   Wearables: until the device APIs are connected, a patient (or a guardian who can act) types in
--   readings from their device. Staff who can open the record read them. Nothing is deleted; a
--   reading entered by mistake is archived by the person who entered it.

-- Education ----------------------------------------------------------------------------------

create table public.education_courses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (char_length(description) <= 4000),
  published boolean not null default false,
  created_by uuid not null references public.staff_profiles (id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.education_courses is 'A course in the education library. Patients see it only once published and assigned to them.';

create table public.education_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.education_courses (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  position integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.education_sections is 'A section of a course, in position order.';

create table public.education_modules (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.education_sections (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  body text check (char_length(body) <= 20000),
  video_url text check (video_url is null or (video_url ~ '^https://' and char_length(video_url) <= 2000)),
  position integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.education_modules is 'A lesson in a section: text and an optional video link (https only), in position order.';

create table public.education_assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.education_courses (id) on delete restrict,
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  assigned_by uuid not null references public.staff_profiles (id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.education_assignments is 'Which courses show on which patient''s portal. Archived to take a course away.';

create index education_sections_course_id_idx on public.education_sections (course_id, position);
create index education_modules_section_id_idx on public.education_modules (section_id, position);
create index education_courses_created_by_idx on public.education_courses (created_by);
create index education_assignments_course_id_idx on public.education_assignments (course_id);
create index education_assignments_patient_id_idx on public.education_assignments (patient_id);
create index education_assignments_assigned_by_idx on public.education_assignments (assigned_by);
create unique index education_assignments_one_live on public.education_assignments (course_id, patient_id) where archived_at is null;

-- Does this signed-in patient or guardian have this course on their portal?
create function private.course_is_mine(_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.education_assignments a
    join public.education_courses c on c.id = a.course_id
    where a.course_id = _course
      and a.archived_at is null
      and c.published
      and c.archived_at is null
      and a.patient_id in (select private.my_patient_ids())
  );
$$;
comment on function private.course_is_mine(uuid) is 'Is this published course assigned to a patient the signed-in person sees as patient or guardian?';

-- Wearables ----------------------------------------------------------------------------------

create type public.wearable_metric as enum (
  'sleep_minutes', 'sleep_score', 'readiness_score', 'resting_heart_rate', 'hrv_ms', 'steps',
  'active_minutes', 'weight_kg', 'body_fat_percent', 'vo2_max', 'spo2_percent', 'temperature_deviation_c'
);

create table public.wearable_readings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  metric public.wearable_metric not null,
  value numeric not null check (value > -1000000 and value < 1000000),
  measured_on date not null check (measured_on >= date '2000-01-01'),
  device text check (char_length(device) <= 80),
  entered_by uuid not null references public.profiles (id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.wearable_readings is 'Readings a patient types in from a wearable (Oura, Whoop, Garmin and so on) until the device APIs are connected.';
create index wearable_readings_patient_idx on public.wearable_readings (patient_id, metric, measured_on desc);
create index wearable_readings_entered_by_idx on public.wearable_readings (entered_by);

-- Shared plumbing ----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['education_courses', 'education_sections', 'education_modules', 'education_assignments', 'wearable_readings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.write_audit_log()', t || '_write_audit_log', t);
  end loop;
  foreach t in array array['education_courses', 'education_sections', 'education_modules'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', t || '_set_updated_at', t);
  end loop;
end;
$$;

revoke delete, truncate on public.education_courses, public.education_sections, public.education_modules,
  public.education_assignments, public.wearable_readings from service_role;

grant select on public.education_courses, public.education_sections, public.education_modules,
  public.education_assignments, public.wearable_readings to authenticated;
grant insert (title, description, published, created_by) on public.education_courses to authenticated;
grant update (title, description, published, archived_at) on public.education_courses to authenticated;
grant insert (course_id, title, position) on public.education_sections to authenticated;
grant update (title, position, archived_at) on public.education_sections to authenticated;
grant insert (section_id, title, body, video_url, position) on public.education_modules to authenticated;
grant update (title, body, video_url, position, archived_at) on public.education_modules to authenticated;
grant insert (course_id, patient_id, assigned_by) on public.education_assignments to authenticated;
grant update (archived_at) on public.education_assignments to authenticated;
grant insert (patient_id, metric, value, measured_on, device, entered_by) on public.wearable_readings to authenticated;
grant update (archived_at) on public.wearable_readings to authenticated;

-- Courses: staff read the whole library; patients read their own published courses; admins write.
create policy "Staff read the library and patients read their own courses" on public.education_courses
  for select to authenticated
  using ((select private.is_clinical_staff()) or (select private.has_role('admin')) or private.course_is_mine(id));
create policy "Admins add courses" on public.education_courses
  for insert to authenticated
  with check ((select private.has_role('admin')) and created_by = (select private.my_staff_id()));
create policy "Admins change courses" on public.education_courses
  for update to authenticated
  using ((select private.has_role('admin')))
  with check ((select private.has_role('admin')));

create policy "Staff read sections and patients read those of their courses" on public.education_sections
  for select to authenticated
  using (
    (select private.is_clinical_staff()) or (select private.has_role('admin'))
    or (archived_at is null and private.course_is_mine(course_id))
  );
create policy "Admins add sections" on public.education_sections
  for insert to authenticated with check ((select private.has_role('admin')));
create policy "Admins change sections" on public.education_sections
  for update to authenticated using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));

create policy "Staff read modules and patients read those of their courses" on public.education_modules
  for select to authenticated
  using (
    (select private.is_clinical_staff()) or (select private.has_role('admin'))
    or (archived_at is null and exists (
      select 1 from public.education_sections s
      where s.id = section_id and s.archived_at is null and private.course_is_mine(s.course_id)
    ))
  );
create policy "Admins add modules" on public.education_modules
  for insert to authenticated with check ((select private.has_role('admin')));
create policy "Admins change modules" on public.education_modules
  for update to authenticated using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));

-- Assignments: whoever can open the patient's record assigns; patients see their own.
create policy "Staff in scope and the patient read assignments" on public.education_assignments
  for select to authenticated
  using (private.in_scope(patient_id) or patient_id in (select private.my_patient_ids()));
create policy "Staff in scope assign courses" on public.education_assignments
  for insert to authenticated
  with check (private.in_scope(patient_id) and assigned_by = (select private.my_staff_id()));
create policy "Staff in scope take courses away" on public.education_assignments
  for update to authenticated
  using (private.in_scope(patient_id)) with check (private.in_scope(patient_id));

-- Wearables: the patient, or a guardian who can act, enters; staff in scope read.
create policy "Patients, guardians and staff in scope read wearable readings" on public.wearable_readings
  for select to authenticated
  using (
    (archived_at is null and patient_id in (select private.my_patient_ids()))
    or private.in_scope(patient_id)
  );
create policy "Patients and guardians who can act enter readings" on public.wearable_readings
  for insert to authenticated
  with check (private.can_act_for(patient_id) and entered_by = (select auth.uid()));
create policy "People archive readings they entered" on public.wearable_readings
  for update to authenticated
  using (entered_by = (select auth.uid()) and private.can_act_for(patient_id))
  with check (entered_by = (select auth.uid()) and private.can_act_for(patient_id));

revoke all on function private.course_is_mine(uuid) from public, anon;
grant execute on function private.course_is_mine(uuid) to authenticated;
