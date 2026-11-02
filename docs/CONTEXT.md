# Clinic Hub: technical context

Owned by the `context-keeper` subagent. The code is the truth; this document describes it. Last updated [2026-11].

## 1. Product summary

Clinic Hub is the patient and clinic portal pair for The Schoeman Clinic (hormone, longevity and functional medicine, London). The MVP is built around the bloods loop: order, Stripe payment and barcode, results by lab feed or PDF import with PA review, doctor review and release, then the patient sees the trend. GoHighLevel keeps messaging, reminders, tasks, calendar, invoices and marketing. Semble keeps consultation notes and prescribing for now.

## 2. Current status [2026-11]

| Phase | State |
|---|---|
| 1. Scaffold (Next.js and Supabase foundation) | Done, committed |
| 2. Design system (tokens and restyled shadcn components) | Done, committed |
| 3. Documentation (CLAUDE.md, subagents, reference files) | Done, committed |
| 4. Database (schema, row-level security, audit, storage, tests, seed) | Done, committed |
| 5. Authentication (sign-in, password reset, role routing) | Done, committed |
| 6. App shells and dashboards (patient `/portal`, clinic `/clinic`) | Built, **uncommitted** in the working tree: `app/clinic/`, `app/portal/`, `components/shell/`, `components/ui/order-steps.tsx`, `lib/data/`, `lib/format.ts`, `lib/results.ts` |
| Every screen behind the nav (results, orders, prescriptions, patient list, review queue, import queue and so on) | Not built; shown disabled with a "Coming soon" tooltip |
| Stripe, lab feeds, GoHighLevel and Semble sync, invitation sending, result release and import confirmation | Not built. The schema is ready for them; no server code writes to those tables yet |

Branch at time of writing: `feat/foundation`. The home page (`app/page.tsx`) redirects: signed-out to `/login`, staff to `/clinic`, patients and guardians to `/portal`.

## 3. Stack and versions

Checked against `package.json` and `pnpm-lock.yaml` [2026-11].

| Item | Version |
|---|---|
| Node | >=20.9.0 |
| pnpm | 10.33.0 |
| Next.js (App Router, `proxy.ts`) | 16.4.4 |
| React / React DOM | 19.3.1 |
| TypeScript (strict) | 5.9.3 |
| Tailwind CSS (v4, with `@tailwindcss/postcss`) | 4.3.3 |
| shadcn/ui primitives via `radix-ui` | 1.8.1 |
| `class-variance-authority`, `clsx`, `tailwind-merge` | 0.7.1, 2.1.1, 3.3.x |
| `lucide-react` | 1.66.x |
| `sonner` | 2.0.8 |
| `tw-animate-css` | 1.3.x |
| `@supabase/ssr` | 0.12.7 |
| `@supabase/supabase-js` | 2.118.0 |
| Supabase CLI | 2.122.0 |
| Resend | 6.37.x |
| Zod | 4.6.7 |

## 4. Database

14 migrations in `supabase/migrations/`, all committed. Postgres 17 (`major_version = 17`). 32 tables in `public`; `auth.users` is managed by Supabase Auth and only referenced. Every table has `created_at` [2026-11]. Types are generated into `lib/database.types.ts` with `pnpm db:types`.

### 4.1 Principles

- Row-level security is **enabled and forced** on every table in `public` (loop at the end of the integrations migration). No `FOR ALL` policies. Each table has **one permissive policy per command**, combining roles with OR, so the `multiple_permissive_policies` advisor stays quiet [2026-11].
- All new objects start closed: default privileges revoke everything from `public`, `anon` and `authenticated`. The grants migration then revokes and re-grants explicitly. `anon` holds nothing (there are no public pages). Column-level grants are used for insert and update.
- No `ON DELETE CASCADE` or `SET NULL` anywhere (every foreign key is `on delete restrict`, checked by a test). `authenticated` can delete only from `staff_locations` and `lab_panel_markers`. The service role has **no delete or truncate** on any clinical table, including `profiles`, `user_roles`, `webhook_events` and `integration_sync_log` [2026-11]. Clinical records are archived with `archived_at`; accounts are suspended through `profiles.status`.
- `webhook_events`, `integration_sync_log` and `audit_log` have no policies and no grants to `authenticated`: server only.
- Policies call helpers as `(select private.has_role('x'))` and `(select auth.uid())` so Postgres evaluates them once per statement. Policies that take a row value (`private.in_scope(patient_id)`, `can_act_for`, `document_gate_open`) are called directly.
- Every function sets `search_path`. No `SECURITY DEFINER` function exists in `public`; a test enforces it.
- Writes that must not come from a browser are made by server code with the service role (`lib/supabase/admin.ts`), after the server has checked who is asking. Several tables therefore have a select policy only.

### 4.2 Roles and access levels

`app_role` is `patient, doctor, pa, health_coach, admin`. There is **no guardian role** [2026-11]: a guardian holds no role and is defined by a verified `patient_guardians` row (`verified_by` not null) with `can_view` (and `can_act` to pay, request or ask). A person can hold more than one role (the seed has a doctor who is also a patient).

