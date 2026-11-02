# Clinic Hub security review

Owned by the `security-reviewer` subagent. Clinic Hub holds special-category health data, so every gap matters. A finding stays OPEN until the code changes or a human accepts the risk.

## Changelog

- [2026-11] First review, Phase 4: database (`supabase/migrations/`, `supabase/tests/`, `supabase/seed.sql`, `supabase/config.toml`, `supabase/templates/`), plus `next.config.ts`, `lib/env.ts`, `lib/supabase/`, `lib/email/`. Reviewed the uncommitted migrations staged on `feat/foundation` at commit `2ea4d31`.

## Executive summary

No CRITICAL finding. A patient or guardian could not reach another patient's data or an unreleased result through PostgREST, RPC, embedded joins or Storage in any attack tried. `anon` reads nothing. Nobody can write their own role.

The weak points are on the staff side and in the seams with server code that is not built yet:

- **Five HIGH findings.** A PA can open the release gate on a lab PDF (S-01). A PA can create a verified guardian link for any account with a forged verifier, which also allows forged consents (S-02). Invitation rows take a token hash and expiry chosen by the client (S-03). Deactivating a staff member does not remove their access (S-04). Server code cannot update `staff_profiles` at all, and it cannot deactivate anyone (S-05).
- **Fix before building** the invitation, release and import server code: S-03, S-07, S-08 and S-09 set what that code must do.
- **All are OPEN.** No migration has been changed by this review.

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 5 |
| MEDIUM | 8 |
| LOW | 12 |
| INFO | 5 |

### Test results [2026-11]

Run against the local stack only.

| Command | Result |
|---|---|
| `pnpm db:lint` | No schema errors |
| `pnpm db:test` | PASS, 2 files, 138 tests |
| `pnpm db:advisors` | No issues |

These pass with every finding below present, so the suite does not cover them. Each HIGH and MEDIUM fix should come with a pgTAP test.

### How claims were verified

"Verified" means the attack was run against the running local database with `psql`, in a rolled-back transaction, under `set local role authenticated` with `request.jwt.claims` set to a seed user. Data API and Storage attacks used read-only HTTP requests with a locally minted token. "From the code" means justified by reading the code, not executed. `audit_log` stayed at 179 rows and `storage.objects` at 0 afterwards.

## Findings

### HIGH

#### S-01 A PA or doctor can open the release gate by changing `documents.kind`

- **Status:** OPEN
- **Files:** `20261102111720_rls_policies.sql` (documents policies), `20261102111731_grants_hardening.sql` (`grant update (kind, ...)`)
- **Risk:** The gate on lab PDFs is `kind <> 'lab_report' or private.document_report_released(id)`, and `kind` is client-writable. Verified: as a PA, `update documents set kind = 'letter'` on seed document `...0005`, whose report is unreleased and which has `shared_with_patient = true`. Eleanor then read the row and the file's `storage.objects` row, while `lab_reports` still hid the report. The health coach's gate opened the same way. This breaks "patients see a lab report only after release", and release is a doctor's act done through server code. It can happen by accident, for example when refiling a document.
- **Fix:** Revoke `update (kind)` from `authenticated`, or add `kind` to `documents_reject_client_changes`. Also consider a trigger rejecting `shared_with_patient = true` on any document linked from an unreleased `lab_reports` row, whatever its kind, so that the gate depends on the link and not on a label. A PA uploading a copy as `kind = 'other'` remains possible (verified) and can only be reduced by procedure and the audit log.

#### S-02 A PA can create a verified guardian link for any account, with a forged verifier

- **Status:** OPEN
- **Files:** `20261102111720_rls_policies.sql` (`patient_guardians` insert and update policies)
- **Risk:** The check is only `has_role('pa')`, so `verified_by` and `guardian_user_id` are unconstrained. All verified:
  - A PA linked patient Thomas to Eleanor with `verified_by` set to Dr Schoeman. Thomas then read Eleanor's 30 results and 3 medications.
  - A PA linked herself with `can_act`, then inserted a research consent for Eleanor and asked a question as her guardian.
  - A PA rewrote `verified_by` on an existing link to a different staff member.

  One person can disclose a whole record, and the record of who verified it can be false. Once `in_scope` narrows, self-linking also escapes it through `my_patient_ids()`.
