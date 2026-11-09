# Clinic Hub: technical context

Owned by the `context-keeper` subagent. The code is the truth; this document describes it. Last updated [2026-11]. Latest change: knowledge base second tab, `/knowledge-base/test-results` (uncommitted, no migration) [2026-11]. Before that, invitation identity (uncommitted): migration `20261105130000_invitation_identity.sql`, date of birth at acceptance. Before that, invitations (uncommitted): migration `20261105120000_invitations.sql`, the `/invite` link and accept page, the `/clinic/team` screen and four server-side invitation actions, after the Profile screens and the knowledge base (also uncommitted).

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
| 6. App shells and dashboards (patient `/portal`, clinic `/clinic`) | Done, committed |
| Session limits and attempt limits (`private.auth_throttle`, `lib/auth/throttle.ts`, `lib/supabase/session-cookies.ts`, `/login?error=expired`, no browser Supabase client), signed session cookies and `SessionGuard`, a per-request Content-Security-Policy with a nonce, and the scope and audit-actor migration | Built, **uncommitted** in the working tree. The two new migrations are not on the hosted project yet |
| Email templates in the design system's look (five sign-in service emails built to `supabase/templates/`, three Resend emails in `lib/email/templates/app.ts`), `SITE_URL`, and the `email:*` scripts | Built, **uncommitted**. `invitationEmail` and `resultReadyEmail` are wired (invitations, result release); `guardianAccessEmail` is not. Verified locally only: the four sign-in emails through the local Auth service and Mailpit. Not verified: any real Resend send, Outlook, Gmail or Apple Mail rendering, the hosted Auth set-up |
| Profile screens for every role (`/portal/profile`, `/clinic/profile`): details, photo, notifications, sign-in security, a read-only record or work profile, and a doctor's signature, with the profile-email trigger and the `signatures` bucket | Built, **uncommitted**. Verified locally on a production build of a copy of the tree (forms, uploads, password and email change, both confirmation emails, layout at 375px) and attacked in the ninth security review (`docs/SECURITY.md`). Not checked: tablet widths, dark mode, any hosted behaviour |
| Invitations: who invites whom, the emailed link, accepting by creating an account or by signing in, and the Team screen at `/clinic/team` (`20261105120000_invitations.sql`, `lib/invitations/`, `app/(auth)/invite/`, `components/invite/`, `components/team/`) | Built, **uncommitted**. Verified locally on a production build of a copy of the tree: every path (patient, guardian, team; new account and existing account; expired, cancelled, used and unknown links), attacks in `docs/SECURITY.md` (tenth run). Not verified: any real email through Resend, tablet and mobile layouts, Safari and Firefox, the accept page under a very slow network |
| Results without AI: a PA or doctor enters values from a PDF or paper report (database converts units and flags), a doctor comments and releases, the patient sees released markers and trends; staff, patients and guardians can queue a file (`20261109120000_results_entry_and_release.sql`, `lib/results/`, `lib/data/results.ts`, `components/results/`, `app/clinic/results/`, `app/portal/results/`) | Built, **uncommitted**. Not built: patient-side file upload screen (the "Upload results" nav item is still disabled, though `register_import` allows it), PDF parsing, lab feeds, matching an `unmatched/` file to a patient from the UI. Not yet reviewed in `docs/SECURITY.md` |
| Every other screen behind the nav (orders, prescriptions, patient list and so on) | Not built; shown disabled with a "Coming soon" tooltip |
| Stripe, lab feeds, GoHighLevel and Semble sync | Not built. The schema is ready for them; no server code writes to those tables yet |

The default branch is `main`, and the working tree above is on it. The home page (`app/page.tsx`) redirects: signed-out to `/login`, staff to `/clinic`, patients and guardians to `/portal`.

**Waiting on a human:**
- `20261105120000_invitations.sql` must be pushed to the hosted project, before the code that uses it [2026-11]. It alters the live `invitations` table (new columns and checks, a changed unique index and read policy), adds an enum and functions, and the Team screen and accept page fail without it. Then set `SITE_URL`, `RESEND_API_KEY`, `EMAIL_FROM` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel, or an invitation is saved but no email goes out (the screen says so), and a released result tells the patient in the portal only (the doctor is told). Do a real end-to-end test of an invitation email (`docs/SECURITY.md` checklist). The seed's two demo invitations are for the local stack only.
- `20261104120000_profile_email_sync.sql`, `20261104120100_signatures_bucket.sql` and `20261104120200_profile_limits_and_avatar_path.sql` must be pushed too [2026-11]. Until the third, the hosted database has no name or phone limits and the avatar policies take any file name in the folder. Until the first, `profiles.email` does not follow a confirmed email change on the hosted project; until the second, a doctor's signature upload fails there (no `signatures` bucket). Both are applied by a human with the other migrations. The hosted Auth set-up for emails also matters: the email-change email, the password-changed notification and the email-changed notice to the old address, which must be switched on in the dashboard with `supabase/templates/email_changed_notification.html` (`docs/SECURITY.md` S-68).
- `20261102143000_auth_throttle.sql` and `20261102150000_scope_and_audit_actor.sql` must be pushed to the hosted project. Until the first, `public.auth_throttle_hit` does not exist there, so `lib/auth/throttle.ts` fails open and logs an error on every attempt: sign-in and reset work, with no attempt limits. See section 7 for the environments.
- `SESSION_COOKIE_SECRET` must be set in Vercel and in `.env.local`. Without it the proxy cannot read or sign the `ch_` cookies and fails closed (section 5), so no signed-in page loads.
- Email set-up, all manual and none done [2026-11]: confirm the sending domain's spelling (`.env.example` uses `schoemanclinic.systemizedtoscale.com`; the owner's own domain is spelled `systemisedtoscale` with an s, so the owner must confirm which one DNS uses); add and verify the domain in Resend (SPF, DKIM, DMARC records); create a Resend API key limited to sending on that domain; set `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL` and optionally `EMAIL_REPLY_TO` in Vercel as server-only variables; in the Supabase dashboard set custom SMTP (Resend), the Site URL and redirect allow-list to the domain, and paste the five templates and subjects from `supabase/templates/` (recovery, email change, reauthentication, password changed, and email changed, with both notifications on); run `pnpm email:test` to the owner's own address; check the logo URL `${SITE_URL}/brand/schoemanClinic-logo.png` loads in production.

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
| `class-variance-authority`, `clsx`, `tailwind-merge` | 0.7.1, 2.1.1, 3.7.0 |
| `lucide-react` | 1.66.x |
| `sonner` | 2.0.8 |
| `tw-animate-css` | 1.4.0 |
| `@supabase/ssr` | 0.12.7 |
| `@supabase/supabase-js` | 2.118.0 |
| `@vercel/analytics`, `@vercel/speed-insights` | 2.0.1, 2.0.0 (uncommitted) [2026-11] |
| `react-markdown`, `remark-gfm` | 10.1.0, 4.0.1 (uncommitted). Raw HTML is not enabled [2026-11] |
| Supabase CLI | 2.122.0 |
| Resend | 6.37.x |
| Zod | 4.6.7 |

## 4. Database

22 migrations in `supabase/migrations/`: 14 committed, and `20261109120000_results_entry_and_release.sql` (results entry and release) plus `20261102143000_auth_throttle.sql`, `20261102150000_scope_and_audit_actor.sql`, `20261104120000_profile_email_sync.sql`, `20261104120100_signatures_bucket.sql` and `20261104120200_profile_limits_and_avatar_path.sql` `20261105120000_invitations.sql` and `20261105130000_invitation_identity.sql` uncommitted [2026-11]. Postgres 17 (`major_version = 17`). 33 tables in `public`, plus `private.auth_throttle` (see 4.15); `auth.users` is managed by Supabase Auth and only referenced. Every table has `created_at` [2026-11]. Types are generated into `lib/database.types.ts` with `pnpm db:types`.

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
| `document_source` | patient_upload, email, tdl, semble, staff_upload (added in `20261109120000` [2026-11]) |
| `question_urgency` | routine, important |
| `results_channel` | api, email, upload |
| `import_confidence` | high, medium, low |
| `import_decision` | pending, confirmed, rejected |
| `webhook_source` | stripe, tdl, ghl, semble, fathom |
| `webhook_status` | received, processed, failed, ignored |
| `sync_system` | ghl, semble, stripe, tdl, fathom |
| `sync_direction` | in, out |
| `sync_status` | ok, failed, retrying |
| `invitation_kind` | patient, guardian, team (made in `20261105120000_invitations.sql`, so 33 enums in all) [2026-11] |

The last 17 (from `notification_topic` onward) are extra enums for fixed lists that the draft left as text [2026-11].

### 4.4 Tables

`id` is `uuid primary key default gen_random_uuid()` unless stated. `created_at timestamptz not null default now()` exists on every table and is not repeated below. "Server" means written only by server code with the service role (no write policy for `authenticated`).

**Identity and accounts** (`20261102111657_identity_and_accounts.sql`)

- `profiles`: `id` (pk, fk `auth.users`), `full_name` (default ''), `email`, `phone`, `avatar_path`, `locale` ('en-GB'), `status account_status` ('invited'), `last_seen_at`, `updated_at`. Select: own or team. Update: own or admin, via trigger rules below. Created by the `on_auth_user_created` trigger.
- `user_roles`: pk `(user_id, role)`; `user_id` fk profiles; `role app_role`; `granted_by` fk profiles (check: not the person themselves); `granted_at`. Select: own or admin. Write: server.
- `invitations`: `email`, `kind invitation_kind` (patient, guardian, team), `role` (nullable: a guardian has none), `patient_id` fk patient_profiles, `relationship guardian_relationship`, `can_act`, `job_title`, `full_name` (check: 120 characters), `invited_by` fk staff_profiles, `token_hash` (check length >= 32; unique index; only a SHA-256 of the 43-character link token), `sent_at`, `expires_at` (check: within 14 days of creation; the functions set 3 days), `accepted_at`, `failed_attempts` (smallint, default 0: wrong dates of birth for this link; the fifth cancels it, `20261105130000` [2026-11]), `revoked_at` (a cancelled invitation, or one replaced by a resend; check: not both accepted and revoked). `invitations_kind_fields` says what each kind carries: patient = role `patient` + patient; guardian = no role + patient + relationship + `can_act`; team = a team role (doctor, pa, health_coach, admin) and no patient. One pending invitation (not accepted, not cancelled) per `lower(email)`; an expired one is cancelled by the next invitation to that address. Select: admins read all, PAs read patient and guardian invitations for patients in `in_scope`; column grants exclude `token_hash`. **Created, resent, cancelled and accepted only through the functions in 4.7a** [2026-11].
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
- `results`: `lab_report_id`, `patient_id`, `marker_id`, `value_numeric`, `value_text` (check: one of them set), `unit`, `ref_low`, `ref_high`, `flag result_flag`, `doctor_comment`, `original_value` (numeric) and `original_unit` (text) [2026-11, `20261109120000`: the value as the lab reported it, set only when it was converted; both selectable by `authenticated`]. **Composite fk `(lab_report_id, patient_id)` to `lab_reports (id, patient_id)`**. Update (`doctor_comment` only): doctor. Values are locked by trigger.
- `marker_conversions` [2026-11, `20261109120000`]: `marker_id` fk markers, `from_unit` (1 to 20 characters), `factor` (> 0), `offset_value` (default 0), `created_at`; primary key `(marker_id, from_unit)`. Converted value = `value * factor + offset_value`. Select: anyone signed in. Insert and update: admin only; no delete grant. Audit trigger attached. Seeded by the migration and by `seed.sql` with 18 standard factors (testosterone, oestradiol, progesterone, glucose, three cholesterol markers, triglycerides, vitamin D, HbA1c (with offset), B12, ferritin, PSA, CRP, DHEA-S, haemoglobin, free T4, free T3); the clinic's own list replaces them when it arrives.
- `import_items`: `import_id`, `marker_id`, `raw_name`, `value` (text), `unit`, `ref_range_text`, `confidence`, `decision import_decision` ('pending'), `decided_by`. Read: doctor and PA. Update (`marker_id`, `decision`, `decided_by`): doctor and PA, `decided_by` must be the caller.