| Group | Roles | Helper |
|---|---|---|
| Clinical staff | doctor, PA, health coach | `private.is_clinical_staff()` |
| Team | doctor, PA, admin | `private.is_team()` |
| Admin | admin | `private.has_role('admin')` |

Admin is **deliberately not clinical**: an admin reads no patient record. The health coach reads **released results and documents only** and none of the team-only tables (care team, staff profiles, import queue, invitations, locations of staff). A staff role counts only while the person has an active, unarchived `staff_profiles` row and the account is not suspended, so offboarding takes effect immediately without editing roles. A patient role also needs a non-suspended account.

Access levels by table: own account (profiles, notification tables), patient record (clinical staff in scope plus the patient and verified guardians), team only, doctors only (safeguarding alerts; diagnoses and medications are doctor-written), reference (readable by anyone signed in, admin-written), server only.

### 4.3 Enums (`20261102111631_enums.sql`)

| Enum | Values |
|---|---|
| `app_role` | patient, doctor, pa, health_coach, admin |
| `account_status` | invited, active, suspended |
| `staff_role` | doctor, pa, health_coach, admin |
| `diagnosis_status` | active, monitoring, treating, under_investigation, resolved |
| `med_kind` | prescription, supplement |
| `med_status` | active, paused, stopped |
| `request_status` | requested, approved, sent_to_pharmacy, declined |
| `appt_status` | booked, confirmed, cancelled, completed, no_show |
| `doc_kind` | letter, lab_report, patient_upload, referral, other |
| `question_status` | awaiting_reply, answered, closed |
| `order_status` | sent_to_patient, paid, sample_taken, results_in, reviewed, cancelled |
| `report_status` | awaiting_review, reviewed, released |
| `result_flag` | normal, borderline, low, high, critical |
| `import_status` | needs_match, matched, confirmed, rejected |
| `notification_topic` | results, payments, appointments, messages |
| `notification_channel` | email, whatsapp, sms, portal |
| `location_kind` | clinic, video |
| `care_relationship` | primary_doctor, doctor, pa, health_coach |
| `guardian_relationship` | parent, carer, power_of_attorney |
| `consent_type` | care, partner_labs, research |
| `safeguarding_severity` | low, moderate, high |
| `appt_source` | ghl, semble |
| `document_source` | patient_upload, email, tdl, semble |
| `question_urgency` | routine, important |
| `results_channel` | api, email, upload |
| `import_confidence` | high, medium, low |
| `import_decision` | pending, confirmed, rejected |
| `webhook_source` | stripe, tdl, ghl, semble, fathom |
| `webhook_status` | received, processed, failed, ignored |
| `sync_system` | ghl, semble, stripe, tdl, fathom |
| `sync_direction` | in, out |
| `sync_status` | ok, failed, retrying |

The last 17 (from `notification_topic` onward) are extra enums for fixed lists that the draft left as text [2026-11].

### 4.4 Tables

`id` is `uuid primary key default gen_random_uuid()` unless stated. `created_at timestamptz not null default now()` exists on every table and is not repeated below. "Server" means written only by server code with the service role (no write policy for `authenticated`).

**Identity and accounts** (`20261102111657_identity_and_accounts.sql`)

- `profiles`: `id` (pk, fk `auth.users`), `full_name` (default ''), `email`, `phone`, `avatar_path`, `locale` ('en-GB'), `status account_status` ('invited'), `last_seen_at`, `updated_at`. Select: own or team. Update: own or admin, via trigger rules below. Created by the `on_auth_user_created` trigger.
- `user_roles`: pk `(user_id, role)`; `user_id` fk profiles; `role app_role`; `granted_by` fk profiles (check: not the person themselves); `granted_at`. Select: own or admin. Write: server.
- `invitations`: `email`, `role`, `patient_id` fk patient_profiles, `invited_by` fk staff_profiles, `token_hash` (check length >= 32), `expires_at` (check: within 14 days of creation), `accepted_at`. Unique pending invitation per `lower(email)`. Select: PA and admin, column grant excludes `token_hash`. **Created and accepted by server code only** [2026-11].
- `notification_preferences`: pk `(user_id, topic, channel)`; `enabled`; `updated_at`. Own select, insert, update (`enabled` only).
- `notifications`: `user_id`, `topic`, `title`, `body`, `link`, `read_at`. Own select; update `read_at` only. Created by the server.

**Team and sites** (`20261102111701_team_and_sites.sql`)