- **Guardians themselves cannot self-verify.** Verified: Mark's update of his own `verified_by`, `can_act` and an insert of a new link were all refused or matched no row. An unverified link gives nothing.
- **Fix:** In both policies, add `(verified_by is null or verified_by = (select private.my_staff_id()))` and `guardian_user_id <> (select auth.uid())`. Consider a second approver for `can_act`.

#### S-03 Invitation rows take a client-chosen token hash and expiry

- **Status:** OPEN
- **Files:** `20261102111657_identity_and_accounts.sql`, `20261102111720_rls_policies.sql`, `20261102111731_grants_hardening.sql` (`grant insert (... token_hash, expires_at)`)
- **Risk:** Verified: a PA inserted an invitation with `role = 'patient'`, `patient_id` of a patient who already has an account, an address of her choosing, an empty `token_hash` and `expires_at = 9999-01-01`. An admin inserted `role = 'doctor'` and `role = 'admin'` invitations the same way. The inviter therefore knows the token and it need never expire. Clients cannot revoke a row. An expired pending row keeps blocking that address through `invitations_one_pending_per_email` (verified).

  The acceptance server function is not built, so the end of this chain is from the code. Unless acceptance guards against it, a PA could bind an account they control to any patient record, and a suspended admin could later accept a stored invitation for a team role. It also gives an admin a route to clinical access through a second address, against the decision that admin is not clinical staff.
- **Fix:** Remove the client insert grant and create invitations only in server code, which generates the token, hashes it and sets a short expiry. Add `check (expires_at <= created_at + interval '14 days')` and a non-empty hash check. Acceptance must check expiry, that the inviter is still active, that `patient_profiles.user_id` is empty, and that the signed-in email matches. Decide whether team-role invitations need a second approver.

#### S-04 Deactivating a staff member does not remove their access

- **Status:** OPEN
- **Files:** `20261102111718_helper_functions.sql` (`has_role`, `is_clinical_staff`, `is_team`)
- **Risk:** These helpers read only `user_roles` and `profiles.status`. Verified: with `active = false` and `archived_at` set on the PA's `staff_profiles` row, she still read 11 patient profiles, 65 results and 8 documents, changed a guardian link and changed a document's kind. Only `my_staff_id()` stops, so only writes attributed by staff id fail. An admin who deactivates a leaver reasonably believes access has ended.
- **Fix:** Make the staff roles in `has_role`, `is_clinical_staff` and `is_team` also require an active, unarchived `staff_profiles` row, or define one offboarding server function that suspends the account, removes roles and deactivates the row in one transaction. Test it in `01_role_matrix`.

#### S-05 Server code cannot update `staff_profiles`

- **Status:** OPEN
- **Files:** `20261102111720_rls_policies.sql` (`private.protect_staff_columns`)
- **Risk:** Verified: as `service_role`, `update public.staff_profiles set job_title = ...` fails with `permission denied for function has_role`. The trigger's condition is `current_user = 'authenticated' and not private.has_role('admin')`. Postgres checks execute permission when it prepares the expression, before the `and` can short-circuit, and `service_role` has no execute on that function. Server code therefore cannot deactivate staff, or write `ghl_user_id` and `semble_user_id`, which only it may write. Migration comments say server code is not affected. `protect_profile_columns` avoids this by nesting its `if`, and a `service_role` update of `profiles` works (verified).
- **Fix:** Nest the check as in `protect_profile_columns`. Add a test that updates `staff_profiles` as `service_role`.

### MEDIUM

#### S-06 Attribution columns are not bound to the caller

- **Status:** OPEN
- **Files:** `20261102111720_rls_policies.sql`, `20261102111731_grants_hardening.sql`
- **Risk:** Verified: a doctor set `medications.prescriber_id` to another doctor on insert and update, and a PA set `result_imports.handled_by` to a doctor. A staff member set their own `signature_path` to a path under another person's id. No signature bucket exists yet, so the effect of that one depends on how letters are built.
- **Held:** `documents.uploaded_by` cannot be spoofed (verified: insert refused by policy, update refused by grant and trigger). Nor can `lab_orders.ordered_by`, `invitations.invited_by`, `safeguarding_alerts.added_by`, `repeat_requests.requested_by` or `questions.asked_by`.
- **Fix:** Bind `handled_by` to `my_staff_id()` in the `with check`. Bind `prescriber_id` the same way, or to a row whose role is doctor if a doctor may record for a colleague. Constrain `signature_path` to start with the user's own id.

