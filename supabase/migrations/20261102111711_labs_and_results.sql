-- Labs and results.

create table public.lab_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  results_channel public.results_channel not null,
  api_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.lab_partners is 'The labs the clinic works with and how their results arrive.';

create table public.lab_panels (
  id uuid primary key default gen_random_uuid(),
  lab_partner_id uuid not null references public.lab_partners (id) on delete restrict,
  code text not null unique,
  name text not null,
  price_pence integer not null,
  fasting_required boolean not null default false,
  preparation text,
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint lab_panels_price_not_negative check (price_pence >= 0)
);
comment on table public.lab_panels is 'The catalogue of panels a doctor can order, with price and preparation instructions.';
create index lab_panels_lab_partner_id_idx on public.lab_panels (lab_partner_id);

create table public.markers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null,
  unit text,
  ref_low numeric,
  ref_high numeric,
  explainer text,
  created_at timestamptz not null default now()
);
comment on table public.markers is 'Every biomarker once, with its unit, default range and a plain-English explanation for patients.';

create table public.lab_panel_markers (
  panel_id uuid not null references public.lab_panels (id) on delete restrict,
  marker_id uuid not null references public.markers (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (panel_id, marker_id)
);
comment on table public.lab_panel_markers is 'Which markers each panel includes.';
create index lab_panel_markers_marker_id_idx on public.lab_panel_markers (marker_id);

create table public.lab_orders (
  id uuid primary key default gen_random_uuid(),
  order_ref text not null unique,
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  panel_id uuid not null references public.lab_panels (id) on delete restrict,
  lab_partner_id uuid not null references public.lab_partners (id) on delete restrict,
  ordered_by uuid not null references public.staff_profiles (id) on delete restrict,
  appointment_id uuid references public.appointments (id) on delete restrict,
  due_by date,
  price_pence integer not null,
  status public.order_status not null default 'sent_to_patient',
  barcode text unique,
  stripe_checkout_id text,
  paid_at timestamptz,
  sample_taken_at timestamptz,
  created_at timestamptz not null default now(),
  constraint lab_orders_price_not_negative check (price_pence >= 0)
);
comment on table public.lab_orders is 'An order for one patient. Moves through sent, paid, sample taken, results in and reviewed. Payment and barcode are written by the Stripe webhook.';
comment on column public.lab_orders.due_by is 'Appointment minus 14 days.';
create index lab_orders_patient_id_idx on public.lab_orders (patient_id, created_at desc);
create index lab_orders_panel_id_idx on public.lab_orders (panel_id);
create index lab_orders_lab_partner_id_idx on public.lab_orders (lab_partner_id);
create index lab_orders_ordered_by_idx on public.lab_orders (ordered_by);
create index lab_orders_appointment_id_idx on public.lab_orders (appointment_id);
create index lab_orders_status_idx on public.lab_orders (status);
create trigger lab_orders_reject_client_changes before update on public.lab_orders
  for each row execute function private.reject_client_changes('id', 'order_ref', 'patient_id', 'barcode', 'stripe_checkout_id', 'paid_at');

-- Only the Stripe webhook, through server code, can mark an order as paid.
create function private.reject_client_paid_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and new.status = 'paid' and old.status is distinct from 'paid' then
    raise exception 'An order is marked as paid by the Stripe webhook only.' using errcode = '42501';
  end if;
  return new;
end;
$$;
comment on function private.reject_client_paid_status() is 'Trigger: stops a signed-in user marking a lab order as paid.';
create trigger lab_orders_reject_client_paid_status before update on public.lab_orders
  for each row execute function private.reject_client_paid_status();

create table public.lab_reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  lab_order_id uuid references public.lab_orders (id) on delete restrict,
  lab_partner_id uuid references public.lab_partners (id) on delete restrict,
  external_lab_name text,
  document_id uuid,
  sample_date date,
  received_at timestamptz not null default now(),
  status public.report_status not null default 'awaiting_review',
  reviewed_by uuid references public.staff_profiles (id) on delete restrict,
  reviewed_at timestamptz,
  released_at timestamptz,
  patient_comment text,
  created_at timestamptz not null default now(),
  constraint lab_reports_released_matches_status check ((status = 'released') = (released_at is not null)),
  constraint lab_reports_id_patient_unique unique (id, patient_id),
  -- The source PDF must belong to the same patient, so the release gate holds.
  constraint lab_reports_document_fkey foreign key (document_id, patient_id)
    references public.documents (id, patient_id) on delete restrict
);
comment on table public.lab_reports is 'One set of results from one sample. A doctor reviews and releases it; patients only see released reports. Written by server code only.';
comment on column public.lab_reports.lab_order_id is 'Empty for overseas results.';
comment on column public.lab_reports.external_lab_name is 'For labs abroad.';
comment on column public.lab_reports.document_id is 'Source PDF.';
comment on column public.lab_reports.patient_comment is 'Shown with the results.';
create index lab_reports_patient_id_idx on public.lab_reports (patient_id, sample_date desc);
create index lab_reports_lab_order_id_idx on public.lab_reports (lab_order_id);
create index lab_reports_lab_partner_id_idx on public.lab_reports (lab_partner_id);
create index lab_reports_document_id_idx on public.lab_reports (document_id, patient_id);
create index lab_reports_reviewed_by_idx on public.lab_reports (reviewed_by);
create index lab_reports_status_idx on public.lab_reports (status);

