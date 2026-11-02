# Clinic Hub — schema draft (reference)

Source: the agreed first-draft data model (schema visualiser + "Clinic Hub Database Draft" doc). This is the starting point for the migrations, not a finished spec: names and columns can be refined, but every change must be recorded in docs/CONTEXT.md.

Flags: `pk` primary key · `fk:<table>` foreign key · `ext:<System>` id in an external system (GoHighLevel, Semble, Stripe, lab). `auth.users` is managed by Supabase Auth.

## Access levels (row-level security)

- **Own account** (`own`): Only the person themselves (team reads profiles)
- **Patient record** (`patient`): The patient, their verified guardians, and the clinical team
- **Team only** (`team`): Doctors, PAs and admins; never patients
- **Doctors only** (`doctors`): Doctors only
- **Reference** (`ref`): Anyone signed in; admins edit
- **Server only** (`server`): No signed-in user writes; admins read the logs

## Domain: Identity and accounts

### `auth.users`

Managed by Supabase Auth, not by us: email, password or magic link, sessions. We never write to it directly; a trigger creates the matching profiles row when someone signs up. In row-level security auth.uid() returns this id.

- Written by: Supabase Auth
- Read by: profiles (same id), every permission check via auth.uid()
- RLS level: **Server only** · Read: Managed by Supabase Auth · Write: Supabase Auth only

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk | auth.uid() in policies |
| `email` | `text` |  |  |
| `phone` | `text` |  |  |
| `last_sign_in_at` | `timestamptz` |  |  |
| `created_at` | `timestamptz` |  |  |

### `profiles`

One row for every person who can sign in: patients, doctors, PAs, health coach and admins. Shares its id with the Supabase Auth account.

- Written by: Sign-up and invitations, the person themselves
- Read by: Every screen (name, avatar, last seen), permissions
- RLS level: **Own account** · Read: Own row; team reads all · Write: Own row (name, phone, avatar, language); status by admin

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk fk:auth.users | Same id as the sign-in account: profiles.id = auth.users.id |
| `full_name` | `text` |  |  |
| `email` | `text` |  |  |
| `phone` | `text` |  |  |
| `avatar_path` | `text` |  | In Supabase Storage |
| `locale` | `text` |  | en-GB |
| `status` | `account_status` |  | invited, active, suspended |
| `last_seen_at` | `timestamptz` |  |  |
| `created_at` | `timestamptz` |  |  |
| `updated_at` | `timestamptz` |  |  |

### `user_roles`

Which roles each person has. A person can hold more than one, for example a doctor who is also a patient.

- Written by: Admin, invitations
- Read by: Permissions (row-level security)
- RLS level: **Own account** · Read: Own rows; admin all · Write: Admin, through a server function

| Column | Type | Flags | Note |
|---|---|---|---|
| `user_id` | `uuid` | pk fk:profiles |  |
| `role` | `app_role` | pk | patient, doctor, pa, health_coach, admin |
| `granted_by` | `uuid` | fk:profiles |  |
| `granted_at` | `timestamptz` |  |  |

### `invitations`

An invitation for a patient or team member to create their account. Sent by email through Resend.

- Written by: PA, admin
- Read by: Sign-up flow
- RLS level: **Team only** · Read: PA, admin · Write: PA, admin create; accepted through a server function using the token

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `email` | `text` |  |  |
| `role` | `app_role` |  |  |
| `patient_id` | `uuid` | fk:patient_profiles | When inviting a patient |
| `invited_by` | `uuid` | fk:staff_profiles |  |
| `token_hash` | `text` |  | Never the token itself |
| `expires_at` | `timestamptz` |  |  |
| `accepted_at` | `timestamptz` |  |  |
| `created_at` | `timestamptz` |  |  |

### `notification_preferences`

How each person wants to hear about each kind of event. GoHighLevel reads this before sending.

- Written by: The person
- Read by: GoHighLevel sends, portal settings
- RLS level: **Own account** · Read: Own rows · Write: Own rows

| Column | Type | Flags | Note |
|---|---|---|---|
| `user_id` | `uuid` | pk fk:profiles |  |
| `topic` | `text` | pk | results, payments, appointments, messages |
| `channel` | `text` | pk | email, whatsapp, sms, portal |
| `enabled` | `boolean` |  |  |
| `updated_at` | `timestamptz` |  |  |