#### S-07 Service-role writes reach the audit log with no actor

- **Status:** OPEN
- **Files:** `20261102111725_audit_triggers.sql`, `lib/supabase/admin.ts`
- **Risk:** `write_audit_log` takes the actor from `auth.uid()`, which is empty for the service role. Verified: a release (`lab_reports`) and a role grant (`user_roles`) through `service_role` wrote rows with empty `actor_id` and `actor_role`. Release, role grants and import confirmation are exactly the actions meant to go through server code. `profiles` has no audit trigger, so suspensions are not recorded. Nor do `locations`, `lab_panels` (prices), `markers` or `lab_partners`. Reads are not audited at all, although the table comment says "viewed".
- **Fix:** Have server functions pass the actor, for example with a `set_config('app.actor_id', ...)` read by the trigger inside one transaction, or write their own row with the real actor. Add triggers to `profiles` and the reference tables. Decide how "viewed" gets written.

#### S-08 Import rows and report links can cross patients

- **Status:** OPEN
- **Files:** `20261102111711_labs_and_results.sql`, `20261102111720_rls_policies.sql`
- **Risk:** All verified:
  - A PA changed `result_imports.patient_id` on an import whose document belongs to a different patient.
  - A PA moved a `confirmed` import back to `matched` and re-pointed it. The `with check` limits the new status but not the old one, so a confirm could be repeated.
  - `lab_reports.document_id` accepts a document of another patient, because there is no composite key, unlike `results`.
  - A released report for patient A pointing at a document of patient B opened the gate on B's unreleased PDF, because `document_report_released` only asks whether any released report links it. Two reports sharing one document behave the same.

  The result can be values filed on the wrong patient, a clinical safety problem as well as a disclosure.
- **Fix:** Add `using (status <> 'confirmed')` to the update policy. Add a composite foreign key from `lab_reports (document_id, patient_id)` to `documents (id, patient_id)`, and make `document_report_released` require that no unreleased report links the document. The confirm function must check the import's patient against the document.

#### S-09 A patient can claim a file that has no `documents` row yet

- **Status:** OPEN
- **Files:** `20261102111720_rls_policies.sql` (documents insert), `20261102111728_storage.sql`
- **Risk:** Reading a file requires only a row the caller can read with the same `storage_path`. Verified: with an object at `<patient id>/orphan-staff-upload.pdf` and no row, Eleanor could not see it, then inserted a `patient_upload` row with that path and could. The target is any object in her own folder uploaded before its row exists, or left orphaned by a failed write. Guessing is plausible if paths are predictable: seed path `.../tdl-sch-1000139.pdf` uses the barcode, which patients can read on `lab_orders`. The unique constraint protects a path once it has a row, but that gives a small oracle: a refused insert tells the patient a hidden path exists (verified). Patients cannot write outside their own folder, overwrite, rename or delete (verified).
- **Fix:** In the patient branch of the insert policy, require that the path carries a server-issued random component, or check `storage.objects.owner_id` for any existing object. Server code should create the row before the object, and use random file names.

#### S-10 `in_scope` is not applied everywhere, so narrowing it will leave gaps

- **Status:** OPEN (decision needed from the clinic: access scope is open question 1 in `docs/PRD.md`)
- **Files:** `20261102111718_helper_functions.sql`, `20261102111720_rls_policies.sql`
- **Risk:** `in_scope` returns true for all clinical staff until the clinic answers, so every doctor, PA and health coach reads every patient. The comment says that when decided "no policy needs to change". That is wrong. These do not call it: `patient_profiles` insert and update, `care_team` writes, `patient_guardians` writes, `repeat_requests` insert (verified: a PA inserted a request for an arbitrary patient, with `requested_by` forced to herself, a medication that must belong to that patient and the default fee), `result_imports`, `import_items`, `safeguarding_alerts`, `invitations`. A PA can also add herself to `care_team` for any patient (verified), which would defeat a care-team rule.
- **Fix:** Before narrowing, add `in_scope` to each policy where it should apply, and decide who may change `care_team` for themselves. Correct the comment.