**Integrations and compliance** (`20261102111714_integrations_and_compliance.sql`)

- `webhook_events`: `source webhook_source`, `external_event_id`, `event_type`, `payload jsonb`, `status webhook_status` ('received'), `error`, `received_at`, `processed_at`. Unique `(source, external_event_id)` so a payment cannot be handled twice.
- `integration_sync_log`: `id bigint identity`, `system sync_system`, `direction`, `entity`, `entity_id`, `external_id`, `status sync_status`, `error`, `started_at`, `finished_at`.
- `audit_log`: `id bigint identity`, `actor_id` fk profiles (empty for system), `actor_role app_role`, `action`, `entity`, `entity_id`, `metadata jsonb`. Append-only (see triggers).

### 4.5 The release gate

Patients, guardians and the health coach see a result, a report or a lab PDF **only once the report is released**, and doctors and PAs see everything in scope. The gate rests on `lab_reports.released_at` and on composite foreign keys that make a result and a source PDF belong to the same patient as their report. `private.report_is_released(report_id)` guards `results`; `private.document_gate_open(document_id, kind)` guards `documents`: a patient's own upload is always visible, and any file used by an unreleased report stays hidden even if filed under another kind. A document is also visible to a patient only when `shared_with_patient` is true and it is not archived.

### 4.6 Helper functions (schema `private`)

All are `stable`, `SECURITY DEFINER` and `search_path = ''` unless noted; execute is granted to `authenticated` only. `private.auth_throttle_hit` is the exception: it writes and is for the service role only (see 4.15). They are definer so that policies can read `user_roles` and `care_team` without recursing.

| Function | Purpose |
|---|---|
| `is_active_staff(uuid)` | Active, unarchived `staff_profiles` row |
| `has_role(app_role)` | Caller holds the role, is not suspended, and (for staff roles) is active staff |
| `is_clinical_staff()` | doctor, PA or health coach |
| `is_team()` | doctor, PA or admin |
| `my_patient_ids()` | Own unarchived patient record plus patients of verified guardian links with `can_view` |
| `is_own_patient(uuid)` | The record is the caller's own |
| `can_act_for(uuid)` | Own record, or verified guardian with `can_act` |
| `in_scope(uuid)` | May this staff member open this patient. **Open question** (PRD open question 1): returns true for any clinical staff member until the clinic decides whether staff see all patients or only their care team. Since `20261102150000` the care team, patient profile, guardian link, safeguarding alert, repeat request, result import and import item policies all call it, so narrowing it is a change to this one function and needs no policy change [2026-11] |
| `my_staff_id()` | Caller's `staff_profiles.id`, so a write cannot be attributed to someone else |
| `report_is_released(uuid)`, `document_gate_open(uuid, doc_kind)` | The release gate |
| `storage_object_is_mine(text)` | The caller has already uploaded the file at that path. The documents insert policy requires it of a patient or guardian, so they cannot claim someone else's file or register a row before the file exists [2026-11] |
| `try_uuid(text)` | Cast to uuid or null; `immutable`, not definer |
| `get_my_patient_record()`, `get_staff_directory()` | Definer bodies of the read functions |
| `person_has_role(uuid, app_role)`, `may_invite(uuid, invitation_kind)`, `invitation_lifetime()` [2026-11] | For the invitation functions, which run for the service role and so have no `auth.uid()`: they check a named person with the rules of `has_role` (the role, not suspended, an active staff profile for staff roles). `may_invite`: admins send every kind, PAs patient and guardian only. The lifetime is 3 days. Execute is granted to `service_role`, not `authenticated` |

### 4.7 Read functions (public API)

RLS filters rows, not columns, so patients get hidden-column data through functions. The `SECURITY DEFINER` body lives in `private`; `public.get_my_patient_record()` and `public.get_staff_directory()` are `SECURITY INVOKER` wrappers [2026-11], because the Supabase advisors warn on definer functions in an exposed schema. Execute is granted to `authenticated` only.

- `get_my_patient_record()` returns `id, clinic_ref, first_name, last_name, date_of_birth, sex, contact_email, contact_phone, country, primary_clinician_id, is_self, can_act` for the caller's own record and the records of patients they are a verified guardian of, own record first. No external ids.
- `get_staff_directory()` returns `staff_id, profile_id, full_name, job_title, clinical_role, avatar_path` for the active team. No GMC number, signature or external ids. It replaces the draft's `staff_directory` view and adds `profile_id` so a letter can name its author (`documents.uploaded_by` is a profile id).

The other functions in `public` are not read functions and are not open to `authenticated` (except `get_invitable_patients`): `auth_throttle_hit` (4.15), the invitation wrappers (4.7a) and the results functions (4.7b).

### 4.7b Results functions (`20261109120000_results_entry_and_release.sql`) [2026-11, uncommitted]

The tables still give signed-in people no way to insert or change a report or a result. All writes go through these, each a `SECURITY DEFINER` function in `private` (`search_path = ''`) with a `SECURITY INVOKER` wrapper in `public`; execute is granted to `authenticated` (revoked from `public` and `anon`). The checks are inside the function, so the wrapper adds none. Refusals use errcodes 42501, 22023 or 23505 with messages written for people; `lib/results/actions.ts` shows those and hides any other.

| Function | What it does |
|---|---|
| `private.result_flag(_value, _low, _high)` (immutable, not definer) | `low` below the low limit, `high` above the high limit, `borderline` inside the range but within 5% of its width (of the limit when only one exists) of an edge, otherwise `normal`. Never returns `critical`: a doctor sets that |
| `register_import(_document_id) returns uuid` | Puts a file in the import queue. Allowed for the patient or an acting guardian on their own `patient_upload`, or a PA or doctor (for a patient in scope, or a file with no patient yet). One queue row per file. Status `needs_match` if the document has no patient, otherwise `matched` |
| `enter_report(_patient, _sample_date, _items jsonb, _lab_name, _document_id, _import_id) returns uuid` | PA or doctor with the patient in scope. Sample date from 1990-01-01 to today; 1 to 80 items of `{marker_id, value, unit}`; no marker twice; the value must be a finite number under 1,000,000,000. A unit other than the marker's needs a row in `marker_conversions` or the call fails; the converted value is rounded to 4 places and `original_value` and `original_unit` keep what was entered. The flag comes from `result_flag` against the marker's reference range, which is copied onto the result. Creates a `lab_reports` row as `awaiting_review`. A document must already be filed under the patient. If an import is named, it becomes `confirmed` with the report and the person who handled it; an import already dealt with fails the whole call |
| `release_report(_report, _comment) returns void` | Doctor only, patient in scope, locks the report. Sets `released`, `reviewed_by`, `reviewed_at`, `released_at` and `patient_comment` (up to 2,000 characters); moves a linked order from `results_in` to `reviewed`; writes a `results` notification to the patient (link `/portal/results`) if they have an account. A second release fails |

### 4.7a Invitation functions (`20261105120000_invitations.sql`) [2026-11, uncommitted]

Each is `SECURITY DEFINER` with `search_path = ''` in `private`, with a `SECURITY INVOKER` wrapper of the same name in `public` that is granted to `service_role` only (verified: `anon`, patient, doctor, health coach, PA and admin are refused, 401 or 403). The one exception is `get_invitable_patients`, also granted to `authenticated`. Every writer first sets `app.actor_id` to the inviter, so the audit log names the right person.