### `notifications`

Alerts shown inside the portal, under the bell icon.

- Written by: System
- Read by: Both portals
- RLS level: **Own account** · Read: Own rows · Write: Mark own as read; created by the server

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `user_id` | `uuid` | fk:profiles |  |
| `topic` | `text` |  |  |
| `title` | `text` |  |  |
| `body` | `text` |  |  |
| `link` | `text` |  | Where it opens in the portal |
| `read_at` | `timestamptz` |  |  |
| `created_at` | `timestamptz` |  |  |

## Domain: Team and sites

### `locations`

The clinic sites patients can be seen at: Harley Street, Wimbledon and video.

- Written by: Admin
- Read by: Both portals, appointments
- RLS level: **Reference** · Read: Anyone signed in · Write: Admin

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `name` | `text` |  |  |
| `kind` | `text` |  | clinic or video |
| `address` | `text` |  |  |
| `ghl_calendar_id` | `text` | ext:GoHighLevel | Calendar this site books into |
| `created_at` | `timestamptz` |  |  |

### `staff_profiles`

The work side of a team member: clinical role, registration and the IDs that link them to GoHighLevel and Semble.

- Written by: Admin
- Read by: Clinic portal, permissions, letters
- RLS level: **Reference** · Read: Team: full row. Patients: staff_directory view (name, title, photo) · Write: Admin; own signature by the staff member

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `user_id` | `uuid` | fk:profiles |  |
| `job_title` | `text` |  | e.g. Medical Director |
| `clinical_role` | `staff_role` |  | doctor, pa, health_coach, admin |
| `gmc_number` | `text` |  | Doctors only |
| `signature_path` | `text` |  | For letters |
| `ghl_user_id` | `text` | ext:GoHighLevel | For assigning tasks |
| `semble_user_id` | `text` | ext:Semble |  |
| `active` | `boolean` |  |  |
| `created_at` | `timestamptz` |  |  |

### `staff_locations`

Which sites each team member works at. A doctor can work at both clinics and on video.

- Written by: Admin
- Read by: Diary filters, permissions
- RLS level: **Team only** · Read: Team · Write: Admin

| Column | Type | Flags | Note |
|---|---|---|---|
| `staff_id` | `uuid` | pk fk:staff_profiles |  |
| `location_id` | `uuid` | pk fk:locations |  |
| `is_primary` | `boolean` |  |  |

### `care_team`

Who looks after each patient. Used to show a doctor their own patients first and to limit who can open a record.

- Written by: PA, doctor
- Read by: Clinic portal, permissions
- RLS level: **Team only** · Read: Team · Write: PA, doctor

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `patient_id` | `uuid` | fk:patient_profiles |  |
| `staff_id` | `uuid` | fk:staff_profiles |  |
| `relationship` | `text` |  | primary_doctor, doctor, pa, health_coach |
| `since` | `date` |  |  |
| `until` | `date` |  | Empty while current |

## Domain: Patient record

### `patient_profiles`

The clinical side of a patient and the centre of the record: almost every clinical table links here. A patient can exist before they have an account (user_id empty).

- Written by: PA, sync from GoHighLevel
- Read by: Both portals
- RLS level: **Patient record** · Read: Patient and guardians (view without external IDs); team in scope · Write: PA; patient edits contact details through a server function

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `user_id` | `uuid` | fk:profiles | Empty until they accept the invitation |
| `clinic_ref` | `text` |  | e.g. SC-004821 |
| `first_name` | `text` |  | Legal name |
| `last_name` | `text` |  |  |
| `date_of_birth` | `date` |  |  |
| `sex` | `text` |  |  |
| `contact_email` | `text` |  | For patients without an account |
| `contact_phone` | `text` |  |  |
| `country` | `text` |  |  |
| `primary_clinician_id` | `uuid` | fk:staff_profiles |  |
| `ghl_contact_id` | `text` | ext:GoHighLevel | Messages and chasers |
| `semble_patient_id` | `text` | ext:Semble |  |
| `stripe_customer_id` | `text` | ext:Stripe | Saved card |
| `created_at` | `timestamptz` |  |  |
| `updated_at` | `timestamptz` |  |  |