#### S-11 MFA for staff cannot be enforced as built

- **Status:** OPEN
- **Files:** `supabase/config.toml` (`[auth.mfa.totp]` off), `20261102111720_rls_policies.sql`
- **Risk:** From the code: no policy or helper reads the `aal` claim, and local TOTP enrolment is off. Turning MFA on in the hosted dashboard lets staff enrol but does not require it, so a stolen staff password still reads every patient.
- **Fix:** Turn on TOTP in `config.toml`, and require `aal2` for staff, in the helpers or in a restrictive policy, once the enrolment screen exists.

#### S-12 CSP allows inline scripts

- **Status:** OPEN (future work)
- **Files:** `next.config.ts`
- **Risk:** `script-src` includes `'unsafe-inline'`, which removes the CSP's main protection against script injection. The session cookies must be readable by the browser client, so injected script could act as the user. The cause: the proxy only refreshes the session and redirects, so it does not issue nonces.
- **Fix:** Add nonces in the proxy, or use Next's hash-based option, and remove `'unsafe-inline'`.

#### S-13 Sign-up must be off in the hosted project

- **Status:** OPEN (not verifiable from here)
- **Files:** `supabase/config.toml`
- **Risk:** Off locally (verified: `/auth/v1/settings` reports `disable_signup: true`). The hosted project has its own setting. If it is on, anyone could create an account. They would get no role, but could read reference data and the staff directory, including names, titles and ids.
- **Fix:** See the manual checklist.

### LOW

| ID | Finding | File | Evidence and fix | Status |
|---|---|---|---|---|
| S-14 | External ids are readable by patients on tables other than `patient_profiles`: `lab_orders.stripe_checkout_id`, `appointments.external_id`, `medications.semble_prescription_id`, `repeat_requests.stripe_payment_intent_id` and `ghl_task_id`, `questions.ghl_conversation_id`. Patients also see an order at `results_in` before release, though no values. | Grants migration | Verified. Replace table-wide `grant select` with column grants, and split staff and patient reads if needed. | OPEN |
| S-15 | Archived patients can still act. `is_own_patient` and `can_act_for` ignore `archived_at`, while `my_patient_ids` honours it. | Helper functions | Verified: a question, a consent, a document row and an object were accepted with no `RETURNING`. Add `pp.archived_at is null` to both. | OPEN |
| S-16 | Suspended accounts do not fail every check. They still read their own profile, roles and notifications, the staff directory and reference data, and can update their profile and notifications, upload an avatar and change a staff signature. `my_staff_id` ignores status. | Policies, helpers | Verified. No clinical data is reached, since `results` returned 0. Add the status check to the self-service policies and `my_staff_id`, or correct the comment on `profiles.status`. | OPEN |
| S-17 | Payment and workflow state can be set by staff out of order. A PA moved a request to `sent_to_pharmacy` with no payment id, and an unpaid order to `reviewed` with `price_pence = 1`. Only the direct move to `paid` is blocked. | Grants, `lab_orders` | Verified. Add state-transition triggers, and lock price once a checkout exists. | OPEN |
| S-18 | Patient uploads can state a misleading `source`, `title` and `shared_at`. Accepted: `source = 'tdl'`, title "Lab result from TDL". | Documents insert policy | Verified. Force `source = 'patient_upload'` in the patient branch, and make server code ignore a client `shared_at`. | OPEN |
| S-19 | Upload hygiene: a patient can upload objects with no row and no quota. Type limits rest on the declared content type. Files are not scanned, yet staff will open them. | `20261102111728_storage.sql` | Upload with no row verified at database level; the rest from the code. Add a scan or quarantine step and a per-patient limit. | OPEN |
| S-20 | Definer helpers `report_is_released`, `document_report_released` and `is_staff_user` take any id and do not check `auth.uid()`. A SQL session as `authenticated` gets true or false for any report. | Helper functions | Verified not reachable from the API: `/rpc/...` returned 404, `Accept-Profile: private` and `Content-Profile: private` returned 406. The risk arises only if `private` is ever exposed. Consider a check that the caller may see the patient. | OPEN |
| S-21 | A staff member who is also a patient keeps staff reach over their own record: their own unreleased results and safeguarding alerts, and writing their own diagnoses and medications. | Policies | Writes verified for Dr Bennett; reads from the code. Needs a clinic decision. | OPEN |
| S-22 | `staff_profiles` is not tied to `user_roles`. An admin can add a row for a patient account, who then appears in the staff directory, and whose avatar becomes readable by anyone signed in. An admin can set their own `clinical_role = 'doctor'`, which grants nothing (verified: 0 results). No "last admin" guard: an admin suspended themselves. | Policies | Verified. Never authorise from `clinical_role`. Require a matching staff role on insert. Refuse to suspend the last admin. | OPEN |
| S-23 | `profiles.email` can drift from `auth.users.email`, because only an insert trigger exists and the client cannot correct it. | Identity migration | From the code. Add an update trigger on `auth.users`. | OPEN |
| S-24 | `locations.ghl_calendar_id` is readable by anyone signed in. Reference tables also have full-table insert and update grants for admins, including `id` and `created_at` (a `created_at` change is accepted where no foreign key blocks the row). | Grants migration | From the code, plus attempted id changes refused only by foreign keys. Use column grants, and hide the calendar id behind a view or function. | OPEN |
| S-25 | The recovery email template in `supabase/templates/` applies locally only. Without it, the hosted reset email uses Supabase's default link, not `/auth/confirm`. | `supabase/templates/recovery.html` | From the code. See the manual checklist. | OPEN |