| Function | What it does |
|---|---|
| `create_invitation(_inviter, _kind, _email, _token_hash, _full_name, _role, _patient_id, _relationship, _can_act, _job_title, _new_patient jsonb, _confirm_email_mismatch boolean default false)` (replaced in `20261105130000`; the private function names the last argument `_confirm_mismatch`) | `may_invite` by name; refuses a self-invite, an invalid address, a team invitation to someone with a staff profile, a patient who already has an account or whose address belongs to another patient record, a guardian who is the patient or already a guardian. Cancels expired pending invitations to the address. With `_new_patient` it first inserts a minimal `patient_profiles` row (names, date of birth, `contact_email` for patient invitations) with the clinic reference `SC-` plus a number from `private.patient_ref_seq` (starts at 100000). One pending invitation per address (a duplicate gets a plain message). **Since `20261105130000` [2026-11]:** a patient invitation for an existing record whose `contact_email` differs from the address is refused (errcode 22023, hint `email_mismatch`) unless `_confirm_email_mismatch` is true; one live patient invitation per record; and notices are written to `notifications` (topic `messages`, link `/clinic/team`) without blocking the invitation: a doctor or admin invitation notifies the other admins, a guardian invitation with `_can_act` notifies the other PAs. Returns the invitation id |
| `resend_invitation(_inviter, _invitation, _token_hash)` | `may_invite` for the old row's kind; cancels the old row and every other unused invitation to the address, and makes a new row with a new hash and a new 3-day expiry |
| `revoke_invitation(_inviter, _invitation)` | `may_invite`; sets `revoked_at`; refuses an accepted one |
| `get_invitation(_token_hash)` | Read only. Returns `status` (`valid`, `used`, `cancelled`, `expired`, `not_found`), kind, role, email, name, job title, the inviter's name, whether an account exists for the address, and the expiry. A deactivated, suspended or no-longer-allowed inviter reads as `cancelled` |
| `accept_invitation(_token_hash, _user_id, _full_name, _date_of_birth date default null)` | One transaction, row locked: unused, not cancelled, not expired; the inviter may still send that kind; the account's email equals the invited address (case-insensitively) and it is not suspended. **Patient and guardian invitations also need `_date_of_birth` to equal the patient record's date of birth, or it raises "The date of birth does not match."** (team invitations need none) [2026-11]. Team: adds the staff profile (`clinical_role` from the role, active) and the role. Patient: sets `patient_profiles.user_id` (only if empty and not archived) and adds the `patient` role. Guardian: adds the `patient_guardians` link (`can_view`, `can_act` as sent, `verified_by` the inviter's staff profile). Then activates the profile, fills a blank name, marks the invitation accepted and notifies the inviter. Returns the kind |
| `verify_invitation_identity(_token_hash, _date_of_birth date default null)` [2026-11] | Returns text, never raises for a wrong date, so the count is kept. `invalid` (unknown, used, cancelled or expired), `ok` (team invitation, or the date matches), `wrong` (adds 1 to `failed_attempts`) or `locked` (the fifth wrong date sets `revoked_at` and notifies the inviter "An invitation was cancelled"). Runs with `app.system_actor = 'invitation-identity-check'` for the audit trigger. Service role only |
| `get_invitable_patients()` | For signed-in PAs (patients in `in_scope`) and admins (all): `id`, first and last name, `clinic_ref`, `has_account` for unarchived patients. Nothing clinical. An empty list for everyone else |

### 4.8 Triggers

| Trigger | Function | Effect |
|---|---|---|
| `*_set_updated_at` on `profiles`, `notification_preferences`, `patient_profiles` | `private.set_updated_at` | Keeps `updated_at` |
| `on_auth_user_created` on `auth.users` | `private.handle_new_user` (definer) | Creates the `profiles` row; grants no role |
| `on_auth_user_email_changed` on `auth.users` (after update of `email`, only when it changes) [2026-11, uncommitted] | `private.sync_profile_email` (definer) | Copies the confirmed sign-in email to `profiles.email`, so the two never drift. A person cannot change `profiles.email` themselves (the trigger below and the column grant) |
| `profiles_protect_columns` | `private.protect_profile_columns` | Client cannot change `id` or `email`; only an admin changes `status`; an admin cannot edit another person's details |
| `staff_profiles_protect_columns` | `private.protect_staff_columns` | Non-admins cannot change title, role, GMC number, `active`, `archived_at` |
| `*_reject_client_changes` on `staff_profiles`, `patient_profiles`, `medications`, `repeat_requests`, `documents`, `questions`, `lab_orders`, `result_imports`, `results` | `private.reject_client_changes(cols...)` | A second lock behind the column grants: `current_user = 'authenticated'` cannot change the named columns; service role and migrations are unaffected |
| `lab_orders_reject_client_paid_status` | `private.reject_client_paid_status` | A client cannot set an order to `paid` |
| `<table>_write_audit_log` on 27 tables | `private.write_audit_log` (definer) | Audits insert, update and delete |
| `audit_log_reject_update_delete`, `audit_log_reject_truncate` | `private.reject_audit_change` | `audit_log` is append-only, even for the service role |

Audited tables: every table except `notification_preferences`, `notifications`, `webhook_events`, `integration_sync_log` and `audit_log`.

**Audit rules** [2026-11]: for an update, `metadata` is `{"changed": [column names]}` and **never values**, because the table can never be erased and must not hold clinical data. The actor is `auth.uid()`; server code that acts for a person names them with `set_config('app.actor_id', '<profile id>', true)` in the same transaction. `actor_role` is the person's most specific role (staff over patient). Select-only "viewed" events are not written by triggers. Since `20261102150000` [2026-11, uncommitted], `private.write_audit_log` refuses a write made as the service role that names neither an actor (`app.actor_id`) nor a background job (`app.system_actor`, recorded in `metadata` as `system`). SQL run by the database owner (migrations, seed) is unaffected.

### 4.9 Storage

`20261102111728_storage.sql` and, for signatures, `20261104120100_signatures_bucket.sql` (uncommitted). All three buckets are private; files are served through short-lived signed URLs (3600 seconds for photos and signatures). No delete policy on any bucket: files are not hard-deleted, so a removed photo or a replaced file stays in storage and is simply no longer shown.

| Bucket | Limits | Path | Policies |
|---|---|---|---|
| `documents` | 25 MiB; pdf, jpeg, png, heic | `<patient id>/...`, or `unmatched/...` before matching | Select: anyone who can read the matching `documents` row under their own RLS. Insert: someone who can act for the patient, or a doctor or PA (for `unmatched/` or a patient in scope) |
| `avatars` | 2 MiB; jpeg, png, webp | exactly `<user id>/avatar` for new writes; older objects may have other names | Select: own, any active staff member's, or team reads all (patient photos therefore reach every doctor, PA and admin, not the coach or a guardian). Insert and update: own folder, exactly the name `avatar` (`docs/SECURITY.md` S-70) |
| `signatures` [2026-11, uncommitted] | 1 MiB; png, jpeg, webp | exactly `<user id>/signature` | Select: the owner only. Insert and update: the owner, and only a doctor, at that exact name. Letters will read it with the service role in server code |

### 4.10 Extensions, schemas and API exposure

- `private` schema: usage granted to `authenticated` and, since the throttle migration, `service_role` [2026-11]; not exposed through the Data API; `anon` has nothing. `service_role` holds execute on `private.auth_throttle_hit` only, and nothing on the table.
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
| `20261102143000_auth_throttle.sql` | `private.auth_throttle`, `private.auth_throttle_hit`, service-role-only wrapper `public.auth_throttle_hit`. Uncommitted |
| `20261102150000_scope_and_audit_actor.sql` | Adds `private.in_scope()` to the care team, patient profile, guardian link, safeguarding alert, repeat request, result import and import item policies (behaviour unchanged for now); `write_audit_log` refuses a service-role write with no `app.actor_id` or `app.system_actor`. Uncommitted |
| `20261104120000_profile_email_sync.sql` | `private.sync_profile_email` and the trigger on `auth.users` that keeps `profiles.email` in step (`docs/SECURITY.md` S-23). Uncommitted |
| `20261104120100_signatures_bucket.sql` | The private `signatures` bucket (1 MiB; png, jpeg, webp) and its select, insert and update policies on `storage.objects`; no delete policy. Uncommitted |
| `20261104120200_profile_limits_and_avatar_path.sql` | Check constraints: `profiles.full_name` 1 to 120 characters; `profiles.phone` up to 30 characters of digits, spaces, + ( ) and -. The `avatars` insert and update policies now accept exactly `<user id>/avatar` (old objects are not rewritten). Uncommitted (`docs/SECURITY.md` S-70, S-71) |
| `20261109120000_results_entry_and_release.sql` | Uncommitted [2026-11]. Adds `document_source` value `staff_upload`; table `marker_conversions` (forced RLS, three policies, audit trigger, 18 seeded conversions); `results.original_value` and `original_unit`; `private.result_flag`, `private.register_import`, `private.enter_report`, `private.release_report` and their `public` wrappers (4.7b) |
| `20261105130000_invitation_identity.sql` | Uncommitted [2026-11]. Adds `invitations.failed_attempts`; drops and recreates `create_invitation` (new-patient and email-mismatch arguments, notices to admins and PAs) and `accept_invitation` (date of birth), both in `private` and `public`; adds `verify_invitation_identity`; grants execute to `service_role` only |
| `20261105120000_invitations.sql` | The `invitation_kind` enum; new `invitations` columns (`kind`, `relationship`, `can_act`, `job_title`, `full_name`, `revoked_at`, `sent_at`) and checks; `role` nullable; one pending invitation per address (cancelled ones do not block); a unique `token_hash`; column grants; the read policy (PAs: patient and guardian invitations in scope; admins: all); `private.person_has_role`, `may_invite`, `invitation_lifetime`, `patient_ref_seq` and the six functions in 4.7a, with `public` wrappers for the service role. Uncommitted |

Create a new one with `supabase migration new <name> </dev/null`: the command hangs when stdin is not a terminal [2026-11].

### 4.12 Tests, seed and local commands

- `supabase/tests/00_schema_checks.test.sql` (pgTAP): table count, forced RLS, no `FOR ALL`, no cascades, no anon grants, delete grants, `search_path` on every function, no definer in `public`, and more.
- `supabase/tests/01_role_matrix.test.sql` (pgTAP): runs SQL as each seeded user the way PostgREST does and checks what each role can read and write.
- `supabase/tests/02_auth_throttle.test.sql` (pgTAP) [2026-11]: anon and authenticated cannot call the throttle or read the counters, the service role reaches the counters only through the function, a full bucket refuses, a refused attempt counts nowhere, an expired window restarts. Uncommitted.
- `supabase/tests/03_scope_and_audit_actor.test.sql` (pgTAP) [2026-11]: the scoped policies still admit clinical staff, and the audit trigger refuses a service-role write with no actor or system job, accepts one that names either, and leaves database-owner SQL alone. Uncommitted. `01_role_matrix` now sets `app.system_actor` for its service-role writes.
- `supabase/tests/04_profile.test.sql` (pgTAP) [2026-11]: a confirmed email change reaches `profiles.email`; a doctor stores her signature at the exact path and reads it; another name or folder is refused; a patient and a PA can neither store nor read a signature. Uncommitted. It also covers the avatar path and the name and phone limits. It renames any existing signature or avatar objects out of the way first (storage forbids direct deletes), so it passes with or without a pre-existing signature (`docs/SECURITY.md` S-72).
- `supabase/tests/05_invitations.test.sql` (pgTAP) [2026-11, uncommitted]: 93 tests (counted from the run: 295 in all less the other files; includes the date of birth, five-attempt lock, email-mismatch and notice cases). The new functions refuse `anon`, patients, doctors, health coaches and (for the writers) PAs and admins through the API roles; who may send which kind; the checks in create, resend, revoke and accept; the read policy by role; the constraints; `token_hash` unreadable; the audit actor.
- `supabase/tests/06_results.test.sql` (pgTAP, `no_plan`) [2026-11, uncommitted]: the results functions and `marker_conversions` (flags, conversion, entry, release, who may call what).
- Seven files (`pnpm db:test` gives the total; the 295 counted before the results file is out of date). The tests count seed rows, so run `pnpm db:reset` first if anything else has written to the local database.
- `supabase/seed.sql`: fictional data only, loaded by `db:reset`. **Local logins, their shared password and the account list are documented at the top of that file; refer to it, not here.** Seed dates are relative to the day of `db:reset` [2026-11], so the diary always has a today; reset again if it looks empty. Seed ids are fixed (users `a0...`, staff `b0...`, locations `c0...`, patients `d0...`). Never run the seed on the hosted project.
- `package.json` scripts: `db:start`, `db:stop`, `db:reset`, `db:lint`, `db:test`, `db:types`, `db:advisors`.

### 4.13 Auth configuration (`supabase/config.toml`)

- `[auth] enable_signup = false`: public sign-up is off [2026-11].
- `[auth.email] enable_signup = true` **must stay true**: if it is false, email sign-in is disabled altogether [2026-11].
- Password 12 to 128 characters (shared Zod rules in `lib/auth/password-rules.ts`; Auth config minimum 12), with lower case, upper case and digits; refresh-token rotation on; email confirmations off locally; anonymous sign-ins off; MFA off (deferred, see section 8); the recovery, email-change and reauthentication emails and the two notifications (password changed, and `[auth.email.notification.email_changed]`, which tells the old address when the sign-in email changes) use the branded files in `supabase/templates/` (built by `pnpm email:build`, section 5), with both notifications enabled [2026-11].
- Site URL `http://localhost:3000`; redirects allowed on port 3000 only (see Findings on `web-local`).
- Resend SMTP (`smtp.resend.com`, port 465, user `resend`, the API key as password) is present as **commented** settings for hosted use; locally, mail goes to Mailpit. The hosted project is set by hand (section 2) [2026-11].
- `[auth.sessions]` stays commented out: Supabase's time-box and inactivity settings need the Pro plan, so the proxy enforces the limits instead (section 5).
- These settings describe the local stack. The hosted project is configured by hand: public sign-up off, minimum password 12, and leaked password protection off because it needs the Pro plan [2026-11].

### 4.14 Changes from `docs/reference/schema-draft.md` [2026-11]

1. `documents.patient_id` is nullable (emailed reports before matching; path `unmatched/`), and such rows are staff-only (doctor and PA) until matched.
2. Invitations are created only by server code, through the functions in 4.7a. The draft says "PA, admin create", but the token must not be chosen by the inviter. PAs read patient and guardian invitations and admins read all, without `token_hash`; a guardian invitation has no role (`invitations.role` is nullable) [2026-11].
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
14. `private.auth_throttle` and the `auth_throttle_hit` functions are not in the draft; they exist to limit sign-in and reset attempts (see 4.15).
15. [2026-11] `marker_conversions`, `results.original_value`, `results.original_unit`, the `staff_upload` value of `document_source` and the functions in 4.7b are not in the draft (`20261109120000`).

### 4.15 Attempt limits (`20261102143000_auth_throttle.sql`) [2026-11]

- `private.auth_throttle`: `key_hash` (text, pk), `attempts` (integer, check > 0), `window_ends_at` (indexed), `created_at`. Keys are SHA-256 hashes made by the server, so the table holds no email or IP address. All privileges revoked from `public`, `anon`, `authenticated` and `service_role`. It is in `private`, outside the Data API, and has no RLS: the revokes are its protection.
- `private.auth_throttle_hit(_keys text[], _limits integer[], _window_seconds integer) returns boolean`: `SECURITY DEFINER`, `search_path = ''`. Purges expired rows; returns false if any bucket is full, counting nothing, so a refused attempt cannot use up another bucket; otherwise adds one to every bucket and returns true. Concurrent calls can overshoot a limit slightly.
- `public.auth_throttle_hit(...)`: `SECURITY INVOKER` wrapper, execute granted to `service_role` only. Called from `lib/auth/throttle.ts`.

## 5. Architecture and file structure

| Path | State |
|---|---|
| `app/layout.tsx` | Built. `en-GB`, fonts, `TooltipProvider`, `Toaster`, `VercelInsights` (uncommitted), `noindex`, favicon and Apple icon from `public/brand/`. Calls `await connection()`, so every page renders per request and can carry its own CSP nonce [2026-11, uncommitted] |
| `app/globals.css` | Built. Every design token and type utility |
| `app/dev/ui/` | Built. Component gallery |
| `components/knowledge-base/page-shell.tsx` | Built, uncommitted [2026-11]. Shared by both knowledge base pages. `requireKnowledgeBaseReader(returnPath)`: no user redirects to `/login?next=<returnPath>`; not admin or suspended goes to `homePathFor` (else `/login?error=no-access`). `KnowledgeBaseShell` (`activePath`, `source`, `titleBefore`, `titleAccent`, `intro`): staff `SessionGuard`, back link, wordmark, title, two tabs ("How it works" `/knowledge-base`, "Try the results flow" `/knowledge-base/test-results`), the `##` contents list, `Markdown`, footer |
| `app/knowledge-base/test-results/page.tsx` | Built, uncommitted [2026-11]. Second tab, same admin-only rules through `requireKnowledgeBaseReader("/knowledge-base/test-results")`, `noindex`; reads `content/test-results-flow.md` with `fs` at request time (same Vercel file-tracing dependency) and renders it in `KnowledgeBaseShell` |
| `content/test-results-flow.md` | Built, uncommitted [2026-11]. Step-by-step guide to try the results flow (enter a report, review and release, see the patient view). Client-facing: keep it free of secrets and internal detail |
| `app/knowledge-base/page.tsx` | Built, uncommitted [2026-11]. **Admins only**, now through `requireKnowledgeBaseReader("/knowledge-base")` and `KnowledgeBaseShell` (see `page-shell.tsx`; the checks, `SessionGuard kind="staff"` and back link moved there). The proxy also protects the prefix. `robots: { index: false, follow: false }`. A Server Component that reads `content/knowledge-base.md` with `fs/promises` (`process.cwd()`) at request time, which works because the root layout's `connection()` makes every page dynamic; it relies on Vercel file tracing to ship the file. Builds the contents list from the `##` headings and passes it to `Contents`. Tracked in `docs/SECURITY.md` S-64 |
| `components/knowledge-base/contents.tsx` | Built, uncommitted [2026-11]. Client Component: the section list as a sticky sidebar on wide screens and a sticky bar with a menu on narrow ones; the current section comes from a scroll listener (last `h2` whose top is within 140px) |
| `components/knowledge-base/markdown.tsx` | Built, uncommitted [2026-11]. `Markdown` (`react-markdown` with `remark-gfm`, no raw HTML) maps elements to design-system type utilities and tokens; `slugify` makes heading anchors shared with the page's contents list |
| `content/knowledge-base.md` | Single source of truth for the knowledge base [2026-11]. Client-facing: written so the owner can share it with the clinic to validate the product (roles, access matrix, pages, sign-in rules, 13 flows, integrations, emails, 21 open questions and decisions). It mirrors a claude.ai document owned by the user. **Edit this file, not the page**; keep it free of secrets and internal detail. Its access table is derived from the policies, so re-check it whenever policies change |
| `app/fonts/` | Cormorant Garamond and Inter, self-hosted woff2 |
| `app/(auth)/` | Built. `login`, `forgot-password`, `update-password` (each a page plus a client form), shared layout |
| `app/auth/confirm/route.ts` | Built. Verifies emailed links (`token_hash` or `code`); `next` is checked against an allow-list |
| `app/(auth)/invite/route.ts`, `app/(auth)/invite/accept/page.tsx` | Built, uncommitted [2026-11]. The emailed link and the page it leads to; see section 6. Both public (not in the proxy's protected list); the page is `noindex` |
| `app/portal/` | Built [2026-11]. `layout.tsx` (routing guard, shell), `page.tsx` (home), `loading.tsx`, `error.tsx` |
| `app/portal/profile/page.tsx`, `app/clinic/profile/page.tsx` | Built, uncommitted [2026-11]. Each reads `?tab=` and renders `ProfilePage` with `area="portal"` or `"clinic"`. Both sit inside the layout's guard. Metadata title "Profile" |
| `components/profile/` | Built, uncommitted [2026-11]. `profile-page` (server: chooses the tabs; reads through `lib/data/profile.ts`), `profile-tabs` (Client: the chosen tab goes into `?tab=` with `history.replaceState`), `section` (`ProfileSection`, `DefinitionList`), `details-form` (`AvatarForm`, `DetailsForm`), `notifications-form`, `security-forms` (`ChangePasswordForm`, `ChangeEmailForm`, `SignOutOthersForm`), `signature-form`, `image-input` (Client: the file field for a photo or signature; calls `shrinkImage` on choosing a file and holds the form's button while it works), `form-message` |
| `app/clinic/` | Built [2026-11]. Same four files; home reads `?location=` |
| `app/clinic/team/page.tsx` | Built, uncommitted [2026-11]. "Team invitations": a server page for PAs and admins (`kindsFor(roles)`; anyone else, or a suspended person, goes to `/clinic`). Reads the patient list (`get_invitable_patients`) and the invitations through the person's own session, and renders `InviteSheet` and `InvitationsTable`. The metadata title is "Team and settings" |
| `components/team/`, `components/invite/` | Built, uncommitted [2026-11]. `invite-sheet` (Client: the "Invite someone" sheet and form), `invitations-table` (Client: status filters, the table, Resend and Cancel per row); `invite/accept-forms` (Client: `CreateAccountForm`, `SignInToAcceptForm`, `ConfirmAcceptForm`, `SignOutForm`) |
| `lib/invitations/` | Built, uncommitted [2026-11]. `constants.ts` (labels, `INVITATION_DAYS` = 3, `TEAM_ROLES`, `RELATIONSHIPS`, `kindsFor(roles)`), `token.ts` (`generateToken`: 32 random bytes as 43 base64url characters; `hashToken`: SHA-256 hex; `cleanToken`: exactly 43 of `[A-Za-z0-9_-]` or null), `actions.ts` (`sendInvitation`, `resendInvitation`, `cancelInvitation`), `accept-actions.ts` (`createAccountFromInvitation`, `signInToAcceptInvitation`, `acceptInvitationWhileSignedIn`, `signOutForInvitation`), `lookup.ts` (`server-only`: `INVITE_COOKIE`, `readInviteToken`, `lookupInvitation`). The first use of `lib/supabase/admin.ts` beyond the throttle |
| `lib/data/invitations.ts` | Built, uncommitted [2026-11]. `getPatientOptions` (the `get_invitable_patients` function, through the session) and `getInvitations` (the table through the session, with names from `get_staff_directory()`; status from `accepted_at`, `revoked_at` and the expiry) |
| `components/ui/` | Built. Restyled shadcn primitives and design-system components (`select` [2026-11, uncommitted]: a native select styled like `Input`; alert-bar, status-pill, stat-card, sparkline, page-header, empty-state, demo-banner, wordmark and others; `order-steps` added in phase 6) |
| `components/vercel-insights.tsx` | Client Component, uncommitted [2026-11]. Mounts Vercel Web Analytics and Speed Insights. Both `beforeSend` hooks cut every URL to origin plus path, dropping query strings and fragments (an emailed link's `token_hash`, `?location=`). Cookie-free; the scripts load from the app's own origin (`/_vercel/insights/script.js`, `/_vercel/speed-insights/script.js`) and only run on Vercel, so the CSP (`script-src 'self'` with nonce and `strict-dynamic`, `connect-src 'self'`) is unchanged. Tracked in `docs/SECURITY.md` S-63 |
| `components/auth/` | Built. `form-parts`, `password-input`, for the sign-in forms |
| `components/shell/` | Built [2026-11]: `session-guard` (uncommitted), `app-shell`, `sidebar-content`, `nav` (unbuilt screens disabled via `coming-soon`; an item can carry a `roles` list and is then shown only to people holding one of them, and a group left empty is dropped: "Team and settings" is for PAs and admins; `roles` is passed down from the layouts through `AppShell` and `SidebarContent` [2026-11]), `mobile-nav`, `location-switcher`, `notifications-bell`, `user-menu` (profile link, photo), `crumb` (Client: shows "Account / Profile" on the profile route, from `usePathname`; uncommitted) |
| `lib/supabase/` | `server.ts`, `proxy.ts` (session refresh and session limits), `session-cookies.ts` (limits, cookie options, HMAC signing), `admin.ts` (service role, server only). `client.ts` was deleted [2026-11]: **there is no browser Supabase client**, and every Supabase call runs on the server |
| `lib/env.ts` | Lazy Zod validation of public, Supabase server, email and session (`getSessionEnv`) variables |
| `lib/csp.ts` | `createNonce()` and `contentSecurityPolicy(nonce)`. Uncommitted [2026-11] |
| `lib/email/send.ts` | Resend wrapper |
| `lib/email/theme.ts` | Uncommitted [2026-11]. Token colours as sRGB hex, converted from `docs/reference/design-system/tokens.json`, and the font stacks. The only raw colours outside the stylesheet, because email clients lack CSS variables and oklch |
| `lib/email/layout.ts` | Uncommitted. Table layout with inline styles shared by every email: logo, eyebrow, title with one italic phrase, button, link fallback, code block, detail rows, fine print, footer, hidden preheader. Light colour scheme only |
| `lib/email/templates/auth.ts` | Uncommitted. The five sign-in service emails (recovery, email change, reauthentication, password changed, email changed: the last goes to the address the account had before, built into `supabase/templates/email_changed_notification.html`) with Supabase placeholders (`{{ .SiteURL }}`, `{{ .TokenHash }}`, `{{ .Token }}`, `{{ .Email }}`, `{{ .NewEmail }}`). Built into `supabase/templates/*.html` |
| `lib/email/templates/app.ts` | Uncommitted. `invitationEmail` (audience `patient`, `guardian` or `team`), `guardianAccessEmail`, `resultReadyEmail`, each returning `{ subject, html, text }` for `sendEmail({ to, ...template })`. **`invitationEmail` is sent by `lib/invitations/actions.ts` and `resultReadyEmail` by `releaseReport` in `lib/results/actions.ts` [2026-11]; `guardianAccessEmail` is not wired to any flow yet.** No clinical values; links built from `SITE_URL`, never from a request header |
| `scripts/` | Uncommitted. `build-auth-emails.ts` (`pnpm email:build`: writes `supabase/templates/*.html`), `preview-emails.ts` (`pnpm email:preview`: writes `.email-preview/`, git-ignored, with a copy of the logo), `send-test-email.ts` (`pnpm email:test <invitation\|guardian\|result> <to>`: **sends a real email through Resend** using `.env.local`, for the owner to run). Dev dependency `tsx` added |
| `lib/fonts.ts`, `lib/utils.ts` | Fonts; `cn` helper |
| `lib/auth/` | `session.ts` (`getCurrentUser`, which returns `isAdmin`: true if `user_roles` holds `admin`, not checking the active staff profile; `homePathFor`), `actions.ts` (server actions), `throttle.ts` (`allowAuthAttempt`; uses the service role; two more actions for invitations [2026-11], see section 6), `session-start.ts` (`startSessionCookies`: server only, sets the signed `ch_` cookies; uncommitted), `next-path.ts` (`parseReturnPath`: fixed allow-list, `/knowledge-base` and `/knowledge-base/test-results` [2026-11], so sign-in can return a person to a page without an open redirect; `signIn` and the login page use it only if `isAdmin`; uncommitted); `password-rules.ts` (the one password rule, shared by the reset page and the profile) and `role-labels.ts` (names for roles; uncommitted [2026-11]) |
| `lib/results/actions.ts` | Built, uncommitted [2026-11]. The results server actions (section 6). Checks a file's first bytes (PDF, JPEG or PNG), 10 MiB at most |
| `lib/data/results.ts` | Built, uncommitted [2026-11]. Through the session: `getResultsQueue` (awaiting, released, imports), `getEntryOptions`, `getImportForEntry`, `getReport`, `getMyResults` (a patient's markers with trend points). Types `ReportRow`, `ImportRow`, `ReportDetail`, `MarkerTrend` |
| `components/results/` | Built, uncommitted [2026-11]. `entry-form` (Client: patient, sample date, lab, optional file, marker rows with unit), `review-forms` (Client: `CommentsForm`, `ReleaseForm`), `trend-chart` |
| `lib/data/` | Built [2026-11]. `portal.ts` (`getPortalHome`), `clinic.ts` (`getClinicHome`, `getClinicNavCounts`), `shell.ts` (notifications, locations). All read through the signed-in session; `profile.ts` (uncommitted [2026-11]: `getAccount`, `getAvatarUrl` and the signed URLs for photos and signatures, `getNotificationPreferences` with a missing row counting as on, `getPatientProfile` (own record and guardianship through `get_my_patient_record()`), `getWorkProfile`). The shell's current nav row now comes from the pathname (`usePathname`), not a prop |
| `lib/profile/` | Built, uncommitted [2026-11]. `actions.ts` (the profile server actions, below), `image-check.ts` (`IMAGE_TYPES`, `bytesMatchType`: first bytes must match jpeg, png or WebP's RIFF and WEBP marks), `shrink-image.ts` (browser only, canvas: returns the file unchanged if it fits, else a smaller JPEG on a white ground, up to 6 attempts reducing size and quality; refuses types other than JPEG, PNG and WebP, HEIC included; the caller passes the limits: photos 2 MiB and 1024 px, signatures 1 MiB and 1200 px), `notification-options.ts` (topics results, payments, appointments, messages; channels email and portal) |
| `lib/format.ts`, `lib/results.ts` (a file, next to the `lib/results/` folder) | Built [2026-11]. London-time date and money formatting, 14-day arithmetic; maps `result_flag` to the in_range, borderline, out_of_range pills |
| `lib/database.types.ts` | Generated by `pnpm db:types` |
| `proxy.ts` | Calls `updateSession`: refreshes the session with `getClaims()`, ends a session past its limits, sets the Content-Security-Policy and redirects signed-out visitors away from `/portal`, `/clinic` and `/knowledge-base` (the protected prefixes) to `/login`; for `/knowledge-base` it adds `?next=%2Fknowledge-base` (via `parseReturnPath`) and applies the staff session limits to that exact path. Row-level security is the real authorisation |
| `next.config.ts` | Static security headers (HSTS, nosniff, referrer policy, frame denial, permissions policy). The Content-Security-Policy was removed from here [2026-11, uncommitted]: it is set per request in `lib/supabase/proxy.ts`; `experimental.serverActions.bodySizeLimit: "11mb"` [2026-11, uncommitted; was `3mb`] so a 10 MiB lab report (or a 2 MiB photo) plus form overhead fits. It applies to every server action, not only uploads; a larger body gets a plain 500 from Next.js (`docs/SECURITY.md` S-73, reduced: the browser now shrinks a large image first, so the 500 only reaches someone without JavaScript or posting another way) |
| `supabase/` | `config.toml`, `migrations/` (22), `tests/` (7 pgTAP files), `seed.sql`, `templates/recovery.html`. See section 4 |
| `public/pics/` | `about-clinic-door.png`, the sign-in panel photograph, uncommitted [2026-11]. The source is 7.5 MB; `next/image` serves it as WebP, about 400 KB at 1920 px. Compress the source (`docs/DESIGN-SYSTEM.md`) |
| `public/brand/` | `schoemanClinic-logo.png` and `favicon.png`. `app/favicon.ico` was removed [2026-11] |
| `.claude/launch.json` | Dev server configurations: `web` (port 3000, reads `.env.local`, so the hosted project) and `web-local` (port 3130, takes its URL and keys from `supabase status`, so the local stack, and sets a fixed local `SESSION_COOKIE_SECRET`) [2026-11] |
| `docs/reference/` | Schema draft, design system, prototype. Read only |

**Session limits** (`lib/supabase/session-cookies.ts`, enforced in `lib/supabase/proxy.ts`) [2026-11, uncommitted]:

| Kind | Total | Idle |
|---|---|---|
| Staff | 12 hours | 30 minutes |
| Patient (and guardian) | 7 days | 2 hours |

- `ch_session_kind` holds the kind and `ch_last_seen` the last request time; both are **signed** [2026-11, uncommitted]. The value is `value.signature`, where the signature is HMAC-SHA256 (Web Crypto, key `SESSION_COOKIE_SECRET`) over `cookie name|user id|value`, so a cookie cannot be edited, moved to another cookie or used by another account. A missing, unsigned, edited or foreign cookie reads as missing: a missing last-seen counts as expired and a missing kind gets the staff limits. If `SESSION_COOKIE_SECRET` is missing or under 32 characters, `getSessionEnv` throws and the proxy fails closed. Server code sets them through `startSessionCookies` in `lib/auth/session-start.ts`.
- `signIn` and `updatePassword` set it; staff limits win for someone who is also a patient, and a missing or unknown value gets the staff limits. Paths under `/clinic` always use the staff limits, whatever the cookie says.
- `ch_last_seen` is written at most once a minute. Sign-in and password change set it. A missing value, or one more than a minute in the future, counts as expired, so the visitor is signed out.
- The total runs from the latest sign-in time in the token's `amr` claim, which a refresh does not change, with `iat` as the fallback.
- A session past a limit is signed out locally, its `sb-*` and `ch_*` cookies are removed, and the visitor goes to `/login?error=expired`.
- `/auth/confirm` is exempt in the proxy, which leaves both `ch_` cookies alone there. The route itself calls `startSessionCookies(user id, null)`, which signs `ch_last_seen` as now and deletes `ch_session_kind`, only after `verifyOtp` or `exchangeCodeForSession` succeeds, because a verified link starts a new session (staff limits apply until the kind is known). A bad link changes nothing.
- Auth cookies and both `ch_` cookies are `HttpOnly`, `Secure` in production, `SameSite=Lax`, with a 7-day `maxAge`. `@supabase/ssr` overwrites `maxAge` with its 400-day default, so `withSessionMaxAge` sets it again on each write.

**Session guard** (`components/shell/session-guard.tsx`) [2026-11, uncommitted]. A Client Component rendered by `AppShell`, which has a new required prop `sessionKind` (`staff` or `patient`): the clinic layout passes `staff`, the portal layout passes `staff` for anyone with a staff role and `patient` otherwise. While the person is active (pointer, key, scroll, touch) it calls `router.refresh()` at most every 5 minutes, which keeps the idle clock moving; once the person stops for the session's idle limit, an idle timer calls `router.refresh()` so the proxy ends the session and sends them to `/login?error=expired`. Without it an abandoned screen stays readable. It renders nothing and makes no Supabase call.

**Content-Security-Policy** (`lib/csp.ts`, set in `lib/supabase/proxy.ts`) [2026-11, uncommitted]. The proxy makes a nonce for each request (`createNonce`), builds the policy with `contentSecurityPolicy(nonce)`, and sets it on every response (including redirects) and, with `x-nonce`, on the forwarded request headers so Next.js adds the nonce to its scripts. `script-src` is `'self' 'nonce-...' 'strict-dynamic'`, with `'unsafe-eval'` in development only. `style-src` still allows `'unsafe-inline'`, because React and Radix write style attributes a nonce cannot cover (`docs/SECURITY.md` S-12). Other directives: `default-src 'self'`, images from self, `data:`, `blob:` and the Supabase origin, `connect-src` self plus Supabase (and local websockets in development), `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. A nonce needs a fresh render, so `app/layout.tsx` awaits `connection()` and no page is statically rendered.

## 6. Routes, server actions and API routes

| Route | State |
|---|---|
| `/` | Redirects: signed-out to `/login`, staff to `/clinic`, patient or guardian to `/portal` |
| `/login`, `/forgot-password`, `/update-password` | Built. `/login?error=` takes `link`, `no-access` and, new and uncommitted, `expired` [2026-11]; any other value shows nothing |
| `/auth/confirm` | Route handler (GET), built |
| `/portal` | Built. Patient home |
| `/clinic` | Built. Clinic dashboard; optional `?location=<id>` |
| `/portal/profile`, `/clinic/profile` | Built, uncommitted [2026-11]. The same screen under each area, with `?tab=`: `details`, `record` (patients), `guardianship` (guardians), `work` and `signature` (staff; the signature only for doctors), `notifications`, `security`. An unknown tab shows details. The tabs a person sees depend on the area and their roles: a patient has Details, Your record, Notifications and Security; a guardian adds People you look after (and has no record if not a patient); a doctor, PA, health coach or admin has Details, Work profile, Notifications and Security, a doctor also Signature; a doctor who is also a patient has both areas, each with its own tabs. Reached from the account menu and from the crumb |
| `/dev/ui` | Component gallery; `notFound()` when `NODE_ENV` is production |
| `/knowledge-base/test-results` | Built, uncommitted [2026-11]. Admins only, `noindex`; second tab, renders `content/test-results-flow.md`. Signed out: proxy 307 to `/login?next=%2Fknowledge-base%2Ftest-results`. Everyone else, and suspended people, go to their own home |
| `/knowledge-base` | Built, uncommitted [2026-11]. Admins only, `noindex`; renders `content/knowledge-base.md`. Signed out: proxy 307 to `/login?next=%2Fknowledge-base`. Everyone else, and suspended people, go to their own home |
| `/invite` | Route handler (GET), built, uncommitted [2026-11]. Public. Takes `?token=`; if it is exactly 43 base64url characters it sets the cookie `ch_invite` (`HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/invite`, one hour) and in every case redirects to `/invite/accept` with no query, `Cache-Control: no-store`. It reads nothing from the database and uses nothing up, so a mail scanner that follows the link harms nothing. The route also sets `Referrer-Policy: no-referrer`, but the global header in `next.config.ts` wins (`docs/SECURITY.md` S-82) |
| `/invite/accept` | Built, uncommitted [2026-11]. Public page, rendered per request, reads `ch_invite`. Valid link and no one signed in: a create-account form (name, password, repeat; the address shown and fixed) if no account exists for the invited address, otherwise a sign-in form with the address fixed. Patient and guardian forms also ask for a date of birth ("Your date of birth" for a patient, "The patient's date of birth" for a guardian; `DobField`, input `dob`, required) [2026-11]. Signed in as the invited address: one button ("Add … access to my account"). Signed in as someone else: a sign-out button. Used, cancelled, expired, unknown or missing link: a neutral message with no detail about who it was for. Under the proxy it is not protected; a signed-in session keeps its limits |
| `/clinic/team` | Built, uncommitted [2026-11]. PAs and admins (others redirected to `/clinic`): invitations and the "Invite someone" sheet. Nav item "Team and settings", visible only to PAs and admins. Managing existing members is not built |

| `/clinic/results` | Built, uncommitted [2026-11]. Results review: awaiting review, released and the import queue (anchor `#imports`). Any clinic reader; "Add results" only for PAs and doctors. Nav: "Results review" for all clinic roles, "Import queue" for PAs and doctors |
| `/clinic/results/new` | Built, uncommitted [2026-11]. PAs and doctors (others redirected to `/clinic`). Entry form; `?import=<id>` loads a queued file, and an unknown or handled one redirects to `/clinic/results` |
| `/clinic/results/[id]` | Built, uncommitted [2026-11]. One report with its results; 404 for a non-UUID or a report the person cannot read. Doctors get the comments and release forms |
| `/portal/results` | Built, uncommitted [2026-11]. The patient's released markers with trends. Nav: "My results" |
| `/portal/results/[markerId]` | Built, uncommitted [2026-11]. One marker's trend and values; 404 if the marker is unknown |

Every other nav entry (patient: Lab orders, Upload results, Prescriptions, Appointments, Ask the clinic, Letters and documents, Privacy and consent; clinic: Patient list, Lab orders, Safeguarding alerts) is shown disabled with a "Coming soon" tooltip.

**Results server actions** (`lib/results/actions.ts`) [2026-11, uncommitted]: `enterReport` (PA or doctor; Zod-checked; attempt limit `results-entry` first; an optional file is checked by its first bytes, stored in the `documents` bucket at `<patient id>/<uuid>.<ext>`, inserted as a `documents` row of kind `lab_report`, source `staff_upload`, shared with the patient, registered through `register_import`; then `enter_report`; redirects to `/clinic/results/<id>`. If the entry fails after the upload, the file stays in the queue), `saveComments` (doctor; updates `results.doctor_comment` row by row, 1,000 characters each, under RLS) and `releaseReport` (doctor; calls `release_report`; revalidates the clinic and portal layouts; then `tellPatientByEmail` sends the "A new result is ready" email, `resultReadyEmail` through `lib/email/send.ts`, with a link to `${SITE_URL}/portal/results` and no value or verdict. It reads the patient's sign-in email from `profiles` with the service-role client, only after the release has passed the database checks, and skips patients with no account or a suspended one. It also reads `notification_preferences` (topic `results`, channel `email`) with the service-role client and skips the email if `enabled` is false; no saved row counts as on. A failed or unconfigured email never undoes the release: the doctor is told, and the in-portal notice is already saved) [2026-11]. No migration change. Role checks in the actions are a first gate; the functions and RLS decide.

**Server actions** (`lib/auth/actions.ts`): `signIn` (email and password, Zod-checked, attempt limits first, one message for every failure, signs out and shows "no access" if the account has no area, sets `ch_session_kind` and `ch_last_seen`), `requestPasswordReset` (attempt limits first; the screen always says "sent", whether or not the account exists, and adds "If nothing arrives in a few minutes, try again later or contact the clinic."; a Supabase 429 is logged on the server, not shown; the email link goes to `/auth/confirm?next=/update-password`), `updatePassword` (12+ characters, lower, upper, digit; sets `ch_session_kind` and `ch_last_seen`), `signOut` (also clears both `ch_` cookies). `signIn` also reads a hidden `next` field: after the usual checks it redirects to it only if `parseReturnPath` accepts it and the person is staff, otherwise to their home. `/login?next=...` does the same for an already signed-in person; the login form passes `returnPath` as the hidden field.

**Profile server actions** (`lib/profile/actions.ts`) [2026-11, uncommitted]. Every action starts with `requireUser()` (no session or a suspended profile goes to `/login`) and takes the person from the session: no form carries an id. All read and write through the user's own session; none uses the service role except `allowAuthAttempt`.

| Action | What it does |
|---|---|
| `updateDetails` | Zod: name 1 to 120 characters, phone up to 30 of digits, spaces, `+`, `(`, `)`, `-`; updates `profiles.full_name` and `phone` for the person's own row |
| `uploadAvatar`, `removeAvatar` | Photo: declared type jpeg, png or webp, at most 2 MiB, first bytes must match the type; uploads with `upsert` to `avatars/<user id>/avatar`, then sets `profiles.avatar_path`. Remove sets `avatar_path` to null; the file stays |
| `uploadSignature` | Doctors only (`roles` includes `doctor`); same checks at 1 MiB; uploads to `signatures/<user id>/signature`, then sets `staff_profiles.signature_path`; revalidates `/clinic/profile` |
| `changePassword` | Checks new password rules and the match, then the `password-change` limit, then re-checks the current password with `signInWithPassword`, then `updateUser({ password })`, then `signOut({ scope: "others" })`. Supabase's own "password changed" email follows |
| `requestEmailChange` | Same checks and the `email-change` limit, then `updateUser({ email })`. The reply is the same whether or not the address is taken; Auth sends the confirmation emails (double confirm is set; one link was enough locally, `docs/SECURITY.md` S-68). The trigger updates `profiles.email` when confirmed |
| `signOutOtherDevices` | `signOut({ scope: "others" })` |
| `saveNotificationPreferences` | Reads the person's rows; writes only rows that differ, and only `enabled` on an existing row; a missing row counts as on, so only an "off" inserts one. Topics: results, payments, appointments, messages. Channels: email, portal |

Most call `revalidatePath("/", "layout")`, so the name and photo in the top bar refresh. Pages are rendered per request, so this saves nothing and is harmless.

**Data flow of photos and signatures** [2026-11, uncommitted]. The browser posts the form to the server action (there is no browser Supabase client). The action checks the file, then uploads through the person's own session to the private bucket at the one fixed path, so the Storage policies decide again. A page that shows an image asks Storage for a signed URL (3600 seconds) through the viewer's own session, so Storage decides who gets one: the person's own photo, any active staff member's, a patient's photo for the team; a signature only for its owner. The URL goes into the page and the browser loads it from the Supabase origin, which the CSP's `img-src` allows (`NEXT_PUBLIC_SUPABASE_URL`). The top-bar photo comes from the layout (`getAvatarUrl(user.avatarPath)`); the profile page shows its own copy. The doctor's signature is shown only on her Signature tab; letters will read it with the service role in server code when they are built.

**Invitation server actions** (`lib/invitations/actions.ts`, `accept-actions.ts`) [2026-11, uncommitted]. They use the service-role client (`createAdminClient`) after checking who is asking in code; the database functions check the named person again. No form field carries an inviter, a role for a patient, or a hash: the inviter is `getCurrentUser()`, and the kind, role, patient and address of an acceptance come from the invitation row, never from the form.

| Action | What it does |
|---|---|
| `sendInvitation` | (For a patient or guardian invitation, an existing patient or new minimal details, `newPatientSchema`: first and last name, date of birth. Sends `_confirm_email_mismatch` from the `confirmMismatch` checkbox; on the `email_mismatch` hint it returns `needsConfirm` so the form asks the sender to confirm.) `requireInviter` (a PA or admin, not suspended; anyone else goes to `/clinic`), Zod by kind (patient, guardian, team), `kindsFor(roles)`, the `invitation-send` limit, a fresh token, `create_invitation`, then the email through `lib/email/send.ts` with the link `${SITE_URL}/invite?token=…`. If the email variables are missing or Resend fails, the invitation is saved and the form says so ("use Resend") |
| `resendInvitation` | The same checks; reads the invitation through the person's session first (a PA cannot see a team invitation, so it is "not found"), then `resend_invitation` and a new email |
| `cancelInvitation` | `revoke_invitation`. No attempt limit |
| `createAccountFromInvitation` | Reads the invitation from the cookie; refused unless valid and no account exists. Zod: name 1 to 120, the shared password rules, repeat. `invitation-accept` limit. `auth.admin.createUser` with `email_confirm: true` (the link reaching the address is the proof), `checkIdentity` (patient and guardian: the `dob` field through `verify_invitation_identity`; "wrong" and "locked" give their own messages), then `accept_invitation` with `_date_of_birth`, then `signInWithPassword`, `startSessionCookies` (kind `staff` for a team invitation, otherwise `patient`), clears `ch_invite`, and redirects to `/clinic` for a team invitation or `/portal`. `create_invitation` allows one live patient invitation per record, and `get_invitation` reads as `cancelled` for an archived or already-registered patient, so the usual refusals come before the account is made. If acceptance is still refused late, the account stays with status `invited` (`docs/SECURITY.md` S-77, reduced) |
| `signInToAcceptInvitation` | For an invitation whose address has an account: the `sign-in` limit for the address and the `invitation-accept` limit for the link, `signInWithPassword`, session cookies, back to `/invite/accept`. It refuses a suspended account and signs it out (S-78, resolved) |
| `acceptInvitationWhileSignedIn` | The signed-in, not-suspended person; the same `checkIdentity` date of birth; the invitation must be valid and its address equal the person's email (also checked in the database); `invitation-accept` limit; `accept_invitation`; session cookies; clears `ch_invite`; redirects |
| `signOutForInvitation` | Signs the person out and returns to `/invite/accept` |

**Attempt limits** (`lib/auth/throttle.ts`, `allowAuthAttempt`) [2026-11, uncommitted]. Sign-in and reset reach Supabase from this server, so Supabase's own limits cannot tell one visitor from another.

| Action | Window | By address | By address and account | By account |
|---|---|---|---|---|
| Sign-in | 15 minutes | 60 | 10 | 30 |
| Password reset | 1 hour | 20 | 3 | 3 |
| Password change [2026-11, uncommitted] | 15 minutes | 60 | 8 | 20 |
| Email change [2026-11, uncommitted] | 1 hour | 20 | 5 | 5 |
| Invitation send (`invitation-send`; keyed by the inviter's email; send and resend) [2026-11, uncommitted] | 1 hour | 80 | 40 | 40 |
| Results entry (`results-entry`; keyed by the staff member's email) [2026-11, uncommitted] | 1 hour | 300 | 120 | 120 |
| Invitation accept (`invitation-accept`; keyed by the first 40 characters of the link's hash) [2026-11, uncommitted] | 15 minutes | 60 | 10 | 15 |

A refused attempt gets "Too many attempts. Please wait a few minutes and try again.", which says nothing about the account, because the app's own limit treats every address alike. A Supabase 429 on sign-in gets the same message. A Supabase 429 on reset gets the normal "sent" reply and is logged without the address, since Supabase's email limits apply only to real accounts. The address is `x-real-ip`, then the first `x-forwarded-for`; with neither, only the account bucket applies. If the check itself fails, the attempt goes ahead and an error is logged with no email or address: an outage here must not stop people signing in.

**Routing** (`lib/auth/session.ts`): `getCurrentUser` is cached per request and reads the profile, roles and `get_my_patient_record()`. `homePathFor`: suspended gives no area; any staff role gives `/clinic`; otherwise anyone with a patient record (patient or verified guardian) gives `/portal`. The `/portal` and `/clinic` layouts redirect anyone else. A person who is both (the seed doctor-patient) gets a switch link in the shell. These checks only route; row-level security decides what is readable.

**Patient home** (`getPortalHome`): bloods alert bar when an open order has a due date (as briefed), next appointment, bloods card (as in the prototype), new results card from the newest released report, up to four markers at a glance with sparklines (out of range first), latest shared letter with its author named through `get_staff_directory()`, and a running-low medication notice (14 days). Each query also filters to the patient and to released data itself, because a doctor who is also a patient is a clinical reader too.

**Clinic dashboard** (`getClinicHome`): today's count and next appointment, reports to review (and how many have an out-of-range value), imports waiting, an attention list (the marker that matters most per unreviewed report, with the previous released value), the diary for the day filtered by location, and "Bloods at risk" cards for appointments in the next 14 days with an open order. The location is chosen in the URL (`?location=`) by the top-bar switcher [2026-11], not by the prototype's chips. An admin sees no patient data (RLS); a health coach sees no unreleased results.

**API routes**: `/auth/confirm` and `/invite`. Not built: Stripe, lab and sync webhooks.

**Cookies for invitations**: `ch_invite` holds the link's token between the email and the accept page (see `/invite`). It is the only cookie with a path other than `/`. It is cleared when an invitation is accepted, not when an attempt fails; it expires after an hour.

## 7. Environment variables

From `.env.example` and `lib/env.ts`. `.env*.local` is ignored.

| Variable | Scope | Use |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL (local stack: `http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Publishable (anon) key |
| `NEXT_PUBLIC_DEMO` | Public, optional | `true` shows the demo banner |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Used only from `lib/supabase/admin.ts`. Sign-in and reset use it for the attempt limits (without it they fail open). **Invitations [2026-11] cannot be sent, cancelled, looked up or accepted without it** |
| `SESSION_COOKIE_SECRET` | Server only | Signs the `ch_last_seen` and `ch_session_kind` cookies; 32 characters or more (`openssl rand -base64 48`). Read by `getSessionEnv` in `lib/env.ts`. Required: the proxy fails closed without it. Set it in Vercel and `.env.local`; `web-local` sets a fixed local value. Changing it signs everyone out |
| `RESEND_API_KEY` | Server only | Used only from `lib/email/send.ts` and `pnpm email:test`. Invitations and result release call the wrapper [2026-11]; without the key (or `EMAIL_FROM` or `SITE_URL`) an invitation is saved and the screen says email is not set up. Restrict the key to sending on the one domain |
| `EMAIL_FROM` | Server only | Sender address on the domain verified in Resend |
| `SITE_URL` | Server only | Required with the email variables (`z.url`, no trailing slash). Links and the logo in emails are built from it, never from a request. Set it per environment [2026-11] |
| `EMAIL_REPLY_TO` | Server only, optional | Where replies go; `send.ts` falls back to it. Open question: which address (PRD) |

**Environments** [2026-11]. One hosted Supabase project for now, with the local stack as development. `.env.local` points at the hosted project, so `pnpm dev` and the `web` configuration use hosted data. Use `web-local` (port 3130) for the local stack. Agents never connect to the hosted project; a human links and pushes. Password reset on the hosted project is unproven until SMTP is set up.

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
- [2026-11] Profile: patient contact details on the record are read-only in the app ("contact the clinic"); notification channels are email and portal only until GoHighLevel is connected; the sign-in email can be changed by anyone, double-confirmed; signatures are for doctors and live in their own private bucket; photos are for everyone. See the PRD.
- [2026-11] Password and email changes re-check the current password in the app with `signInWithPassword`. That issues a new Auth session and restarts the staff 12-hour total; the Auth API itself does not ask for the password (`docs/SECURITY.md` S-37, S-68, S-72).
- [2026-11] The shell's current nav row is read from the pathname in a Client Component, so the same sidebar works on the profile route.
- [2026-11] The default branch is `main`.
- [2026-11] One hosted Supabase environment for now, with the local stack as development, decided by the owner.
- [2026-11] Email templates are built (section 5) in the design system's look with hex colours, inline styles and system-font fallbacks, because email clients lack CSS variables, oklch and web fonts. Resend, custom SMTP and the hosted Auth templates are still **manual and not done**, waiting on the domain being verified.
- [2026-11] Email links come from `SITE_URL`, not a request header, and no email carries a clinical value.
- [2026-11] Leaked password protection is off, because it needs the Pro plan.
- [2026-11] No browser Supabase client, so the auth cookies can be `HttpOnly`. A Client Component that needs data must go through the server.
- [2026-11] Session limits live in the proxy, because Supabase's time-box and inactivity settings need the Pro plan. It applies only to requests through the proxy, so it cannot stop a token copied out of the browser and used directly against Supabase.
- [2026-11] Attempt limits live in Postgres behind the service role, so they hold across server instances. They fail open, because an outage must not stop people signing in. The address limit is well above the account limits because a clinic shares one address.
- [2026-11] The Content-Security-Policy is built per request in the proxy with a nonce and `strict-dynamic`, so injected script cannot run; styles keep `'unsafe-inline'`. It left `next.config.ts` and costs static rendering of every page.
- [2026-11] The `ch_` session cookies are HMAC-signed and bound to the user and the cookie name; the secret is `SESSION_COOKIE_SECRET` and the check fails closed.
- [2026-11] Service-role writes must name an actor or a system job, so the audit log always says who or what acted.
- [2026-11] Owner decisions: MFA for staff (S-11) and a CAPTCHA (S-32) are deferred until the clinic has accounts to enrol; neither is built. S-13 was verified by the owner.
- [2026-11] Invitations: a person never chooses a token. The server makes 32 random bytes, emails the 43-character base64url form once and stores only its SHA-256. The link goes to `/invite`, which moves the token into an `HttpOnly` cookie and redirects, so it leaves the address bar, history and analytics; the page only reads, so a link scanner cannot use it up. Acceptance is one database transaction. Links last 3 days and work once. An existing account accepts by signing in with the same address. There is no second approval (PRD open question). The service role is used for the writes, with the person named in every call (`docs/SECURITY.md`, Documented decisions).
- [2026-11] A separate `web-local` configuration on port 3130 rather than changing `.env.local`, so the local stack is available while `.env.local` stays on the hosted project.

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
5. [2026-11] The prototype sign-in panel uses a gradient; the design system and brief forbid gradients. Photography behind a flat `surface-inverse` overlay is used instead (the Imagery rule in the reference README).
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
19. [2026-11] `private.in_scope()` is an open question: it admits any clinical staff member, so `care_team` does not yet limit access. `docs/SECURITY.md` S-10 tracks it. Since `20261102150000` the policies on the care team, patient profile, guardian link, safeguarding alert, repeat request and result import tables call it, so deciding the question is a change to the function alone.
20. [2026-11] Resolved: Phase 6 was committed in `c831ccf`. Sections 4 to 8 now describe the working tree, and what is uncommitted is marked.
21. [2026-11] Resolved: `docs/SECURITY.md` was updated in its third review (S-31 to S-56). It now tracks the unsigned `ch_` cookies (S-31), the account bucket that can block a named person (S-49) and the easily rotated address limits (S-51) and the deferred leaked-password and SMTP decisions in its checklist. The `/auth/confirm` and reset-reply behaviour above follows its S-46 and S-47 fixes; whether S-46 and S-47 are marked resolved there is for `security-reviewer`.
22. [2026-11] Resolved: see 21.
23. [2026-11] Resolved: see 21.
24. [2026-11] Resolved: see 21.
25. [2026-11] `web-local` runs on port 3130, but `supabase/config.toml` has `site_url` and `additional_redirect_urls` on port 3000 only, and `supabase/templates/recovery.html` builds its link from `{{ .SiteURL }}`. A local password reset email started on 3130 therefore links to port 3000, where only the `web` configuration (hosted) can be listening.
26. [2026-11] `proxy.ts` still excludes `favicon.ico` from its matcher, though `app/favicon.ico` is gone. Harmless: `.png` is excluded too.
27. [2026-11] Resolved: `docs/PRD.md` and `docs/DESIGN-SYSTEM.md` no longer call Phase 6 uncommitted.
28. [2026-11] `SESSION_COOKIE_SECRET` is a new required variable. Until it is set in Vercel and `.env.local`, every signed-in request fails closed. A hosted deploy of the uncommitted work without it would lock everyone out.
29. [2026-11] `docs/SECURITY.md` is being edited by another agent in this pass; whether S-07, S-10, S-11, S-12, S-13, S-31 and S-32 are marked as the owner decided is for `security-reviewer`. This document states the decisions as given.
30. [2026-11] The two Vercel scripts are new third-party-operated code on a clinical portal. `docs/SECURITY.md` S-63 tracks the data processing terms, PECR and the privacy notice, which are for the owner. `public/pics/about-clinic-door.png` is 7.5 MB in the repository; compress it.
31. [2026-11] `/knowledge-base` is for admins only (PRD open question 11 answered, question 12 asks whether doctors should get access); `docs/SECURITY.md` S-64 tracks what remains. `isAdmin` does not check the active staff profile, and the access table drifts when policies change. The page reads its Markdown with `fs`, which depends on Vercel including `content/` in the deployment; confirm on the first deploy. The file mirrors a claude.ai document, so the two can drift: this repository's copy is the one the page shows. Not yet tested: a foreign `next` through the form, a production build of this change, a suspended or inactive admin signing in.
32. [2026-11] The email domain is spelled `schoemanclinic.systemizedtoscale.com` (with a z) in `.env.example` and `supabase/config.toml` comments, while the owner's own domain is `systemisedtoscale` (with an s). The owner must confirm which spelling DNS uses before the Resend domain is added; a wrong one breaks the sender and every link.
33. [2026-11] `supabase/templates/*.html` are generated from `lib/email/templates/auth.ts` by `pnpm email:build`. Edit the TypeScript and rebuild; the generated HTML drifts if edited by hand. The hosted dashboard holds its own pasted copy, which also drifts.
34. [2026-11] The result-ready email is now sent from Clinic Hub on release (`resultReadyEmail`), while the PRD may still leave result reminders to GoHighLevel: the owner should confirm the two do not double up. `guardianAccessEmail` is still not wired to any flow. Release emails use the service role (read of `profiles.email`) from a server action, which `docs/SECURITY.md` should cover.
35. [2026-11] Not verified: a real Resend send, rendering in Outlook, Gmail and Apple Mail, dark mode in mail clients, SPF, DKIM and DMARC, the hosted Auth templates and SMTP, and that the logo URL is reachable on the production domain. On the local stack the first email-change link completed the change although `double_confirm_changes` is true; the copy says to confirm a second email if one arrives.
36. [2026-11] The Profile screens are built and uncommitted. `docs/SECURITY.md` S-23 is resolved by the new trigger. New findings S-68 to S-73 (an email change completes on one link; the Auth API reveals whether an address has an account; the `avatars` bucket takes any file name; the database does not limit name and phone length; small points on re-authentication, the throttle and a fragile test; body size) are for the owner and `security-reviewer`. S-37 now also covers the password change through the Auth API.
37. [2026-11] React hydrates the profile page on the first interaction, because the tabs sit inside the route's loading boundary, so a script-driven `requestSubmit` before any click posts the form natively. A person clicks first, so they are not affected. A successful action resets uncontrolled form fields, so the email-change form clears after sending. The success messages of separate forms in one tab can show at the same time.
38. [2026-11] A removed or replaced photo's file stays in storage, as there is no delete policy. The next `avatars` policy change should limit the name to `<id>/avatar` (S-70).
39. [2026-11] The first email-change link finished the change locally although `double_confirm_changes` is true (S-68). The hosted project may behave the same. The old address now gets the email-changed notice (verified locally). The form's success message says only "Follow the link to finish the change."
40. [2026-11] `20261104120100_signatures_bucket.sql` sets a bucket by SQL, so on a hosted project it exists only after a human applies the migration. The `signatures` policies name one file, so nothing else can be stored there.
41. [2026-11] `04_profile.test.sql` fails if a signature object already exists locally for the seed doctor. Run `pnpm db:reset` first, or empty the bucket.
42. [2026-11] `docs/reference/` was not changed. Nothing in the schema draft covers a signatures bucket; it is an addition (4.14 lists the other departures).
43. [2026-11] Invitations are built and uncommitted. `docs/SECURITY.md` (tenth run) resolves S-43 and adds S-74 to S-85: the link is the only check on a patient or guardian record and on a staff role (S-74), a PA or an admin can bind any record to any address (S-75, S-42), scope is not enforced in the server-called functions (S-76), a late acceptance failure can leave an `invited` orphan account (S-77, reduced by one live patient invitation per record), the accept page's sign-in skipped the no-access check (S-78, since resolved), and the rest.
44. [2026-11] The Team screen's nav item and metadata say "Team and settings", but the page is "Team invitations" and manages invitations only; existing members are not listed or editable. Not built (PRD open question).
45. [2026-11] `Referrer-Policy: no-referrer` set in `app/(auth)/invite/route.ts` is overridden by the `next.config.ts` header, so the response carries `strict-origin-when-cross-origin` (S-82). The redirect target holds no token, so nothing leaks today.
46. [2026-11] `lib/data/invitations.ts` reads `invitations` through the session; the screen's patient names for existing-patient invitations come from `get_invitable_patients`, so an invitation for a patient outside a PA's scope shows "a patient" (the read policy hides it anyway).
47. [2026-11] `lib/invitations/constants.ts` is imported by the shell (`nav.tsx`) for the `AppRole` type only; the type could live in a neutral file.
48. [2026-11] The seed holds two demo invitations (`claire.benson@example.test`, pending; `new.doctor@example.test`, expired) with hashes that no token can produce; they show on the Team screen and can be resent, which with email set up would send a real message to an `example.test` address.
50. [2026-11] `20261105130000_invitation_identity.sql` closes S-74 (a link alone no longer opens a record: the date of birth is also needed, five wrong dates cancel it) and eases S-75 (an address that differs from the record needs confirmation). The sign-in form (`SignInToAcceptForm`) has no date field; the date is asked on the signed-in confirmation step. A guardian invitation's date is the patient's, which a guardian may not know. `verify_invitation_identity` is the only counter, called by the create-account and signed-in actions before `accept_invitation`; the date is checked again inside `accept_invitation` but a wrong date there is not counted.
49. [2026-11] The local `db:test` counts seed rows, so it fails (10 tests in `01_role_matrix` and `05_invitations`) on a database that other work has written to. Run `pnpm db:reset` first.
51. [2026-11] `lib/results.ts` (flag display helpers) and the folder `lib/results/` (server actions) share a name. `@/lib/results` resolves to the file today, but a future `lib/results/index.ts` would make it ambiguous. Consider renaming one.
52. [2026-11] `20261109120000` adds the first writes to `lab_reports`, `results`, `result_imports` and `notifications` for staff, through definer functions, and a patient-origin path (`register_import`) that `docs/SECURITY.md` has not reviewed. `security-reviewer` should cover: `enter_report` accepting any `_document_id` filed under the patient (not checked against `kind` or `uploaded_by`), the `register_import` branch for a PA or doctor with `patient_id` null (`unmatched/` files), the actions' `friendly()` passing database messages to the screen, and the 11 MB body limit now applying to every server action.
53. [2026-11] The conversion factors are standard values entered by the migration, not the clinic's own, and `marker_conversions` has no screen: only an admin can change it, in SQL. A lab unit spelt differently from a `from_unit` gets "There is no conversion".
54. [2026-11] The build prompt and `docs/reference/schema-draft.md` do not mention `marker_conversions`, `original_value`, `original_unit` or the `staff_upload` source; they are additions to the draft (add to 4.14 if the draft is revised). The draft's `import_items` table is not used by the new flow: staff type the values in, so no `import_items` rows are written.
55. [2026-11] The proxy builds `?next=` from `parseReturnPath(pathname)`, so the new path returns correctly after sign-in; the proxy line in section 5 still describes only `/knowledge-base`. `docs/SECURITY.md` S-64 and the PRD should mention the second page. Not tested: a signed-out visit to `/knowledge-base/test-results`.