### `patient_guardians`

People who can see or manage a patient’s account, such as a parent for an under-18. Verified by the clinic.

- Written by: PA
- Read by: Patient portal, permissions
- RLS level: **Patient record** · Read: The patient, the guardian (own links); team · Write: PA, after verifying

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `patient_id` | `uuid` | fk:patient_profiles |  |
| `guardian_user_id` | `uuid` | fk:profiles |  |
| `relationship` | `text` |  | parent, carer, power of attorney |
| `can_view` | `boolean` |  |  |
| `can_act` | `boolean` |  | Pay, request, ask |
| `verified_by` | `uuid` | fk:staff_profiles |  |
| `created_at` | `timestamptz` |  |  |

### `patient_allergies`

Allergies shown in the record header and checked before prescribing.

- Written by: Doctor, PA
- Read by: Clinic portal
- RLS level: **Patient record** · Read: Patient and guardians; team in scope · Write: Doctor, PA

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `patient_id` | `uuid` | fk:patient_profiles |  |
| `substance` | `text` |  |  |
| `reaction` | `text` |  |  |
| `severity` | `text` |  |  |
| `recorded_by` | `uuid` | fk:staff_profiles |  |
| `created_at` | `timestamptz` |  |  |

### `consents`

Every consent a patient gives or withdraws, with the version of the wording they agreed to.

- Written by: Patient
- Read by: Exports, compliance
- RLS level: **Patient record** · Read: Patient and guardians; team in scope · Write: Patient or guardian with can_act; insert only

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `patient_id` | `uuid` | fk:patient_profiles |  |
| `consent_type` | `text` |  | care, partner_labs, research |
| `version` | `text` |  |  |
| `granted` | `boolean` |  |  |
| `changed_at` | `timestamptz` |  |  |

### `diagnoses`

Working diagnoses as structured data, so the clinic can search cohorts such as type 2 diabetes with HbA1c above 42.

- Written by: Doctor
- Read by: Clinic portal, cohort search
- RLS level: **Patient record** · Read: Patient and guardians; team in scope · Write: Doctor

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `patient_id` | `uuid` | fk:patient_profiles |  |
| `icd10_code` | `text` |  | e.g. E11.9 |
| `label` | `text` |  |  |
| `status` | `diagnosis_status` |  | active, monitoring, treating, under_investigation, resolved |
| `diagnosed_on` | `date` |  |  |
| `recorded_by` | `uuid` | fk:staff_profiles |  |
| `notes` | `text` |  |  |
| `created_at` | `timestamptz` |  |  |

### `safeguarding_alerts`

Clinical warnings on a patient file. Visible to clinicians only, never to patients, guardians or reception.

- Written by: Doctor
- Read by: Doctors only
- RLS level: **Doctors only** · Read: Doctors only · Write: Doctors

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `patient_id` | `uuid` | fk:patient_profiles |  |
| `alert_type` | `text` |  |  |
| `severity` | `text` |  | low, moderate, high |
| `note` | `text` |  |  |
| `added_by` | `uuid` | fk:staff_profiles |  |
| `review_due` | `date` |  |  |
| `status` | `text` |  |  |
| `created_at` | `timestamptz` |  |  |

### `medications`

Prescriptions and supplements, with supply length so the portal can warn when they run low. Filled from Semble in the MVP.

- Written by: Doctor, sync from Semble
- Read by: Both portals
- RLS level: **Patient record** · Read: Patient and guardians; team in scope · Write: Doctor; Semble sync by the server

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `patient_id` | `uuid` | fk:patient_profiles |  |
| `name` | `text` |  |  |
| `dose` | `text` |  |  |
| `instructions` | `text` |  |  |
| `kind` | `med_kind` |  | prescription, supplement |
| `prescriber_id` | `uuid` | fk:staff_profiles |  |
| `pharmacy` | `text` |  |  |
| `start_date` | `date` |  |  |
| `supply_days` | `integer` |  |  |
| `status` | `med_status` |  | active, paused, stopped |
| `semble_prescription_id` | `text` | ext:Semble |  |
| `created_at` | `timestamptz` |  |  |

## Domain: Care and requests

### `repeat_requests`