create table public.result_imports (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete restrict,
  patient_id uuid references public.patient_profiles (id) on delete restrict,
  lab_report_id uuid references public.lab_reports (id) on delete restrict,
  status public.import_status not null default 'needs_match',
  handled_by uuid references public.staff_profiles (id) on delete restrict,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
comment on table public.result_imports is 'A PDF that arrived by upload or email, waiting for a PA to match it to a patient and check the values. Confirmation is done by server code.';
comment on column public.result_imports.patient_id is 'Empty until matched.';
comment on column public.result_imports.lab_report_id is 'Created on confirm.';
create index result_imports_document_id_idx on public.result_imports (document_id);
create index result_imports_patient_id_idx on public.result_imports (patient_id, received_at desc);
create index result_imports_lab_report_id_idx on public.result_imports (lab_report_id);
create index result_imports_handled_by_idx on public.result_imports (handled_by);
create index result_imports_status_idx on public.result_imports (status);
create trigger result_imports_reject_client_changes before update on public.result_imports
  for each row execute function private.reject_client_changes('id', 'document_id', 'lab_report_id');

create table public.results (
  id uuid primary key default gen_random_uuid(),
  lab_report_id uuid not null,
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  marker_id uuid not null references public.markers (id) on delete restrict,
  value_numeric numeric,
  value_text text,
  unit text,
  ref_low numeric,
  ref_high numeric,
  flag public.result_flag,
  doctor_comment text,
  created_at timestamptz not null default now(),
  constraint results_has_value check (value_numeric is not null or value_text is not null),
  -- A result can only hang off a report for the same patient, so the release gate holds.
  constraint results_lab_report_fkey foreign key (lab_report_id, patient_id)
    references public.lab_reports (id, patient_id) on delete restrict
);
comment on table public.results is 'One value for one marker. The shared marker is what makes trends and searches work across labs.';
comment on column public.results.value_text is 'For results like negative.';
comment on column public.results.ref_low is 'The lab''s own range.';
create index results_lab_report_id_idx on public.results (lab_report_id, patient_id);
create index results_patient_marker_idx on public.results (patient_id, marker_id);
create index results_marker_id_idx on public.results (marker_id);
create trigger results_reject_client_changes before update on public.results
  for each row execute function private.reject_client_changes('id', 'lab_report_id', 'patient_id', 'marker_id', 'value_numeric', 'value_text', 'unit', 'ref_low', 'ref_high', 'flag');

create table public.import_items (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.result_imports (id) on delete restrict,
  marker_id uuid references public.markers (id) on delete restrict,
  raw_name text not null,
  value text,
  unit text,
  ref_range_text text,
  confidence public.import_confidence not null,
  decision public.import_decision not null default 'pending',
  decided_by uuid references public.staff_profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);
comment on table public.import_items is 'Each value AI pulled out of an imported PDF, with how sure it is and the PA''s decision. Nothing reaches results without a confirm.';
comment on column public.import_items.marker_id is 'Best match, may be empty.';
comment on column public.import_items.raw_name is 'As written on the report.';
create index import_items_import_id_idx on public.import_items (import_id);
create index import_items_marker_id_idx on public.import_items (marker_id);
create index import_items_decided_by_idx on public.import_items (decided_by);
