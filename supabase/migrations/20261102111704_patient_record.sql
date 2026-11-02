-- Patient record.

create table public.patient_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles (id) on delete restrict,
  clinic_ref text not null unique,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  sex text,
  contact_email text,
  contact_phone text,
  country text,
  primary_clinician_id uuid references public.staff_profiles (id) on delete restrict,
  ghl_contact_id text,
  semble_patient_id text,
  stripe_customer_id text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.patient_profiles is 'The clinical side of a patient and the centre of the record. A patient can exist before they have an account. Patients read their own row through get_my_patient_record(), which leaves out the external ids.';
comment on column public.patient_profiles.user_id is 'Empty until they accept the invitation. Set by server code only.';
comment on column public.patient_profiles.first_name is 'Legal name.';
comment on column public.patient_profiles.contact_email is 'For patients without an account.';
comment on column public.patient_profiles.ghl_contact_id is 'GoHighLevel contact: messages and chasers. Hidden from patients.';
comment on column public.patient_profiles.semble_patient_id is 'Semble patient. Hidden from patients.';
comment on column public.patient_profiles.stripe_customer_id is 'Stripe customer: saved card. Hidden from patients.';
create index patient_profiles_primary_clinician_id_idx on public.patient_profiles (primary_clinician_id);
create index patient_profiles_name_idx on public.patient_profiles (last_name, first_name);
create trigger patient_profiles_set_updated_at before update on public.patient_profiles
  for each row execute function private.set_updated_at();
create trigger patient_profiles_reject_client_changes before update on public.patient_profiles
  for each row execute function private.reject_client_changes('id', 'user_id', 'clinic_ref', 'ghl_contact_id', 'semble_patient_id', 'stripe_customer_id');

alter table public.invitations
  add constraint invitations_patient_id_fkey foreign key (patient_id) references public.patient_profiles (id) on delete restrict,
  add constraint invitations_invited_by_fkey foreign key (invited_by) references public.staff_profiles (id) on delete restrict;
alter table public.care_team
  add constraint care_team_patient_id_fkey foreign key (patient_id) references public.patient_profiles (id) on delete restrict;

create table public.patient_guardians (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  guardian_user_id uuid not null references public.profiles (id) on delete restrict,
  relationship public.guardian_relationship not null,
  can_view boolean not null default true,
  can_act boolean not null default false,
  verified_by uuid references public.staff_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint patient_guardians_unique unique (patient_id, guardian_user_id),
  constraint patient_guardians_act_needs_view check (not can_act or can_view)
);
comment on table public.patient_guardians is 'People who can see or manage a patient''s account. A link has no effect until the clinic verifies it.';
comment on column public.patient_guardians.can_act is 'Pay, request, ask.';
comment on column public.patient_guardians.verified_by is 'The staff member who verified the link. Empty means not verified.';
create index patient_guardians_guardian_user_id_idx on public.patient_guardians (guardian_user_id);
create index patient_guardians_verified_by_idx on public.patient_guardians (verified_by);

create table public.patient_allergies (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  substance text not null,
  reaction text,
  severity text,
  recorded_by uuid references public.staff_profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);
comment on table public.patient_allergies is 'Allergies shown in the record header and checked before prescribing.';
create index patient_allergies_patient_id_idx on public.patient_allergies (patient_id, created_at desc);
create index patient_allergies_recorded_by_idx on public.patient_allergies (recorded_by);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  consent_type public.consent_type not null,
  version text not null,
  granted boolean not null,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
comment on table public.consents is 'Every consent given or withdrawn, with the version of the wording. Insert only: a change is a new row.';
create index consents_patient_id_idx on public.consents (patient_id, changed_at desc);

create table public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  icd10_code text,
  label text not null,
  status public.diagnosis_status not null default 'active',
  diagnosed_on date,
  recorded_by uuid references public.staff_profiles (id) on delete restrict,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.diagnoses is 'Working diagnoses as structured data, for cohort searches.';
create index diagnoses_patient_id_idx on public.diagnoses (patient_id, diagnosed_on desc);
create index diagnoses_recorded_by_idx on public.diagnoses (recorded_by);
create index diagnoses_icd10_code_idx on public.diagnoses (icd10_code);

create table public.safeguarding_alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  alert_type text not null,
  severity public.safeguarding_severity not null,
  note text not null,
  added_by uuid references public.staff_profiles (id) on delete restrict,
  review_due date,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
comment on table public.safeguarding_alerts is 'Clinical warnings on a patient file. Doctors only: never patients, guardians or reception.';
create index safeguarding_alerts_patient_id_idx on public.safeguarding_alerts (patient_id, review_due);
create index safeguarding_alerts_added_by_idx on public.safeguarding_alerts (added_by);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  name text not null,
  dose text,
  instructions text,
  kind public.med_kind not null,
  prescriber_id uuid references public.staff_profiles (id) on delete restrict,
  pharmacy text,
  start_date date not null,
  supply_days integer not null,
  status public.med_status not null default 'active',
  semble_prescription_id text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint medications_supply_days_positive check (supply_days > 0),
  constraint medications_id_patient_unique unique (id, patient_id)
);
comment on table public.medications is 'Prescriptions and supplements, with supply length so the portal can warn when they run low. Filled from Semble in the MVP.';
comment on column public.medications.semble_prescription_id is 'Semble prescription. Written by the sync only.';
create index medications_patient_id_idx on public.medications (patient_id, start_date desc);
create index medications_prescriber_id_idx on public.medications (prescriber_id);
create trigger medications_reject_client_changes before update on public.medications
  for each row execute function private.reject_client_changes('id', 'patient_id', 'semble_prescription_id');