- `locations`: `name`, `kind location_kind`, `address`, `ghl_calendar_id`. Anyone signed in reads; admin writes.
- `staff_profiles`: `user_id` (unique, fk profiles), `job_title`, `clinical_role staff_role`, `gmc_number` (doctors only, check), `signature_path` (must start with own user id, check), `ghl_user_id`, `semble_user_id`, `active` (true), `archived_at`. Select: own or team. Insert and most updates: admin; a staff member may change only their own `signature_path`. Triggers lock `id`, `user_id`, `ghl_user_id`, `semble_user_id` from clients.
- `staff_locations`: pk `(staff_id, location_id)`; `is_primary`. Team reads; admin writes (including delete).
- `care_team`: `patient_id` fk, `staff_id` fk, `relationship care_relationship`, `since` (today), `until` (check >= since). Unique current primary doctor per patient. Team reads; PA and doctor write. Does not yet limit access (see `in_scope`).

**Patient record** (`20261102111704_patient_record.sql`)

- `patient_profiles`: `user_id` (unique, nullable until the invitation is accepted), `clinic_ref` (unique), `first_name`, `last_name`, `date_of_birth`, `sex`, `contact_email`, `contact_phone`, `country`, `primary_clinician_id` fk staff_profiles, `ghl_contact_id`, `semble_patient_id`, `stripe_customer_id`, `archived_at`, `updated_at`. Select: clinical staff in scope (so not admin). Patients and guardians read it through `get_my_patient_record()`, which omits external ids. Insert and update: PA. Trigger locks `id`, `user_id`, `clinic_ref` and the three external ids.
- `patient_guardians`: `patient_id`, `guardian_user_id` fk profiles, `relationship guardian_relationship`, `can_view` (true), `can_act` (false, check: act needs view), `verified_by` fk staff_profiles. Unique `(patient_id, guardian_user_id)`. Select: the guardian, the patient or staff in scope. Write: PA only; cannot link themselves; may verify only in their own name.
- `patient_allergies`: `patient_id`, `substance`, `reaction`, `severity` (text), `recorded_by` fk staff_profiles. Read: patient record level. Write: doctor and PA, `recorded_by` must be the writer.
- `consents`: `patient_id`, `consent_type`, `version`, `granted`, `changed_at`. Insert only (a change is a new row), by anyone who can act for the patient.
- `diagnoses`: `patient_id`, `icd10_code`, `label`, `status diagnosis_status` ('active'), `diagnosed_on`, `recorded_by`, `notes`, `archived_at`. Patients read unarchived ones. Doctors write.
- `safeguarding_alerts`: `patient_id`, `alert_type`, `severity`, `note`, `added_by`, `review_due`, `status` (text, 'active'). Doctors only, for read and write.
- `medications`: `patient_id`, `name`, `dose`, `instructions`, `kind med_kind`, `prescriber_id`, `pharmacy`, `start_date`, `supply_days` (check > 0), `status med_status` ('active'), `semble_prescription_id`, `archived_at`. Unique `(id, patient_id)` to back the composite key. Patients read unarchived ones. Doctors write. Trigger locks `id`, `patient_id`, `semble_prescription_id`.

**Care and requests** (`20261102111707_care_and_requests.sql`)

- `repeat_requests`: `medication_id`, `patient_id`, `requested_by` fk profiles, `note`, `fee_pence` (3000, check >= 0), `stripe_payment_intent_id`, `status request_status` ('requested'), `ghl_task_id`, `requested_at`, `resolved_at`. **Composite fk `(medication_id, patient_id)` to `medications (id, patient_id)`**, so the medication belongs to the same patient. Insert: someone who can act for the patient, or a PA; `requested_by` must be the caller. Update (`status`, `resolved_at`): PA and doctor.
- `appointments`: `patient_id`, `clinician_id`, `location_id`, `starts_at`, `duration_min` (check > 0), `type` (text), `status appt_status` ('booked'), `source appt_source`, `external_id`, `synced_at`. Unique `(source, external_id)`. Read: patient record level. No write policy: the sync writes. **No notes column.**
- `documents`: `patient_id` (**nullable** [2026-11]), `kind doc_kind`, `title`, `storage_path` (unique), `source document_source`, `uploaded_by` fk profiles, `shared_with_patient` (false), `shared_at`, `archived_at`. Unique `(id, patient_id)`. Check: the path starts with the patient id, or with `unmatched/` when `patient_id` is null. An emailed report is stored with no patient until matched; such a row is visible to **doctors and PAs only**. See the release gate below.
- `questions`: `patient_id`, `asked_by` fk profiles, `subject`, `body`, `urgency` ('routine'), `status question_status` ('awaiting_reply'), `ghl_conversation_id`, `answered_at`. Read: patient record level. Insert: someone who can act for the patient. Update (`status`, `answered_at`): team in scope.

**Labs and results** (`20261102111711_labs_and_results.sql`)