A patient asking for a repeat prescription, the £30 payment, and its progress.

- Written by: Patient, PA
- Read by: Both portals, GoHighLevel task
- RLS level: **Patient record** · Read: Patient and guardians; team in scope · Write: Insert by patient or guardian with can_act; status by PA, doctor; payment by Stripe webhook

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `medication_id` | `uuid` | fk:medications |  |
| `patient_id` | `uuid` | fk:patient_profiles |  |
| `requested_by` | `uuid` | fk:profiles | Patient or guardian |
| `note` | `text` |  |  |
| `fee_pence` | `integer` |  | 3000 = £30.00 |
| `stripe_payment_intent_id` | `text` | ext:Stripe |  |
| `status` | `request_status` |  | requested, approved, sent_to_pharmacy, declined |
| `ghl_task_id` | `text` | ext:GoHighLevel |  |
| `requested_at` | `timestamptz` |  |  |
| `resolved_at` | `timestamptz` |  |  |

### `appointments`

A cached copy of bookings from GoHighLevel or Semble. The booking itself lives there; we keep it to show it and work out bloods due dates.

- Written by: Sync
- Read by: Both portals
- RLS level: **Patient record** · Read: Patient and guardians; team in scope · Write: Server sync only

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `patient_id` | `uuid` | fk:patient_profiles |  |
| `clinician_id` | `uuid` | fk:staff_profiles |  |
| `location_id` | `uuid` | fk:locations |  |
| `starts_at` | `timestamptz` |  |  |
| `duration_min` | `integer` |  |  |
| `type` | `text` |  |  |
| `status` | `appt_status` |  | booked, confirmed, cancelled, completed, no_show |
| `source` | `text` |  | ghl or semble |
| `external_id` | `text` | ext:GHL / Semble |  |
| `synced_at` | `timestamptz` |  |  |

### `documents`

Every file: letters, lab PDFs and patient uploads. The file itself sits in Supabase Storage; this row says where and who can see it.

- Written by: Patient, PA, doctor
- Read by: Both portals
- RLS level: **Patient record** · Read: Patient and guardians only where shared_with_patient; team in scope · Write: Patient or guardian uploads; team all kinds

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `patient_id` | `uuid` | fk:patient_profiles |  |
| `kind` | `doc_kind` |  | letter, lab_report, patient_upload, referral, other |
| `title` | `text` |  |  |
| `storage_path` | `text` |  | Path in Supabase Storage |
| `source` | `text` |  | patient_upload, email, tdl, semble |
| `uploaded_by` | `uuid` | fk:profiles | Patient, guardian or staff |
| `shared_with_patient` | `boolean` |  |  |
| `shared_at` | `timestamptz` |  |  |
| `created_at` | `timestamptz` |  |  |

### `questions`

Questions sent from Ask the clinic. Each one opens a conversation in GoHighLevel, where the team replies.

- Written by: Patient
- Read by: Patient portal, team in GoHighLevel
- RLS level: **Patient record** · Read: Patient and guardians; team in scope · Write: Insert by patient or guardian with can_act; status by team and GHL sync

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `patient_id` | `uuid` | fk:patient_profiles |  |
| `asked_by` | `uuid` | fk:profiles | Patient or guardian |
| `subject` | `text` |  |  |
| `body` | `text` |  |  |
| `urgency` | `text` |  | routine, important |
| `status` | `question_status` |  | awaiting_reply, answered, closed |
| `ghl_conversation_id` | `text` | ext:GoHighLevel |  |
| `created_at` | `timestamptz` |  |  |
| `answered_at` | `timestamptz` |  |  |

## Domain: Labs and results

### `lab_orders`

An order for one patient. It moves through sent, paid, sample taken, results in and reviewed. GoHighLevel chases it.