### INFO

| ID | Note | Status |
|---|---|---|
| S-26 | Admins have no read path to `audit_log`, `webhook_events` or `integration_sync_log` other than server code, though the draft says admins read the logs. No such screen is built. | OPEN |
| S-27 | Any signed-in user gets the PostgREST OpenAPI description at `/rest/v1/`: 32 paths, with table and column names including `token_hash`. Anon gets an empty description. It exposes structure, not data. | OPEN |
| S-28 | `service_role` keeps `delete` and `truncate` on `invitations`, `notifications`, `notification_preferences` and reference tables, and can append any row to `audit_log`. `postgres` owns `audit_log`, so a migration could re-grant or drop the triggers. Both are outside what a signed-in user can do. | OPEN |
| S-29 | The proxy matcher skips paths ending in an image extension, so `/clinic/x.png` gets no session refresh or redirect. Server layouts must check for themselves, as `CLAUDE.md` already requires. | OPEN |
| S-30 | A signed URL keeps working until it expires, even after a document is unshared. Keep expiries short when the signed URL code is written. Not built yet. | OPEN |

## What was attacked and held [2026-11]

All verified unless marked.

- **Other patients' data:** direct reads and filters returned nothing on results, reports, documents, medications, diagnoses and guardian links.
- **Unreleased results:** `lab_reports` and `results` by id returned `[]` over HTTP. Embeds from `lab_orders` to `lab_reports`, `documents`, `patient_profiles` and `staff_profiles` returned only released reports and nulls.
- **Other schemas:** `private`, `auth` and `storage` profiles were refused with 406. GraphQL was refused. Public `/rpc/` has only two no-argument functions, and neither is `SECURITY DEFINER`.
- **Storage:** private buckets, `object/public` refused, listing returned nothing, signing an unreadable path failed. Writes to another patient's folder and `unmatched/` were refused. No patient overwrite or rename. No bucket creation.
- **Roles:** no signed-in user can write `user_roles`. A doctor or PA cannot change their own `clinical_role`, `gmc_number`, `active` or `archived_at` (trigger). Own `status` and `email` changes refused.
- **Escalation by invitation:** a PA cannot invite `admin` or `doctor`, or spoof `invited_by`. A suspended PA cannot insert an invitation.
- **Payment and values:** patients cannot set `fee_pence` or `status`. Repeat requests for another patient, or a medication of another patient, are refused. A PA cannot set `paid`. A result value cannot be changed from the client.
- **Safeguarding:** PA, health coach, admin, patient and guardian all read zero rows.
- **Audit log:** no client access; `postgres` and `service_role` cannot update, delete or truncate. Metadata holds column names only.
- **Admin:** reads no `patient_profiles`, `results`, `documents`, `questions` or guardian links.
- **Catalogue:** RLS enabled and forced on all 32 tables, no `FOR ALL` policy, no `CASCADE` or `SET NULL`, every function sets `search_path`. `authenticated` has no `create` on any schema. No table in the `supabase_realtime` publication. A new table or function in `public` starts with no grants, but also with RLS off, which `00_schema_checks` would catch.
- **App code:** `lib/supabase/admin.ts` and `lib/email/send.ts` start with `import "server-only"`, and no committed file imports either from a Client Component. `lib/env.ts` reports variable names only. `.env.local` is ignored and untracked. No secret found in tracked files in scope. The seed uses only `@example.test` addresses.