- `lab_partners`: `name`, `address`, `results_channel`, `api_enabled`. Reference.
- `lab_panels`: `lab_partner_id`, `code` (unique), `name`, `price_pence` (check >= 0), `fasting_required`, `preparation`, `active`, `archived_at`. Reference.
- `markers`: `code` (unique), `name`, `category`, `unit`, `ref_low`, `ref_high`, `explainer`. Reference.
- `lab_panel_markers`: pk `(panel_id, marker_id)`. Reference; admin can insert and delete.
- `lab_orders`: `order_ref` (unique), `patient_id`, `panel_id`, `lab_partner_id`, `ordered_by` fk staff_profiles, `appointment_id`, `due_by` (appointment minus 14 days), `price_pence`, `status order_status` ('sent_to_patient'), `barcode` (unique), `stripe_checkout_id`, `paid_at`, `sample_taken_at`. Read: patient record level. Insert and update: doctor and PA (`ordered_by` must be the writer). Triggers stop a client changing `order_ref`, `patient_id`, `barcode`, `stripe_checkout_id`, `paid_at`, and stop a client setting status to `paid`; the Stripe webhook does that.
- `lab_reports`: `patient_id`, `lab_order_id` (empty for overseas results), `lab_partner_id`, `external_lab_name`, `document_id`, `sample_date`, `received_at`, `status report_status` ('awaiting_review'), `reviewed_by`, `reviewed_at`, `released_at`, `patient_comment`. Check: `status = 'released'` exactly when `released_at` is set. Unique `(id, patient_id)`. **Composite fk `(document_id, patient_id)` to `documents (id, patient_id)`**. Server writes only.
- `result_imports`: `document_id` fk documents, `patient_id` (empty until matched), `lab_report_id` (created on confirm), `status import_status` ('needs_match'), `handled_by`, `received_at`. Read: doctor and PA. Update (`patient_id`, `status`, `handled_by`): doctor and PA, may match or reject but never set `confirmed`; matching is checked against the document's patient. Confirmation is server code.
- `results`: `lab_report_id`, `patient_id`, `marker_id`, `value_numeric`, `value_text` (check: one of them set), `unit`, `ref_low`, `ref_high`, `flag result_flag`, `doctor_comment`. **Composite fk `(lab_report_id, patient_id)` to `lab_reports (id, patient_id)`**. Update (`doctor_comment` only): doctor. Values are locked by trigger.
- `import_items`: `import_id`, `marker_id`, `raw_name`, `value` (text), `unit`, `ref_range_text`, `confidence`, `decision import_decision` ('pending'), `decided_by`. Read: doctor and PA. Update (`marker_id`, `decision`, `decided_by`): doctor and PA, `decided_by` must be the caller.

**Integrations and compliance** (`20261102111714_integrations_and_compliance.sql`)

- `webhook_events`: `source webhook_source`, `external_event_id`, `event_type`, `payload jsonb`, `status webhook_status` ('received'), `error`, `received_at`, `processed_at`. Unique `(source, external_event_id)` so a payment cannot be handled twice.
- `integration_sync_log`: `id bigint identity`, `system sync_system`, `direction`, `entity`, `entity_id`, `external_id`, `status sync_status`, `error`, `started_at`, `finished_at`.
- `audit_log`: `id bigint identity`, `actor_id` fk profiles (empty for system), `actor_role app_role`, `action`, `entity`, `entity_id`, `metadata jsonb`. Append-only (see triggers).

### 4.5 The release gate

Patients, guardians and the health coach see a result, a report or a lab PDF **only once the report is released**, and doctors and PAs see everything in scope. The gate rests on `lab_reports.released_at` and on composite foreign keys that make a result and a source PDF belong to the same patient as their report. `private.report_is_released(report_id)` guards `results`; `private.document_gate_open(document_id, kind)` guards `documents`: a patient's own upload is always visible, and any file used by an unreleased report stays hidden even if filed under another kind. A document is also visible to a patient only when `shared_with_patient` is true and it is not archived.

### 4.6 Helper functions (schema `private`)

All are `stable`, `SECURITY DEFINER` and `search_path = ''` unless noted; execute is granted to `authenticated` only. They are definer so that policies can read `user_roles` and `care_team` without recursing.

| Function | Purpose |
|---|---|
| `is_active_staff(uuid)` | Active, unarchived `staff_profiles` row |
| `has_role(app_role)` | Caller holds the role, is not suspended, and (for staff roles) is active staff |
| `is_clinical_staff()` | doctor, PA or health coach |
| `is_team()` | doctor, PA or admin |
| `my_patient_ids()` | Own unarchived patient record plus patients of verified guardian links with `can_view` |
| `is_own_patient(uuid)` | The record is the caller's own |
| `can_act_for(uuid)` | Own record, or verified guardian with `can_act` |
| `in_scope(uuid)` | May this staff member open this patient. **Open question**: returns true for any clinical staff member until the clinic decides whether staff see all patients or only their care team; limit it through `care_team` when decided |
| `my_staff_id()` | Caller's `staff_profiles.id`, so a write cannot be attributed to someone else |
| `report_is_released(uuid)`, `document_gate_open(uuid, doc_kind)` | The release gate |
| `storage_object_held_by_other(text)` | A file already exists at that path from another uploader |
| `try_uuid(text)` | Cast to uuid or null; `immutable`, not definer |
| `get_my_patient_record()`, `get_staff_directory()` | Definer bodies of the read functions |

### 4.7 Read functions (public API)