- Written by: Doctor, PA, Stripe
- Read by: Both portals, GoHighLevel chasers
- RLS level: **Patient record** · Read: Patient and guardians; team in scope · Write: Doctor, PA; payment and barcode by Stripe webhook

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `order_ref` | `text` |  | e.g. LO-2026-014 |
| `patient_id` | `uuid` | fk:patient_profiles |  |
| `panel_id` | `uuid` | fk:lab_panels |  |
| `lab_partner_id` | `uuid` | fk:lab_partners |  |
| `ordered_by` | `uuid` | fk:staff_profiles |  |
| `appointment_id` | `uuid` | fk:appointments | The visit the bloods are for |
| `due_by` | `date` |  | Appointment minus 14 days |
| `price_pence` | `integer` |  |  |
| `status` | `order_status` |  | sent_to_patient, paid, sample_taken, results_in, reviewed, cancelled |
| `barcode` | `text` |  | e.g. SCH-1000142 |
| `stripe_checkout_id` | `text` | ext:Stripe |  |
| `paid_at` | `timestamptz` |  |  |
| `sample_taken_at` | `timestamptz` |  |  |
| `created_at` | `timestamptz` |  |  |

### `lab_reports`

One set of results from one sample. A doctor reviews it and releases it; patients only see released reports.

- Written by: Lab feed, import, doctor
- Read by: Results review, patient results
- RLS level: **Patient record** · Read: Patient and guardians only when released_at is set; team in scope · Write: Server (lab feed, imports); release by a doctor through a server function

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `patient_id` | `uuid` | fk:patient_profiles |  |
| `lab_order_id` | `uuid` | fk:lab_orders | Empty for overseas results |
| `lab_partner_id` | `uuid` | fk:lab_partners |  |
| `external_lab_name` | `text` |  | For labs abroad |
| `document_id` | `uuid` | fk:documents | Source PDF |
| `sample_date` | `date` |  |  |
| `received_at` | `timestamptz` |  |  |
| `status` | `report_status` |  | awaiting_review, reviewed, released |
| `reviewed_by` | `uuid` | fk:staff_profiles |  |
| `reviewed_at` | `timestamptz` |  |  |
| `released_at` | `timestamptz` |  |  |
| `patient_comment` | `text` |  | Shown with the results |

### `result_imports`

A PDF that arrived by upload or email, waiting for a PA to match it to a patient and check the values.

- Written by: System, PA
- Read by: Import queue
- RLS level: **Team only** · Read: PA, doctor · Write: PA, doctor; created by the server

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `document_id` | `uuid` | fk:documents |  |
| `patient_id` | `uuid` | fk:patient_profiles | Empty until matched |
| `lab_report_id` | `uuid` | fk:lab_reports | Created on confirm |
| `status` | `import_status` |  | needs_match, matched, confirmed, rejected |
| `handled_by` | `uuid` | fk:staff_profiles |  |
| `received_at` | `timestamptz` |  |  |

### `results`

One value for one marker. The shared marker is what makes trends and searches work across labs.

- Written by: Lab feed, confirmed imports
- Read by: Both portals, charts, cohort search
- RLS level: **Patient record** · Read: Patient and guardians only when the report is released; team in scope; health coach released only · Write: Server; doctor_comment by a doctor

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `lab_report_id` | `uuid` | fk:lab_reports |  |
| `patient_id` | `uuid` | fk:patient_profiles |  |
| `marker_id` | `uuid` | fk:markers |  |
| `value_numeric` | `numeric` |  |  |
| `value_text` | `text` |  | For results like negative |
| `unit` | `text` |  |  |
| `ref_low` | `numeric` |  | The lab’s own range |
| `ref_high` | `numeric` |  |  |
| `flag` | `result_flag` |  | normal, borderline, low, high, critical |
| `doctor_comment` | `text` |  |  |
| `created_at` | `timestamptz` |  |  |

### `import_items`

Each value AI pulled out of an imported PDF, with how sure it is and the PA’s decision. Nothing reaches results without a confirm.

- Written by: AI extraction, PA
- Read by: Import queue
- RLS level: **Team only** · Read: PA, doctor · Write: Decision by PA, doctor; created by the server

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `import_id` | `uuid` | fk:result_imports |  |
| `marker_id` | `uuid` | fk:markers | Best match, may be empty |
| `raw_name` | `text` |  | As written on the report |
| `value` | `text` |  |  |
| `unit` | `text` |  |  |
| `ref_range_text` | `text` |  |  |
| `confidence` | `text` |  | high, medium, low |
| `decision` | `text` |  | pending, confirmed, rejected |
| `decided_by` | `uuid` | fk:staff_profiles |  |

### `markers`