## Not reviewed in this run

- Uncommitted files in `app/` and `components/` (auth screens and dashboards, being written by someone else). The next run must check `app/auth/confirm`: `recovery.html` sends `next=/update-password`, so that route must accept only same-site relative paths. Also check sign-in and reset messages for account enumeration, and layout role checks.
- Server actions and functions for invitations, release, import confirmation and webhooks: not built.
- Actual uploads through the Storage API, because they would have left data. Storage policies were tested at database level only.
- The hosted project: never connected to.

## Documented decisions

- [2026-11] **Admin is deliberately not clinical staff.** `is_clinical_staff` excludes admin, and tests confirm no clinical reads. Admins do read all `profiles`, `care_team` links and `invitations.patient_id` (verified: 11, 12 and 3 rows), so they can see who is a patient and who cares for them. See S-03 for the route around this decision. Open question 2 in `docs/PRD.md`.
- [2026-11] **`in_scope` is open until the clinic answers.** See S-10. Open question 1 in `docs/PRD.md`.
- [2026-11] **Roles live in `user_roles`, written only by server code,** never read from the JWT.
- [2026-11] **Definer code lives in `private`,** not exposed through the Data API. `authenticated` needs `usage` on it because policies call the helpers. Hidden columns are served through invoker wrappers in `public`.
- [2026-11] **No hard deletes.** No `delete` for `authenticated` on clinical tables, and none for `service_role` either. No delete policy on Storage.
- [2026-11] **CSP is a starter policy.** Nonces are future work, because the proxy only refreshes the session and redirects. See S-12.

## Manual configuration checklist

A human does these in the hosted project. None can be verified from this repository.

**Before any real data**

- [ ] Auth: "Allow new users to sign up" is off (S-13).
- [ ] Auth: set the recovery email template to the content of `supabase/templates/recovery.html`, with its subject (S-25).
- [ ] Auth: site URL and redirect allow-list hold production URLs only, with no localhost.
- [ ] Auth: leaked password protection is on. Minimum 12 characters, as in `config.toml`.
- [ ] Auth: anonymous sign-ins and manual linking are off, as in `config.toml`.
- [ ] Auth: secure password change and double-confirm email change are on, as in `config.toml`.
- [ ] Auth: MFA for staff is on, and enforced by code (S-11).
- [ ] Auth: custom SMTP through Resend, with a verified sending domain.
- [ ] Project in the London region (`eu-west-2`).
- [ ] Data Processing Agreement signed with Supabase, and with Resend, Vercel and any other processor that sees personal data.
- [ ] Separate dev and prod projects, with separate keys. Real data only in prod.
- [ ] Data API: exposed schemas are `public` only. `private` must never be added (S-20).
- [ ] Never run the seed against a hosted project (no `--include-seed`): it creates accounts, including an admin, with one shared password written in the file.
- [ ] Realtime: no tables in the publication, public channel access off, or disable it if not used.
- [ ] Rotate keys if ever exposed. `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` are set as server-only variables in the host, never with `NEXT_PUBLIC_`.
- [ ] Point-in-time recovery or backups are on, with a tested restore.
- [ ] Network restrictions on direct database connections, with SSL enforced.

**After deployment**

- [ ] Confirm the production response headers, including that `connect-src` has the Supabase origin, since `NEXT_PUBLIC_SUPABASE_URL` must be set when headers are generated.
- [ ] Confirm the domain should be HSTS preloaded before relying on the `preload` directive: it is hard to undo.
- [ ] Rerun the advisors in the dashboard after each migration push.