RLS filters rows, not columns, so patients get hidden-column data through functions. The `SECURITY DEFINER` body lives in `private`; `public.get_my_patient_record()` and `public.get_staff_directory()` are `SECURITY INVOKER` wrappers [2026-11], because the Supabase advisors warn on definer functions in an exposed schema. Execute is granted to `authenticated` only.

- `get_my_patient_record()` returns `id, clinic_ref, first_name, last_name, date_of_birth, sex, contact_email, contact_phone, country, primary_clinician_id, is_self, can_act` for the caller's own record and the records of patients they are a verified guardian of, own record first. No external ids.
- `get_staff_directory()` returns `staff_id, profile_id, full_name, job_title, clinical_role, avatar_path` for the active team. No GMC number, signature or external ids. It replaces the draft's `staff_directory` view and adds `profile_id` so a letter can name its author (`documents.uploaded_by` is a profile id).

### 4.8 Triggers

| Trigger | Function | Effect |
|---|---|---|
| `*_set_updated_at` on `profiles`, `notification_preferences`, `patient_profiles` | `private.set_updated_at` | Keeps `updated_at` |
| `on_auth_user_created` on `auth.users` | `private.handle_new_user` (definer) | Creates the `profiles` row; grants no role |
| `profiles_protect_columns` | `private.protect_profile_columns` | Client cannot change `id` or `email`; only an admin changes `status`; an admin cannot edit another person's details |
| `staff_profiles_protect_columns` | `private.protect_staff_columns` | Non-admins cannot change title, role, GMC number, `active`, `archived_at` |
| `*_reject_client_changes` on `staff_profiles`, `patient_profiles`, `medications`, `repeat_requests`, `documents`, `questions`, `lab_orders`, `result_imports`, `results` | `private.reject_client_changes(cols...)` | A second lock behind the column grants: `current_user = 'authenticated'` cannot change the named columns; service role and migrations are unaffected |
| `lab_orders_reject_client_paid_status` | `private.reject_client_paid_status` | A client cannot set an order to `paid` |
| `<table>_write_audit_log` on 27 tables | `private.write_audit_log` (definer) | Audits insert, update and delete |
| `audit_log_reject_update_delete`, `audit_log_reject_truncate` | `private.reject_audit_change` | `audit_log` is append-only, even for the service role |

Audited tables: every table except `notification_preferences`, `notifications`, `webhook_events`, `integration_sync_log` and `audit_log`.

**Audit rules** [2026-11]: for an update, `metadata` is `{"changed": [column names]}` and **never values**, because the table can never be erased and must not hold clinical data. The actor is `auth.uid()`; server code that acts for a person names them with `set_config('app.actor_id', '<profile id>', true)` in the same transaction. `actor_role` is the person's most specific role (staff over patient). Select-only "viewed" events are not written by triggers.

### 4.9 Storage

`20261102111728_storage.sql`. Both buckets are private; files are served through short-lived signed URLs. No delete policy on either bucket: files are not hard-deleted.

| Bucket | Limits | Path | Policies |
|---|---|---|---|
| `documents` | 25 MiB; pdf, jpeg, png, heic | `<patient id>/...`, or `unmatched/...` before matching | Select: anyone who can read the matching `documents` row under their own RLS. Insert: someone who can act for the patient, or a doctor or PA (for `unmatched/` or a patient in scope) |
| `avatars` | 2 MiB; jpeg, png, webp | `<user id>/...` | Select: own, any active staff member's, or team reads all. Insert and update: own folder only |

### 4.10 Extensions, schemas and API exposure

- `private` schema: usage granted to `authenticated` only, not exposed through the Data API; `anon` has nothing.
- `pg_graphql` is **dropped** and `graphql_public` is removed from the exposed schemas [2026-11]. `[api] schemas = ["public"]` in `supabase/config.toml`.
- pgTAP is created inside the tests.

### 4.11 Migration list

| File | Content |
|---|---|
| `20261102111410_schemas_and_extensions.sql` | `private` schema, drop `pg_graphql`, closed default privileges, `set_updated_at`, `reject_client_changes` |
| `20261102111631_enums.sql` | 32 enums |
| `20261102111657_identity_and_accounts.sql` | profiles, user_roles, invitations, notification tables, signup trigger |
| `20261102111701_team_and_sites.sql` | locations, staff_profiles, staff_locations, care_team |
| `20261102111704_patient_record.sql` | patient_profiles, guardians, allergies, consents, diagnoses, safeguarding, medications |
| `20261102111707_care_and_requests.sql` | repeat_requests, appointments, documents, questions |
| `20261102111711_labs_and_results.sql` | lab partners, panels, markers, panel markers, orders, reports, imports, results, import items |
| `20261102111714_integrations_and_compliance.sql` | webhook_events, integration_sync_log, audit_log; forces RLS on every table |
| `20261102111718_helper_functions.sql` | Permission helpers and release-gate functions |
| `20261102111720_rls_policies.sql` | All policies, plus the profile and staff column-protection triggers |
| `20261102111723_read_functions.sql` | `get_my_patient_record`, `get_staff_directory` (private body, public wrapper) |
| `20261102111725_audit_triggers.sql` | Audit trigger on 27 tables; append-only guards |
| `20261102111728_storage.sql` | Buckets and storage policies |
| `20261102111731_grants_hardening.sql` | Revokes, table and column grants, service role limits |