Every biomarker once, with its unit, default range and a plain-English explanation for patients.

- Written by: Admin
- Read by: Results, charts, search
- RLS level: **Reference** · Read: Anyone signed in · Write: Admin

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `code` | `text` |  | e.g. HBA1C |
| `name` | `text` |  |  |
| `category` | `text` |  | Hormones, Metabolic, Thyroid… |
| `unit` | `text` |  |  |
| `ref_low` | `numeric` |  |  |
| `ref_high` | `numeric` |  |  |
| `explainer` | `text` |  |  |

### `lab_partners`

The labs the clinic works with and how their results arrive.

- Written by: Admin
- Read by: Order dialog, import
- RLS level: **Reference** · Read: Anyone signed in · Write: Admin

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `name` | `text` |  | TDL Pathology, The Doctors Laboratory… |
| `address` | `text` |  |  |
| `results_channel` | `text` |  | api, email or upload |
| `api_enabled` | `boolean` |  |  |
| `created_at` | `timestamptz` |  |  |

### `lab_panels`

The catalogue of panels a doctor can order, with price and preparation instructions.

- Written by: Admin
- Read by: Order dialog, patient order card
- RLS level: **Reference** · Read: Anyone signed in · Write: Admin

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `lab_partner_id` | `uuid` | fk:lab_partners |  |
| `code` | `text` |  | e.g. GS5 |
| `name` | `text` |  |  |
| `price_pence` | `integer` |  |  |
| `fasting_required` | `boolean` |  |  |
| `preparation` | `text` |  |  |
| `active` | `boolean` |  |  |

### `lab_panel_markers`

Which markers each panel includes. Used for the test list on an order.

- Written by: Admin
- Read by: Order card
- RLS level: **Reference** · Read: Anyone signed in · Write: Admin

| Column | Type | Flags | Note |
|---|---|---|---|
| `panel_id` | `uuid` | pk fk:lab_panels |  |
| `marker_id` | `uuid` | pk fk:markers |  |

## Domain: Integrations and compliance

### `webhook_events`

Every message pushed to us by Stripe, TDL or GoHighLevel, stored first and then processed. The unique event id stops a payment being handled twice.

- Written by: Webhook receiver
- Read by: Processing jobs, debugging
- RLS level: **Server only** · Read: Admin · Write: Server only

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `uuid` | pk |  |
| `source` | `text` |  | stripe, tdl, ghl, semble, fathom |
| `external_event_id` | `text` |  | Unique per source |
| `event_type` | `text` |  | e.g. checkout.session.completed |
| `payload` | `jsonb` |  |  |
| `status` | `text` |  | received, processed, failed, ignored |
| `error` | `text` |  |  |
| `received_at` | `timestamptz` |  |  |
| `processed_at` | `timestamptz` |  |  |

### `integration_sync_log`

Every time we read from or write to another system: what moved, when, and whether it worked. The basis for the API flows.

- Written by: Sync jobs
- Read by: Admin, support
- RLS level: **Server only** · Read: Admin · Write: Server only

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `bigint` | pk |  |
| `system` | `text` |  | ghl, semble, stripe, tdl, fathom |
| `direction` | `text` |  | in or out |
| `entity` | `text` |  | Our table |
| `entity_id` | `uuid` |  |  |
| `external_id` | `text` |  | Their id |
| `status` | `text` |  | ok, failed, retrying |
| `error` | `text` |  |  |
| `started_at` | `timestamptz` |  |  |
| `finished_at` | `timestamptz` |  |  |

### `audit_log`

A permanent record of who viewed or changed what. Rows can be added but never edited or deleted.

- Written by: Database triggers and server code
- Read by: Admin, CQC inspections
- RLS level: **Server only** · Read: Admin · Write: Triggers and server only; no update or delete

| Column | Type | Flags | Note |
|---|---|---|---|
| `id` | `bigint` | pk |  |
| `actor_id` | `uuid` | fk:profiles | Empty for system actions |
| `actor_role` | `app_role` |  |  |
| `action` | `text` |  | viewed, created, updated, released… |
| `entity` | `text` |  | Table name |
| `entity_id` | `uuid` |  |  |
| `metadata` | `jsonb` |  | What changed |
| `created_at` | `timestamptz` |  |  |
