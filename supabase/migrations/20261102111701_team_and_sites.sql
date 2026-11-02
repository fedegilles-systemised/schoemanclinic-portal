-- Team and sites.

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.location_kind not null,
  address text,
  ghl_calendar_id text,
  created_at timestamptz not null default now()
);
comment on table public.locations is 'The clinic sites patients can be seen at: Harley Street, Wimbledon and video.';
comment on column public.locations.ghl_calendar_id is 'GoHighLevel calendar this site books into.';

create table public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete restrict,
  job_title text,
  clinical_role public.staff_role not null,
  gmc_number text,
  signature_path text,
  ghl_user_id text,
  semble_user_id text,
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint staff_profiles_gmc_doctors_only check (gmc_number is null or clinical_role = 'doctor'),
  constraint staff_profiles_signature_is_own check (signature_path is null or split_part(signature_path, '/', 1) = user_id::text)
);
comment on table public.staff_profiles is 'The work side of a team member. Patients never read this table directly: they use get_staff_directory().';
comment on column public.staff_profiles.active is 'False, or archived_at set, ends every staff permission straight away.';
comment on column public.staff_profiles.gmc_number is 'Doctors only. Hidden from patients.';
comment on column public.staff_profiles.signature_path is 'Signature image for letters. Hidden from patients. The staff member may change their own.';
comment on column public.staff_profiles.ghl_user_id is 'GoHighLevel user, for assigning tasks.';
comment on column public.staff_profiles.semble_user_id is 'Semble user.';

create trigger staff_profiles_reject_client_changes before update on public.staff_profiles
  for each row execute function private.reject_client_changes('id', 'user_id', 'ghl_user_id', 'semble_user_id');

create table public.staff_locations (
  staff_id uuid not null references public.staff_profiles (id) on delete restrict,
  location_id uuid not null references public.locations (id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (staff_id, location_id)
);
comment on table public.staff_locations is 'Which sites each team member works at.';
create index staff_locations_location_id_idx on public.staff_locations (location_id);

-- care_team.patient_id gets its foreign key in the patient record migration.
create table public.care_team (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null,
  staff_id uuid not null references public.staff_profiles (id) on delete restrict,
  relationship public.care_relationship not null,
  since date not null default current_date,
  until date,
  created_at timestamptz not null default now(),
  constraint care_team_until_after_since check (until is null or until >= since)
);
comment on table public.care_team is 'Who looks after each patient. Will limit who can open a record once the clinic answers the access scope question.';
comment on column public.care_team.until is 'Empty while current.';
create unique index care_team_one_current_primary_doctor on public.care_team (patient_id)
  where relationship = 'primary_doctor' and until is null;
create index care_team_patient_id_idx on public.care_team (patient_id);
create index care_team_staff_id_idx on public.care_team (staff_id);