Create a new one with `supabase migration new <name> </dev/null`: the command hangs when stdin is not a terminal [2026-11].

### 4.12 Tests, seed and local commands

- `supabase/tests/00_schema_checks.test.sql` (pgTAP): table count, forced RLS, no `FOR ALL`, no cascades, no anon grants, delete grants, `search_path` on every function, no definer in `public`, and more.
- `supabase/tests/01_role_matrix.test.sql` (pgTAP): runs SQL as each seeded user the way PostgREST does and checks what each role can read and write.
- `supabase/seed.sql`: fictional data only, loaded by `db:reset`. **Local logins, their shared password and the account list are documented at the top of that file; refer to it, not here.** Seed dates are relative to the day of `db:reset` [2026-11], so the diary always has a today; reset again if it looks empty. Seed ids are fixed (users `a0...`, staff `b0...`, locations `c0...`, patients `d0...`).
- `package.json` scripts: `db:start`, `db:stop`, `db:reset`, `db:lint`, `db:test`, `db:types`, `db:advisors`.

### 4.13 Auth configuration (`supabase/config.toml`)

- `[auth] enable_signup = false`: public sign-up is off [2026-11].
- `[auth.email] enable_signup = true` **must stay true**: if it is false, email sign-in is disabled altogether [2026-11].
- Minimum password 12 characters, with lower case, upper case and digits; refresh-token rotation on; email confirmations off locally; anonymous sign-ins off; MFA off; the recovery email uses `supabase/templates/recovery.html`.
- Site URL `http://localhost:3000`.

### 4.14 Changes from `docs/reference/schema-draft.md` [2026-11]

