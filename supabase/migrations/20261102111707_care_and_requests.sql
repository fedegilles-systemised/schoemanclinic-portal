-- Care and requests.

create table public.repeat_requests (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null,
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  note text,
  fee_pence integer not null default 3000,
  stripe_payment_intent_id text,
  status public.request_status not null default 'requested',
  ghl_task_id text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint repeat_requests_fee_not_negative check (fee_pence >= 0),
  -- The medication must belong to the same patient.
  constraint repeat_requests_medication_fkey foreign key (medication_id, patient_id)
    references public.medications (id, patient_id) on delete restrict
);
comment on table public.repeat_requests is 'A patient asking for a repeat prescription, the fee and its progress. Payment is written by the Stripe webhook.';
comment on column public.repeat_requests.fee_pence is '3000 = £30.00.';
comment on column public.repeat_requests.requested_by is 'Patient or guardian.';
create index repeat_requests_medication_id_idx on public.repeat_requests (medication_id, patient_id);
create index repeat_requests_patient_id_idx on public.repeat_requests (patient_id, requested_at desc);
create index repeat_requests_requested_by_idx on public.repeat_requests (requested_by);
create trigger repeat_requests_reject_client_changes before update on public.repeat_requests
  for each row execute function private.reject_client_changes('id', 'patient_id', 'medication_id', 'requested_by', 'fee_pence', 'stripe_payment_intent_id', 'ghl_task_id');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  clinician_id uuid references public.staff_profiles (id) on delete restrict,
  location_id uuid references public.locations (id) on delete restrict,
  starts_at timestamptz not null,
  duration_min integer not null,
  type text not null,
  status public.appt_status not null default 'booked',
  source public.appt_source not null,
  external_id text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  constraint appointments_duration_positive check (duration_min > 0),
  constraint appointments_source_external_unique unique (source, external_id)
);
comment on table public.appointments is 'A cached copy of bookings from GoHighLevel or Semble. The booking itself lives there. Written by the sync only.';
create index appointments_patient_id_idx on public.appointments (patient_id, starts_at);
create index appointments_clinician_id_idx on public.appointments (clinician_id, starts_at);
create index appointments_location_id_idx on public.appointments (location_id, starts_at);
create index appointments_starts_at_idx on public.appointments (starts_at);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patient_profiles (id) on delete restrict,
  kind public.doc_kind not null,
  title text not null,
  storage_path text not null unique,
  source public.document_source,
  uploaded_by uuid references public.profiles (id) on delete restrict,
  shared_with_patient boolean not null default false,
  shared_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint documents_id_patient_unique unique (id, patient_id),
  constraint documents_path_starts_with_patient check (
    (patient_id is not null and split_part(storage_path, '/', 1) = patient_id::text)
    or (patient_id is null and split_part(storage_path, '/', 1) = 'unmatched')
  )
);
comment on table public.documents is 'Every file: letters, lab PDFs and patient uploads. The file sits in Storage; this row says where and who can see it.';
comment on column public.documents.patient_id is 'Empty only for an emailed report waiting to be matched: such a row is visible to doctors and PAs alone.';
comment on column public.documents.storage_path is 'Path in the documents bucket. Starts with the patient id, or unmatched/ until matched.';
comment on column public.documents.shared_with_patient is 'Patients and guardians read a document only when this is true and, for a lab report, only once that report is released.';
create index documents_patient_id_idx on public.documents (patient_id, created_at desc);
create index documents_uploaded_by_idx on public.documents (uploaded_by);
create trigger documents_reject_client_changes before update on public.documents
  for each row execute function private.reject_client_changes('id', 'patient_id', 'kind', 'storage_path', 'uploaded_by');

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  asked_by uuid not null references public.profiles (id) on delete restrict,
  subject text not null,
  body text not null,
  urgency public.question_urgency not null default 'routine',
  status public.question_status not null default 'awaiting_reply',
  ghl_conversation_id text,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
comment on table public.questions is 'Questions from Ask the clinic. Each opens a conversation in GoHighLevel, where the team replies.';
comment on column public.questions.asked_by is 'Patient or guardian.';
create index questions_patient_id_idx on public.questions (patient_id, created_at desc);
create index questions_asked_by_idx on public.questions (asked_by);
create trigger questions_reject_client_changes before update on public.questions
  for each row execute function private.reject_client_changes('id', 'patient_id', 'asked_by', 'subject', 'body', 'ghl_conversation_id');