1. `documents.patient_id` is nullable (emailed reports before matching; path `unmatched/`), and such rows are staff-only (doctor and PA) until matched.
2. Invitations are created only by server code. The draft says "PA, admin create", but the token must not be chosen by the inviter. Authenticated users can read invitations (PA and admin) without `token_hash`.
3. `created_at` added to every table; `archived_at` added as briefed (staff_profiles, patient_profiles, diagnoses, medications, documents, lab_panels).
4. Extra enums for fixed lists the draft left as text (17 of the 32).
5. Composite foreign keys: results to lab_reports, repeat_requests to medications, lab_reports to documents, so related rows always belong to the same patient.
6. `app_role` has no guardian.
7. Clinical staff, team and admin are defined as in 4.2; admin is deliberately not clinical; the health coach reads released data only and no team-only tables.
8. `pg_graphql` dropped; `graphql_public` removed from exposed schemas.
9. Read functions split into a private definer body and a public invoker wrapper; `get_staff_directory()` replaces the `staff_directory` view and returns `profile_id`.
10. One permissive policy per command per table.
11. Audit metadata stores changed column names only; `app.actor_id` for server code.
12. Service role has no delete or truncate on clinical tables.
13. Extra defences not in the draft: `reject_client_changes` triggers, the paid-status trigger, column-level grants, forced RLS, the 14-day invitation expiry, and the guardian-link rules (a PA cannot link or verify in someone else's name).

## 5. Architecture and file structure

| Path | State |
|---|---|
| `app/layout.tsx` | Built. `en-GB`, fonts, `TooltipProvider`, `Toaster`, `noindex` |
| `app/globals.css` | Built. Every design token and type utility |
| `app/dev/ui/` | Built. Component gallery |
| `app/fonts/` | Cormorant Garamond and Inter, self-hosted woff2 |
| `app/(auth)/` | Built. `login`, `forgot-password`, `update-password` (each a page plus a client form), shared layout |
| `app/auth/confirm/route.ts` | Built. Verifies emailed links (`token_hash` or `code`); `next` is checked against an allow-list |
| `app/portal/` | Built [2026-11], uncommitted. `layout.tsx` (routing guard, shell), `page.tsx` (home), `loading.tsx`, `error.tsx` |
| `app/clinic/` | Built [2026-11], uncommitted. Same four files; home reads `?location=` |
| `components/ui/` | Built. Restyled shadcn primitives and design-system components (alert-bar, status-pill, stat-card, sparkline, page-header, empty-state, demo-banner, wordmark and others; `order-steps` added in phase 6) |
| `components/shell/` | Built [2026-11], uncommitted: `app-shell`, `sidebar-content`, `nav` (unbuilt screens disabled via `coming-soon`), `mobile-nav`, `location-switcher`, `notifications-bell`, `user-menu` |
| `lib/supabase/` | `client.ts`, `server.ts`, `proxy.ts` (session refresh), `admin.ts` (service role, server only) |
| `lib/env.ts` | Lazy Zod validation of public, Supabase server and email variables |
| `lib/email/send.ts` | Resend wrapper |
| `lib/fonts.ts`, `lib/utils.ts` | Fonts; `cn` helper |
| `lib/auth/` | `session.ts` (`getCurrentUser`, `homePathFor`), `actions.ts` (server actions) |
| `lib/data/` | Built [2026-11], uncommitted. `portal.ts` (`getPortalHome`), `clinic.ts` (`getClinicHome`, `getClinicNavCounts`), `shell.ts` (notifications, locations). All read through the signed-in session |
| `lib/format.ts`, `lib/results.ts` | Built [2026-11], uncommitted. London-time date and money formatting, 14-day arithmetic; maps `result_flag` to the in_range, borderline, out_of_range pills |
| `lib/database.types.ts` | Generated by `pnpm db:types` |
| `proxy.ts` | Calls `updateSession`: refreshes the session with `getClaims()` and redirects signed-out visitors away from `/portal` and `/clinic` to `/login`. Row-level security is the real authorisation |
| `next.config.ts` | Security headers (HSTS, nosniff, referrer policy, frame denial, permissions policy) and a starter Content-Security-Policy |
| `supabase/` | `config.toml`, `migrations/` (14), `tests/` (2 pgTAP files), `seed.sql`, `templates/recovery.html`. See section 4 |
| `docs/reference/` | Schema draft, design system, prototype. Read only |

## 6. Routes, server actions and API routes

| Route | State |
|---|---|
| `/` | Redirects: signed-out to `/login`, staff to `/clinic`, patient or guardian to `/portal` |
| `/login`, `/forgot-password`, `/update-password` | Built (committed) |
| `/auth/confirm` | Route handler (GET), built |
| `/portal` | Built, uncommitted. Patient home |
| `/clinic` | Built, uncommitted. Clinic dashboard; optional `?location=<id>` |
| `/dev/ui` | Component gallery; `notFound()` when `NODE_ENV` is production |

Every other nav entry (patient: Lab orders, My results, Upload results, Prescriptions, Appointments, Ask the clinic, Letters and documents, Privacy and consent; clinic: Patient list, Results review, Import queue, Lab orders, Safeguarding alerts, Team and settings) is shown disabled with a "Coming soon" tooltip.

**Server actions** (`lib/auth/actions.ts`): `signIn` (email and password, Zod-checked, one message for every failure, signs out and shows "no access" if the account has no area), `requestPasswordReset` (same reply whether or not the account exists; redirects to `/auth/confirm?next=/update-password`), `updatePassword` (12+ characters, lower, upper, digit), `signOut`.

**Routing** (`lib/auth/session.ts`): `getCurrentUser` is cached per request and reads the profile, roles and `get_my_patient_record()`. `homePathFor`: suspended gives no area; any staff role gives `/clinic`; otherwise anyone with a patient record (patient or verified guardian) gives `/portal`. The `/portal` and `/clinic` layouts redirect anyone else. A person who is both (the seed doctor-patient) gets a switch link in the shell. These checks only route; row-level security decides what is readable.

**Patient home** (`getPortalHome`): bloods alert bar when an open order has a due date (as briefed), next appointment, bloods card (as in the prototype), new results card from the newest released report, up to four markers at a glance with sparklines (out of range first), latest shared letter with its author named through `get_staff_directory()`, and a running-low medication notice (14 days). Each query also filters to the patient and to released data itself, because a doctor who is also a patient is a clinical reader too.

**Clinic dashboard** (`getClinicHome`): today's count and next appointment, reports to review (and how many have an out-of-range value), imports waiting, an attention list (the marker that matters most per unreviewed report, with the previous released value), the diary for the day filtered by location, and "Bloods at risk" cards for appointments in the next 14 days with an open order. The location is chosen in the URL (`?location=`) by the top-bar switcher [2026-11], not by the prototype's chips. An admin sees no patient data (RLS); a health coach sees no unreleased results.

**API routes**: none besides `/auth/confirm`. Not built: Stripe, lab and sync webhooks, invitations.

## 7. Environment variables

From `.env.example` and `lib/env.ts`. `.env*.local` is ignored.

| Variable | Scope | Use |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL (local: `http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Publishable (anon) key |
| `NEXT_PUBLIC_DEMO` | Public, optional | `true` shows the demo banner |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Used only from `lib/supabase/admin.ts` |
| `RESEND_API_KEY` | Server only | Used only from `lib/email/send.ts` |
| `EMAIL_FROM` | Server only | Verified sender address |

## 8. Technical decisions

- [2026-11] Tailwind v4 rather than the template's v3, to match the brief.
- [2026-11] Default Tailwind palette, radii and shadows removed with `--color-*: initial` (and equivalents), so stray utilities generate nothing and only tokens exist.
- [2026-11] Utilities are named after tokens. shadcn's `--secondary` role is kept as `--secondary-role`; `secondary` is the bronze token.
- [2026-11] `cacheComponents: true` removed: all portal data is per-user and must not be cached.
- [2026-11] Colima is the local Docker runtime on this machine (Docker was not installed). `pnpm db:start` needs it running.
- [2026-11] Screens read through the signed-in user's session; the service role lives only in `lib/supabase/admin.ts`.
- [2026-11] No cascade deletes; clinical records archived with `archived_at`; accounts suspended through `profiles.status`.
- [2026-11] No remote Supabase project is linked or pushed to by agents.
- [2026-11] Row-level security does the authorisation; the server layouts and `proxy.ts` only route. All screens read through the signed-in session.
- [2026-11] Invitations, role grants, result release and import confirmation are server code only, so a client can never choose a token, a role or a release.
- [2026-11] Read functions use a private definer body and a public invoker wrapper, because the advisors warn on definer functions in an exposed schema.
- [2026-11] One permissive policy per command per table, combining roles with OR, to keep the `multiple_permissive_policies` advisor quiet.
- [2026-11] Audit stores changed column names only, never values; the log cannot be erased.
- [2026-11] `pg_graphql` dropped so table names are not discoverable through GraphQL.
- [2026-11] Clinic location is selected in the URL (`?location=`) by the top-bar switcher, so the server page reads it.
- [2026-11] The patient home shows the bloods alert bar as briefed as well as the prototype's bloods card.
- [2026-11] `supabase migration new` hangs without a terminal; use `</dev/null`.

## 9. Code conventions

- British English in code, comments, docs, UI copy and commits.
- TypeScript strict, no `any`.
- Tokens only: no raw colours, stray radii, shadows or gradients in JSX. Restyle in the component file with CVA variants.
- After every shadcn CLI run, confirm `cn` imports from `@/lib/utils` and no `cn` package appeared.
- One RLS policy per command, never `FOR ALL`, and one permissive policy per command per table; wrap `auth.uid()` and helper calls as `(select ...)`.
- Conventional Commits, one per logical change, on a branch.

## 10. Out of scope

Messaging, reminders, tasks, calendar, invoices and marketing (GoHighLevel); consultation notes and prescribing (Semble, for now).

## 11. Findings

1. [2026-11] The with-supabase template ships Tailwind v3; the brief expected v4. Upgraded to v4.
2. [2026-11] The shadcn CLI wrote `import { cn } from "cn"` and installed an unrelated npm package `cn`. Fixed to `@/lib/utils`; package removed.
3. [2026-11] The design-system README maps shadcn `--secondary` to surface-selected, but the tokens define `secondary` as bronze and the brief wants utilities named after tokens. Decision: the token wins; shadcn's role is `--secondary-role`.
4. [2026-11] The prototype sign-in uses a magic link; the brief says email and password. Brief wins for security and process.
5. [2026-11] The prototype sign-in panel uses a gradient; the design system and brief forbid gradients. Flat surface-inverse used.
6. [2026-11] The design-system README's generated index calls FilterChips a "square toggle", while the component README and brief say a rounded switch. Rounded switch used.
7. [2026-11] The Button README says six variants; the brief adds `link`, making seven.
8. [2026-11] The schema draft calls for a `staff_directory` view; the brief requires a `get_staff_directory()` function. Brief wins (security).
9. [2026-11] The template's `cacheComponents: true` was removed: all portal data is per-user and must not be cached.
10. [2026-11] `medications.start_date + supply_days` only models the first supply, so "days left" will be wrong after a repeat. The schema needs a last-supplied date. The patient home currently computes days left from `start_date`.
11. [2026-11] The prototype lists Eleanor in "Bloods at risk" with an appointment 20 days away, outside the 14-day window the brief and the prototype's own subtitle state. The app follows 14 days. By definition every at-risk appointment is already past its due date (appointment minus 14), so a "6 days left" card cannot occur.
12. [2026-11] `appointments` has no notes column, so the prototype's diary note line is replaced by the clinic reference.
13. [2026-11] The prototype diary has Sophie Marlow today and on a later date; the seed keeps both.
14. [2026-11] The prototype names staff such as "Dr Laura Bennett"; the seed uses those names. The health coach "Cecile" had no surname in the prototype, so the seed gives her the fictional surname Moreau.
15. [2026-11] `/portal` for a guardian of several patients shows the first only (own record first, then by name). A switcher is not built.
16. [2026-11] Local environment: Docker was absent, so Colima was installed with Homebrew. `pnpm db:start` needs it running.
17. [2026-11] The schema draft says "PA, admin create" invitations; the build creates them in server code only, because the token must not be chosen by the inviter.
18. [2026-11] The build departs from the schema draft in several places (view to function, extra enums, nullable `documents.patient_id` and others); the full list is in 4.14.
19. [2026-11] `private.in_scope()` is an open question: it admits any clinical staff member, so `care_team` does not yet limit access. `docs/SECURITY.md` S-10 tracks it.
20. [2026-11] Phase 6 files are uncommitted, so section 5 and 6 describe the working tree, not `HEAD`.
