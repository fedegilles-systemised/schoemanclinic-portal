# Clinic Hub security review

Owned by the `security-reviewer` subagent. Clinic Hub holds special-category health data, so every gap matters. A finding stays OPEN until the code changes or a human accepts the risk.

## Changelog

- [2026-11] Fourth review, re-test of the S-46 and S-47 fixes and the S-31 extras in the working tree (`lib/supabase/proxy.ts`, `lib/supabase/session-cookies.ts`, `app/auth/confirm/route.ts`, `lib/auth/actions.ts`, `app/(auth)/forgot-password/forgot-password-form.tsx`, `lib/auth/throttle.ts`, the migration comment). S-46 and S-47 resolved. S-31 narrowed and still OPEN: a missing or future `ch_last_seen` and `/clinic` with a patient kind cookie are now refused, but an edited plausible value still works. S-54 and S-55 narrowed and still OPEN. No finding added. Counts: 56 findings, 44 open, 12 resolved.
- [2026-11] Third review, uncommitted session and throttle work: `20261102143000_auth_throttle.sql`, `02_auth_throttle.test.sql`, `lib/auth/throttle.ts`, `lib/auth/actions.ts`, `lib/supabase/session-cookies.ts`, `lib/supabase/proxy.ts`, `lib/supabase/server.ts`, `app/(auth)/login/page.tsx`, and the removal of `lib/supabase/client.ts`. S-33 resolved. S-31 and S-32 partly fixed and still OPEN. Eleven findings added (S-46 to S-56). S-13 annotated with the owner's report. Owner decisions added to the checklist. Corrected the stale statement that the S-09 fix was uncommitted: it is in `a76efe0`.
- [2026-11] S-09 re-tested after `private.storage_object_is_mine` replaced the earlier check: RESOLVED, with S-45 added for what remains. Only S-09 was re-attacked after the database reset; `pnpm db:test` was rerun.
- [2026-11] Second review, Phase 6: re-tested every finding against the migrations in commit `2128195` and later, and reviewed the auth code, proxy, portal, clinic, data layer and shell, including uncommitted Phase 6 files. Eight findings resolved, fourteen added (S-31 to S-44).
- [2026-11] First review, Phase 4: database (`supabase/migrations/`, `supabase/tests/`, `supabase/seed.sql`, `supabase/config.toml`, `supabase/templates/`), plus `next.config.ts`, `lib/env.ts`, `lib/supabase/`, `lib/email/`. Reviewed the uncommitted migrations staged on `feat/foundation` at commit `2ea4d31`.

## Executive summary

No CRITICAL finding, and no HIGH finding is open. A patient or guardian could not reach another patient's data or an unreleased result through PostgREST, RPC, embedded joins or Storage in any attack tried. `anon` reads nothing. Nobody can write their own role.

- **All five HIGH findings are resolved and held under attack:** the lab PDF gate (S-01), forged guardian links (S-02), client-made invitations (S-03), offboarding (S-04) and server updates of `staff_profiles` (S-05). Each fix leaves a smaller follow-on, recorded as its own LOW finding: S-38, S-42 and S-43.
- **The two MEDIUM findings from the third review are fixed in the working tree and held under attack.** A junk or malformed `/auth/confirm` link no longer touches the idle clock, and only a link that verifies starts a new session (S-46). Password reset gives the same "sent" reply for every Supabase 429, which is logged with no address, and only the app's own throttle says "Too many attempts" (S-47). Both are uncommitted, as is the rest of the session and throttle work.
- **The session work is a real improvement, and is not yet a server-side limit.** Auth cookies are `HttpOnly`, last 7 days instead of 400, and the proxy ends sessions at the limits and revokes the refresh token. But the limits are enforced only by the app, on the next request, from unsigned cookies. Deleting `ch_last_seen`, or setting it to a future or non-numeric value, now ends the session, and `/clinic` always uses staff limits. An edited plausible value, or a kind cookie edited on `/portal`, still works for someone with devtools. A copied refresh token kept working past the limit until the app itself saw that session. A page already open stays readable (S-48). S-31 stays OPEN, partly fixed.
- **The throttle works but does not cover the Auth API.** Through the app, limits held, and the correct password was refused once a limit was reached. Direct calls to `/auth/v1/token` with the public key returned 200 at that same moment, and rely on Supabase's per-IP limit, which the local stack does not apply and so was not tested. It fails open silently (S-50). S-32 stays OPEN, partly fixed.
- **S-07 and S-16 are also only partly fixed, as expected, and S-18 is still incomplete:** `source` is forced, but `title` and `shared_at` are still the patient's to set. S-09 is resolved in `a76efe0`. S-33, S-46 and S-47 are resolved in the working tree, not yet committed.
- **The screens are sound on authorisation.** They read only through the user's session. The only service-role use reachable from sign-in is the throttle call, on the server. `/auth/confirm` cannot redirect off-site, and cross-origin server actions are refused. A doctor who is also a patient sees only released results on `/portal` (one gap for letters: S-41).
- **Fix before building** the invitation, release and import server code: S-07, S-43, S-45 and S-53 set what that code must do.

| Severity | Total | Open | Resolved |
|---|---|---|---|
| CRITICAL | 0 | 0 | 0 |
| HIGH | 5 | 0 | 5 |
| MEDIUM | 13 | 8 | 5 |
| LOW | 30 | 28 | 2 |
| INFO | 8 | 8 | 0 |
| **All** | **56** | **44** | **12** |

### Test results [2026-11]

Run against the local stack only.

| Command | Result |
|---|---|
| `pnpm db:lint` | No schema errors |
| `pnpm db:test` | PASS, 3 files, 178 tests |
| `pnpm db:advisors` | No issues |

These pass with every OPEN finding below present, so the suite does not cover them. Each MEDIUM fix should come with a pgTAP test. `isSessionExpired` and the proxy's session handling have no automated test at all.

### How claims were verified

"Verified" means the attack was run against the running local database with `psql`, in a rolled-back transaction, under `set local role authenticated` with `request.jwt.claims` set to a seed user, or `service_role` for server code. Data API and app checks used read-only HTTP requests with a locally minted token, the app being the dev server on port 3000, not a production build. "From the code" means justified by reading the code, not executed. In the second run `audit_log` stayed at 301 rows, `storage.objects` at 0 and `auth.sessions` at 0.

In the third run, "verified" also means real server action requests to the dev server on `http://localhost:3130`, confirmed by its CSP to be using `http://127.0.0.1:54321`, with seed accounts. Idle cookies were aged by editing them in the request. The total limit was tested by backdating one session's row in the local `auth.mfa_amr_claims` table. For S-47, a temporary second container of the same local Auth image was run with only its email settings changed, against the local database, and then removed. Afterwards `audit_log` was still 301 rows and `storage.objects` 0. The sessions and throttle counters the run created were deleted. Global sign-out tests may also have ended other local sessions of the same seed users, and reset requests left test emails in the local mailbox. No remote project was contacted and `.env.local` was not read.

In the fourth run the dev server on port 3130 was started with the local URL and keys in its environment, as in the `web-local` launch configuration, and curl with a cookie jar sent real server action requests and edited cookies. For S-47 a temporary second container of the same local Auth image (`GOTRUE_RATE_LIMIT_EMAIL_SENT=2`, `GOTRUE_MAILER_AUTOCONFIRM=false`, same database) ran behind a small loopback proxy that sent `/auth/v1/*` to it and everything else to the local stack, and the dev server was restarted against that proxy for the test. Valid recovery links came from the local Auth admin `generate_link` endpoint. Afterwards the container, proxy and dev server were stopped, the throttle counters and the sessions the run created were deleted, and `audit_log` was still 301 rows and `storage.objects` 0. Test emails remain in the local mailbox. Eleanor's password was changed and set back to the seed value. No remote project was contacted and `.env.local` was not read.

## Findings

### HIGH

#### S-01 A PA or doctor can open the release gate by changing `documents.kind`

- **Status:** RESOLVED in `2128195` (`20261102111720_rls_policies.sql`, `20261102111718_helper_functions.sql`, `20261102111731_grants_hardening.sql`, `20261102111707_care_and_requests.sql`)
- **Files:** `20261102111720_rls_policies.sql` (documents policies), `20261102111731_grants_hardening.sql` (`grant update (kind, ...)`)
- **Re-test [2026-11]:** `update documents set kind` is refused by grant and trigger. The gate is now `private.document_gate_open`, which depends on the link: with the kind changed to `letter` by the server itself and the report unreleased, Eleanor and the health coach still read nothing, and the same held for the file's `storage.objects` row. Two reports sharing a document stay closed while either is unreleased. Follow-on: S-38.
- **Risk:** The gate on lab PDFs is `kind <> 'lab_report' or private.document_report_released(id)`, and `kind` is client-writable. Verified: as a PA, `update documents set kind = 'letter'` on seed document `...0005`, whose report is unreleased and which has `shared_with_patient = true`. Eleanor then read the row and the file's `storage.objects` row, while `lab_reports` still hid the report. The health coach's gate opened the same way. This breaks "patients see a lab report only after release", and release is a doctor's act done through server code. It can happen by accident, for example when refiling a document.
- **Fix:** Revoke `update (kind)` from `authenticated`, or add `kind` to `documents_reject_client_changes`. Also consider a trigger rejecting `shared_with_patient = true` on any document linked from an unreleased `lab_reports` row, whatever its kind, so that the gate depends on the link and not on a label. A PA uploading a copy as `kind = 'other'` remains possible (verified) and can only be reduced by procedure and the audit log.

#### S-02 A PA can create a verified guardian link for any account, with a forged verifier

- **Status:** RESOLVED in `2128195` (`20261102111720_rls_policies.sql`)
- **Files:** `20261102111720_rls_policies.sql` (`patient_guardians` insert and update policies)
- **Re-test [2026-11]:** refused: a link naming another verifier, a PA linking herself (verified or not), rewriting the verifier, changing `guardian_user_id`, a second PA changing a colleague's link while keeping her name, and a deactivated PA. Follow-on: S-42.
- **Risk:** The check is only `has_role('pa')`, so `verified_by` and `guardian_user_id` are unconstrained. All verified:
  - A PA linked patient Thomas to Eleanor with `verified_by` set to Dr Schoeman. Thomas then read Eleanor's 30 results and 3 medications.
  - A PA linked herself with `can_act`, then inserted a research consent for Eleanor and asked a question as her guardian.
  - A PA rewrote `verified_by` on an existing link to a different staff member.

  One person can disclose a whole record, and the record of who verified it can be false. Once `in_scope` narrows, self-linking also escapes it through `my_patient_ids()`.
- **Guardians themselves cannot self-verify.** Verified: Mark's update of his own `verified_by`, `can_act` and an insert of a new link were all refused or matched no row. An unverified link gives nothing.
- **Fix:** In both policies, add `(verified_by is null or verified_by = (select private.my_staff_id()))` and `guardian_user_id <> (select auth.uid())`. Consider a second approver for `can_act`.

#### S-03 Invitation rows take a client-chosen token hash and expiry

- **Status:** RESOLVED in `2128195` (`20261102111720_rls_policies.sql`, `20261102111731_grants_hardening.sql`, `20261102111657_identity_and_accounts.sql`)
- **Files:** `20261102111657_identity_and_accounts.sql`, `20261102111720_rls_policies.sql`, `20261102111731_grants_hardening.sql` (`grant insert (... token_hash, expires_at)`)
- **Re-test [2026-11]:** PA and admin insert and update are refused by grant. `token_hash` cannot be read. A short hash and a long expiry are refused by check constraints. Follow-on: S-43, which holds what the first run listed for acceptance.
- **Risk:** Verified: a PA inserted an invitation with `role = 'patient'`, `patient_id` of a patient who already has an account, an address of her choosing, an empty `token_hash` and `expires_at = 9999-01-01`. An admin inserted `role = 'doctor'` and `role = 'admin'` invitations the same way. The inviter therefore knows the token and it need never expire. Clients cannot revoke a row. An expired pending row keeps blocking that address through `invitations_one_pending_per_email` (verified).

  The acceptance server function is not built, so the end of this chain is from the code. Unless acceptance guards against it, a PA could bind an account they control to any patient record, and a suspended admin could later accept a stored invitation for a team role. It also gives an admin a route to clinical access through a second address, against the decision that admin is not clinical staff.
- **Fix:** Remove the client insert grant and create invitations only in server code, which generates the token, hashes it and sets a short expiry. Add `check (expires_at <= created_at + interval '14 days')` and a non-empty hash check. Acceptance must check expiry, that the inviter is still active, that `patient_profiles.user_id` is empty, and that the signed-in email matches. Decide whether team-role invitations need a second approver.

#### S-04 Deactivating a staff member does not remove their access

- **Status:** RESOLVED in `2128195` (`20261102111718_helper_functions.sql`, `private.is_active_staff`)
- **Files:** `20261102111718_helper_functions.sql` (`has_role`, `is_clinical_staff`, `is_team`)
- **Re-test [2026-11]:** with `active = false` or `archived_at` set, a PA, doctor, health coach and admin all read 0 patients, results, documents and invitations, and writes are refused. Nobody can reactivate themselves. A deactivated doctor who is also a patient keeps only her own patient view. A role with no staff row grants nothing, so the code that grants a staff role must also create that row. Left over: the deactivated person still reaches the clinic shell (S-35) and can change their own signature (S-16).
- **Risk:** These helpers read only `user_roles` and `profiles.status`. Verified: with `active = false` and `archived_at` set on the PA's `staff_profiles` row, she still read 11 patient profiles, 65 results and 8 documents, changed a guardian link and changed a document's kind. Only `my_staff_id()` stops, so only writes attributed by staff id fail. An admin who deactivates a leaver reasonably believes access has ended.
- **Fix:** Make the staff roles in `has_role`, `is_clinical_staff` and `is_team` also require an active, unarchived `staff_profiles` row, or define one offboarding server function that suspends the account, removes roles and deactivates the row in one transaction. Test it in `01_role_matrix`.

#### S-05 Server code cannot update `staff_profiles`

- **Status:** RESOLVED in `2128195` (`20261102111720_rls_policies.sql`)
- **Files:** `20261102111720_rls_policies.sql` (`private.protect_staff_columns`)
- **Re-test [2026-11]:** as `service_role`, updates of `job_title`, `active` and `ghl_user_id` succeed.
- **Risk:** Verified: as `service_role`, `update public.staff_profiles set job_title = ...` fails with `permission denied for function has_role`. The trigger's condition is `current_user = 'authenticated' and not private.has_role('admin')`. Postgres checks execute permission when it prepares the expression, before the `and` can short-circuit, and `service_role` has no execute on that function. Server code therefore cannot deactivate staff, or write `ghl_user_id` and `semble_user_id`, which only it may write. Migration comments say server code is not affected. `protect_profile_columns` avoids this by nesting its `if`, and a `service_role` update of `profiles` works (verified).
- **Fix:** Nest the check as in `protect_profile_columns`. Add a test that updates `staff_profiles` as `service_role`.

### MEDIUM

#### S-06 Attribution columns are not bound to the caller

- **Status:** RESOLVED in `2128195` (`20261102111720_rls_policies.sql`, `20261102111701_team_and_sites.sql`)
- **Files:** `20261102111720_rls_policies.sql`, `20261102111731_grants_hardening.sql`
- **Re-test [2026-11]:** another doctor as prescriber is refused on insert, and the column cannot be updated. `handled_by` naming someone else is refused. `recorded_by` is bound too. A signature under another person's id is refused by check constraint. Follow-on: the constraint reads only the first path segment (S-40).
- **Risk:** Verified: a doctor set `medications.prescriber_id` to another doctor on insert and update, and a PA set `result_imports.handled_by` to a doctor. A staff member set their own `signature_path` to a path under another person's id. No signature bucket exists yet, so the effect of that one depends on how letters are built.
- **Held:** `documents.uploaded_by` cannot be spoofed (verified: insert refused by policy, update refused by grant and trigger). Nor can `lab_orders.ordered_by`, `invitations.invited_by`, `safeguarding_alerts.added_by`, `repeat_requests.requested_by` or `questions.asked_by`.
- **Fix:** Bind `handled_by` to `my_staff_id()` in the `with check`. Bind `prescriber_id` the same way, or to a row whose role is doctor if a doctor may record for a colleague. Constrain `signature_path` to start with the user's own id.

#### S-07 Service-role writes reach the audit log with no actor

- **Status:** OPEN, partly fixed in `2128195` (`20261102111725_audit_triggers.sql`)
- **Files:** `20261102111725_audit_triggers.sql`, `lib/supabase/admin.ts`
- **Re-test [2026-11]:**
  - **Fixed and verified:** with `set_config('app.actor_id', ...)`, a `service_role` release records the real actor and role. A signed-in user cannot spoof it, because `auth.uid()` wins. `profiles` and the reference tables now have audit triggers.
  - **Still to do:** no server function exists yet, and without the setting a write still records an empty actor with no error (verified). So does an invalid id (verified). A `set_config` must share a transaction with the write, so through `supabase-js` it has to live inside one database function (from the code). "Viewed" is still never written.
  - **Fix:** write those functions, and consider rejecting a `service_role` write to a clinical table when no actor is set.
- **Risk:** `write_audit_log` takes the actor from `auth.uid()`, which is empty for the service role. Verified: a release (`lab_reports`) and a role grant (`user_roles`) through `service_role` wrote rows with empty `actor_id` and `actor_role`. Release, role grants and import confirmation are exactly the actions meant to go through server code. `profiles` has no audit trigger, so suspensions are not recorded. Nor do `locations`, `lab_panels` (prices), `markers` or `lab_partners`. Reads are not audited at all, although the table comment says "viewed".
- **Fix:** Have server functions pass the actor, for example with a `set_config('app.actor_id', ...)` read by the trigger inside one transaction, or write their own row with the real actor. Add triggers to `profiles` and the reference tables. Decide how "viewed" gets written.

#### S-08 Import rows and report links can cross patients

- **Status:** RESOLVED in `2128195` (`20261102111720_rls_policies.sql`, `20261102111711_labs_and_results.sql`, `20261102111718_helper_functions.sql`)
- **Files:** `20261102111711_labs_and_results.sql`, `20261102111720_rls_policies.sql`
- **Re-test [2026-11]:** re-pointing an import away from its document's patient is refused. A confirmed import matches no row. `confirmed` cannot be set from the client. A report cannot link another patient's or an unmatched document, by composite foreign key. A document under a report cannot be moved. Follow-on: S-39.
- **Risk:** All verified:
  - A PA changed `result_imports.patient_id` on an import whose document belongs to a different patient.
  - A PA moved a `confirmed` import back to `matched` and re-pointed it. The `with check` limits the new status but not the old one, so a confirm could be repeated.
  - `lab_reports.document_id` accepts a document of another patient, because there is no composite key, unlike `results`.
  - A released report for patient A pointing at a document of patient B opened the gate on B's unreleased PDF, because `document_report_released` only asks whether any released report links it. Two reports sharing one document behave the same.

  The result can be values filed on the wrong patient, a clinical safety problem as well as a disclosure.
- **Fix:** Add `using (status <> 'confirmed')` to the update policy. Add a composite foreign key from `lab_reports (document_id, patient_id)` to `documents (id, patient_id)`, and make `document_report_released` require that no unreleased report links the document. The confirm function must check the import's patient against the document.

#### S-09 A patient can claim a file that has no `documents` row yet

- **Status:** RESOLVED in `a76efe0` (`20261102111718_helper_functions.sql`, `20261102111720_rls_policies.sql`, `20261102111731_grants_hardening.sql`, `private.storage_object_is_mine`)
- **Files:** `20261102111720_rls_policies.sql` (documents insert), `20261102111728_storage.sql`
- **Re-test [2026-11]:** the patient branch of the insert policy now requires an object in the `documents` bucket at that path whose `owner_id` is the caller. All verified in rolled-back transactions:
  - **Refused:** the row-first attack (no object yet), an orphan with no owner, an object owned by a PA, and an object of the same name in the `avatars` bucket.
  - **Still works:** a patient's own upload, and a guardian's upload for the patient they act for.
  - **Oracle:** a hidden path and a free path now give the same refusal on the row. An object upload to an occupied path still fails differently, on the unique key.
  - **Remaining:** S-45.
- **Risk:** Reading a file requires only a row the caller can read with the same `storage_path`. Verified: with an object at `<patient id>/orphan-staff-upload.pdf` and no row, Eleanor could not see it, then inserted a `patient_upload` row with that path and could. The target is any object in her own folder uploaded before its row exists, or left orphaned by a failed write. Guessing is plausible if paths are predictable: seed path `.../tdl-sch-1000139.pdf` uses the barcode, which patients can read on `lab_orders`. The unique constraint protects a path once it has a row, but that gives a small oracle: a refused insert tells the patient a hidden path exists (verified). Patients cannot write outside their own folder, overwrite, rename or delete (verified).
- **Fix:** In the patient branch of the insert policy, require that the path carries a server-issued random component, or check `storage.objects.owner_id` for any existing object. Server code should create the row before the object, and use random file names.

#### S-10 `in_scope` is not applied everywhere, so narrowing it will leave gaps

- **Status:** OPEN (decision needed from the clinic: access scope is open question 1 in `docs/PRD.md`)
- **Files:** `20261102111718_helper_functions.sql`, `20261102111720_rls_policies.sql`
- **Re-test [2026-11]:** the misleading comment is corrected and now points here. The gaps remain: a PA still adds herself to `care_team` and still inserts a repeat request for any patient (both verified).
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
- **Risk:** `script-src` includes `'unsafe-inline'`, which removes the CSP's main protection against script injection. Since [2026-11] the auth cookies are `HttpOnly`, so injected script can no longer read the tokens, but it can still read what the page shows and call server actions as the user. The cause: the proxy only refreshes the session and redirects, so it does not issue nonces.
- **Fix:** Add nonces in the proxy, or use Next's hash-based option, and remove `'unsafe-inline'`.

#### S-13 Sign-up must be off in the hosted project

- **Status:** OPEN. The owner reports public sign-up is off in the hosted dashboard [2026-11]. That is not verifiable from here, as this review does not connect to the hosted project.
- **Files:** `supabase/config.toml`
- **Risk:** Off locally (verified: `/auth/v1/settings` reports `disable_signup: true`). The hosted project has its own setting. If it is on, anyone could create an account. They would get no role, but could read reference data and the staff directory, including names, titles and ids.
- **Fix:** See the manual checklist. To close this, the owner confirms that the hosted `/auth/v1/settings` reports `disable_signup: true` and records that here.

#### S-31 Sessions never expire, and their cookies are long-lived and readable by script

- **Status:** OPEN, partly fixed in the working tree (not committed): `lib/supabase/session-cookies.ts`, `lib/supabase/proxy.ts`, `lib/supabase/server.ts`, removal of `lib/supabase/client.ts`
- **Files:** those above, and `supabase/config.toml` (`[auth.sessions]` commented out)
- **Original risk:** the `@supabase/ssr` defaults applied: `httpOnly: false`, 400 days, no `Secure`, and no time-box or inactivity limit. Someone who closed a browser on a shared clinic computer without signing out left the next person a live staff session, and through S-37 a way to change its password. With `'unsafe-inline'` in the CSP (S-12), injected script could read the tokens.
- **Fixed and verified [2026-11]:**
  - The auth cookie and both `ch_*` cookies are set `HttpOnly`, `SameSite=Lax`, `Max-Age=604800`, at sign-in and on a token refresh (read from the `Set-Cookie` headers).
  - No file imports a browser client any more.
  - Idle past 30 minutes (staff) or 2 hours (patient) gives a redirect to `/login?error=expired`, clears the cookies, and the refresh token then returns 400. A patient at 1 hour stays signed in.
  - A session 13 hours old for staff gives the same result. Refreshing does not move the `amr` timestamp.
  - A missing or unknown kind gets the staff limits. A token with an edited `amr` is refused, as the signature is checked (ES256 locally).
  - An `x-middleware-subrequest` header did not skip the check.
  - `Secure` in production: read from the code only. The main session observed it. This run did not start a production server, because that build may hold the hosted URL.
- **Fixed and verified in the fourth run [2026-11]:**
  - A missing `ch_last_seen`, an empty, non-numeric or negative one, `99999999999`, `1e30`, and a value 5 minutes ahead all gave a redirect to `/login?error=expired`. A value 30 seconds ahead (inside the 1 minute clock-skew allowance) was accepted, as intended. Before, the last two ended the check for good.
  - A staff session with `ch_session_kind=patient` and 1 hour idle is refused on `/clinic` (redirect to `/login?error=expired`). The same cookies on `/portal` are accepted, because the patient limit is 2 hours: see below.
  - Sign-in sets both `ch_*` cookies. A password change sets both again (`staff` was rewritten to `patient` for a patient account, last seen moved to now). A patient idle 1 hour stays signed in on `/portal`, at 2 hours 5 minutes is refused, and with no `ch_last_seen` is refused.
  - A staff session idle 1 hour, with no cookie edited, is refused on `/portal` too, as an unknown or `staff` kind gets staff limits.
- **What remains:**
  - **Bypasses that need nothing but a browser:** none found. S-46 is resolved.
  - **Unsigned cookies, on purpose.** Anyone with devtools on a shared computer can still edit them. Verified in the fourth run: setting `ch_last_seen` to a plausible recent value (for example 1000 seconds ago on a staff session) is accepted, which is the same as resetting the idle clock. A staff session with `ch_session_kind=patient` and 1 hour idle is refused on `/clinic` but accepted on `/portal`, and that request renews `ch_last_seen`, so `/clinic` then returns 200 (verified with a PA: `/portal` gave a redirect to `/clinic`, `/clinic` after it gave 200). Deleting the value, or a future or non-numeric value, no longer works.
  - **A copied token is outside these limits.** The same person can copy the refresh token from devtools. Verified: past the 12-hour limit, it refreshed twice directly against `/auth/v1/token` and read a patient row through the Data API. It was revoked only when the app next saw that session in the browser. A session whose browser never returns is never revoked, as nothing ends it on the server.
  - **The Supabase-side time-box and inactivity settings need the Pro plan** (Supabase docs: "only available on Pro Plans and up"), so no server-side limit exists. Even then they apply to the whole project, not per role.
  - **On-screen data:** S-48. **Actions at excluded paths:** S-53. **How the total limit is measured:** S-54.
- **Fix:**
  - Done: S-46, `ch_last_seen` set at sign-in and password change with a missing or future value treated as expired, and staff limits on any `/clinic` path.
  - Sign the two cookies (or keep the last-seen time and kind on the server, tied to the session id) so that an edited plausible value and the kind edit on `/portal` stop working. Unsigned cookies were a deliberate choice, so this needs a human to accept the risk or change it. Until then, a human must accept it in writing before S-31 can be closed. If the kind cookie stays, apply staff limits to `/portal` for anyone with a staff role.
  - Turn on the Supabase settings once on Pro.

#### S-32 Rate limits count the app server, not the attacker

- **Status:** OPEN, partly fixed in the working tree (not committed): `20261102143000_auth_throttle.sql`, `lib/auth/throttle.ts`, `lib/auth/actions.ts`
- **Files:** those above, and `supabase/config.toml` (`[auth.rate_limit]`)
- **Original risk:** sign-in and reset go through server actions, so the Auth service sees the app server's address for everyone. With no limit in the action, all users shared one limit, and anyone could use it up and block the clinic.
- **Fixed and verified [2026-11]:**
  - Sign-in is limited per 15 minutes to 10 per address and account, 30 per account and 60 per address. Reset is limited per hour to 3 per address and account, 3 per account and 20 per address.
  - 10 wrong passwords from one address then refuse the attempt, and 30 from three addresses then refuse the correct password from a fresh address.
  - The limits apply the same way to an account that does not exist, so the throttle itself reveals nothing. The email's case does not make a new bucket.
  - `anon` and `authenticated` get 401 and 403 on the RPC over HTTP. `private.auth_throttle` cannot be read by either, or by `service_role`. The only `private` function `service_role` can execute is `auth_throttle_hit`, so its new `usage` on the schema adds nothing else. The function is `SECURITY DEFINER` with `search_path = ''`. It has no `auth.uid()` check, which is correct, as only `service_role` may call it.
- **What remains:**
  - **Direct calls do not pass through the throttle.** `/auth/v1/token` and `/auth/v1/recover` take the public key, which is in no way secret. Verified: with the app refusing an account, a direct call with the correct password returned 200. Those calls depend entirely on Supabase's per-IP limit, so a distributed attacker has no per-account limit there.
  - **The hosted shared limit can still be reached.** Calls through the app still all come from the app server's address. The app allows far more from a few client addresses than `sign_in_sign_ups = 30` per 5 minutes would, if the hosted limit is like that. Then everyone gets "Too many attempts".
  - **Not testable here.** The local Auth container has no `GOTRUE_RATE_LIMIT_HEADER`, and 180 sign-ins in a burst through the app got no 429, so no per-IP limit was seen. The sign-in 429 branch has never run. This corrects the earlier reading that `config.toml` sets a working local limit. Treat the hosted behaviour as unknown.
  - Follow-ons: S-49, S-50, S-51, S-52. S-47 is resolved.
- **Fix:** Review the hosted limits (see the checklist). The local Auth image contains handling for an `Sb-Forwarded-For` header, which may let the server pass the client address to Auth: check whether the hosted project supports it, as that would address the shared limit properly. Consider a CAPTCHA on both forms, which Supabase Auth would also apply to direct calls.

#### S-46 Opening `/auth/confirm` clears the idle clock

- **Status:** RESOLVED in the working tree (`lib/supabase/proxy.ts`, `app/auth/confirm/route.ts`, `lib/supabase/session-cookies.ts`), not yet committed
- **Files:** `lib/supabase/proxy.ts` (`NEW_SESSION_PATH`), `app/auth/confirm/route.ts` (`startNewSession`)
- **Original risk:** the proxy skipped the limits on `/auth/confirm` and deleted `ch_last_seen` and `ch_session_kind` before anyone knew whether the link was valid. A staff session idle for 1 hour could be brought back by opening that address with a junk `token_hash`, with no developer tools.
- **Re-test [2026-11]:** a staff session with `ch_last_seen` 1 hour old opened `/auth/confirm` with a junk `token_hash` and `type=recovery`, `type=bogus` or `type=email`, with `code=junk`, and with no parameters. Each gave a redirect to `/login?error=link`, set no `ch_*` cookie, and left `ch_last_seen` exactly as it was. `/clinic` straight afterwards gave a redirect to `/login?error=expired`. A valid recovery link (made through the local Auth admin endpoint) opened on the same idle session set a fresh `ch_last_seen`, deleted `ch_session_kind` and redirected to `/update-password`, which returned 200. The route's `Set-Cookie` headers survive its `redirect()`.
- **Left over, not a finding:** after a valid link the kind is unknown, so staff limits apply until the password is set. Safe, only stricter. The proxy still skips the limits on `/auth/confirm` itself, so an over-limit session is not ended by that request, only by the next one (verified above).

#### S-47 The reset reply reveals an account once the email quota is used up

- **Status:** RESOLVED in the working tree (`lib/auth/actions.ts`, `app/(auth)/forgot-password/forgot-password-form.tsx`), not yet committed
- **Files:** `lib/auth/actions.ts` (`requestPasswordReset`)
- **Original risk:** Auth returns 200 for an unknown address without sending anything, so its email quota can only be used up by a real account. The action showed "Too many attempts" for a 429 and so told the caller which addresses had accounts.
- **Re-test [2026-11]:** against a temporary local Auth container with `GOTRUE_RATE_LIMIT_EMAIL_SENT=2` and `GOTRUE_MAILER_AUTOCONFIRM=false`, behind the loopback proxy described above. Seven resets in a row went through the real server action: an unknown address, five real accounts and another unknown address. All seven returned 200 with the "sent" screen, and none showed "Too many attempts". A direct call to the container confirmed it was limiting: a real account then returned 429 `over_email_send_rate_limit`, and an unknown address returned 200. The server log held one line, "Password reset email limited by Supabase.", for each of the three real accounts that were limited, with no address in it. The app's own throttle still works: through the app, the fourth reset for one account from one address in an hour showed "Too many attempts", which is the same for any address. The "sent" screen now ends with "If nothing arrives in a few minutes, try again later or contact the clinic."
- **Left over:**
  - The log line has no alert on it (S-50 applies in the same way). A real person whose reset is limited gets no email and a "sent" screen, so the new wording is their only help.
  - The action ignores every Supabase error, not only 429, and logs only the 429. A 500 or a network failure gives "sent" with nothing in the log. Log any error, still with no address.
  - Reset timing may still differ for a real account: S-34.

#### S-48 A page already open stays readable after the limits pass

- **Status:** OPEN
- **Files:** `lib/supabase/proxy.ts`, `components/shell/`
- **Risk:** From the code: the limits are checked only when a request arrives, and no browser timer exists. Someone who walks away from a clinic computer leaves whatever is on screen readable until somebody clicks, however long that is. The 30-minute limit protects the next request, not the screen. A later request ends the session (verified).
- **Fix:** Add a small client timer in the shell that goes to `/login?error=expired` at the idle limit, resets on activity and hides the page first. It need not be a security boundary: the proxy remains that.

### LOW

| ID | Finding | File | Evidence and fix | Status |
|---|---|---|---|---|
| S-14 | External ids are readable by patients on tables other than `patient_profiles`: `lab_orders.stripe_checkout_id`, `appointments.external_id`, `medications.semble_prescription_id`, `repeat_requests.stripe_payment_intent_id` and `ghl_task_id`, `questions.ghl_conversation_id`. Patients also see an order at `results_in` before release, though no values. | Grants migration | Verified again [2026-11]. Replace table-wide `grant select` with column grants, and split staff and patient reads if needed. | OPEN |
| S-15 | Archived patients can still act. `is_own_patient` and `can_act_for` ignore `archived_at`, while `my_patient_ids` honours it. | Helper functions | Verified: a question, a consent, a document row and an object were accepted with no `RETURNING`. Add `pp.archived_at is null` to both. Re-test [2026-11]: question, consent, document, object and repeat request are all refused, for the patient and for a guardian. | RESOLVED in `2128195` (`20261102111718_helper_functions.sql`) |
| S-16 | Suspended accounts do not fail every check. They still read their own profile, roles and notifications, the staff directory and reference data, and can update their profile and notifications, upload an avatar and change a staff signature. A deactivated staff member can also change their signature, and a suspended one still appears in the directory. | Policies, `private.get_staff_directory` | Verified [2026-11]. `my_staff_id` now checks status (fixed in `2128195`). No clinical data is reached: results, documents and record all returned 0. Add the status check to the self-service policies and the directory, or correct the comment on `profiles.status`. | OPEN, partly fixed |
| S-17 | Payment and workflow state can be set by staff out of order. A PA moved a request to `sent_to_pharmacy` with no payment id, and an unpaid order to `reviewed` with `price_pence = 1`. Only the direct move to `paid` is blocked. | Grants, `lab_orders` | Verified. Add state-transition triggers, and lock price once a checkout exists. | OPEN |
| S-18 | Patient uploads can state a misleading `title` and `shared_at`. Accepted: title "Lab result from TDL", `shared_at` of 2020-01-01. | Documents insert policy, grants | Verified [2026-11]. `source`, `kind` and `shared_with_patient` are now forced (fixed in `2128195`). Remove `shared_at` from the insert grant or set it in a trigger. Show a patient's upload as theirs on every staff screen, whatever its title. | OPEN, partly fixed |
| S-19 | Upload hygiene: a patient can upload objects with no row and no quota. Type limits rest on the declared content type. Files are not scanned, yet staff will open them. | `20261102111728_storage.sql` | Upload with no row verified at database level; the rest from the code. Add a scan or quarantine step and a per-patient limit. | OPEN |
| S-20 | Definer helpers `report_is_released`, `document_gate_open`, `is_active_staff` and `storage_object_is_mine` take any id and do not check `auth.uid()`. A SQL session as `authenticated` gets true or false for any report or staff member. | Helper functions | Verified again [2026-11]. Not reachable from the API in the first run: `/rpc/...` returned 404, `Accept-Profile: private` and `Content-Profile: private` returned 406. The risk arises only if `private` is ever exposed. Consider a check that the caller may see the patient. | OPEN |
| S-21 | A staff member who is also a patient keeps staff reach over their own record: their own unreleased results and safeguarding alerts, and writing their own diagnoses and medications. | Policies | Writes verified for Dr Bennett; reads from the code. Needs a clinic decision. | OPEN |
| S-22 | `staff_profiles` is not tied to `user_roles`. An admin can add a row for a patient account, who then appears in the staff directory, and whose avatar becomes readable by anyone signed in. An admin can set their own `clinical_role = 'doctor'`, which grants nothing (verified: 0 results). No "last admin" guard: an admin suspended themselves. | Policies | Verified. Never authorise from `clinical_role`. Require a matching staff role on insert. Refuse to suspend the last admin. | OPEN |
| S-23 | `profiles.email` can drift from `auth.users.email`, because only an insert trigger exists and the client cannot correct it. | Identity migration | From the code. Add an update trigger on `auth.users`. | OPEN |
| S-24 | `locations.ghl_calendar_id` is readable by anyone signed in. Reference tables also have full-table insert and update grants for admins, including `id` and `created_at` (a `created_at` change is accepted where no foreign key blocks the row). | Grants migration | From the code, plus attempted id changes refused only by foreign keys. Use column grants, and hide the calendar id behind a view or function. | OPEN |
| S-25 | The recovery email template in `supabase/templates/` applies locally only. Without it, the hosted reset email uses Supabase's default link, not `/auth/confirm`. | `supabase/templates/recovery.html` | From the code. The owner has deferred SMTP through Resend and this template until there is a domain, so hosted password reset is not reliable until then. See the manual checklist. | OPEN, deferred by the owner |
| S-33 | `/login?error=constructor` returns a 500. The `ERRORS` lookup reaches `Object.prototype`, so a function goes to a Client Component as a prop. `toString` and `__proto__` do the same. Anyone can send a link that shows an error in place of the sign-in form. | `app/(auth)/login/page.tsx` | Verified. Fixed with `Object.hasOwn`. Re-test [2026-11]: `constructor`, `toString`, `__proto__`, `hasOwnProperty` and a repeated `error` parameter all return 200 with the form and no message. `expired` and `link` show their own text. | RESOLVED in the working tree (`app/(auth)/login/page.tsx`), not yet committed |
| S-34 | Sign-in and reset messages do not reveal an account, but their timing may. Reset awaits the mail send for a real account only. Sign-in checks a password hash for a real account only. | `lib/auth/actions.ts` | Sign-in measured locally at 9 ms and 4 ms (median of 7), with the seed's cost; a hosted hash will widen it. Reset from the code. Send the reset after replying, and pad the sign-in reply. | OPEN |
| S-35 | The layouts do not match what the database enforces. A deactivated staff member still holds `user_roles` rows, so `isStaff` is true and they get `/clinic`, with an empty dashboard showing "0 results to review", in place of "no access". If also a patient, they land there first. A suspended person is sent to `/login` but stays signed in, and can still open `/update-password`. `isSuspended` is false if the profile read fails. | `lib/auth/session.ts`, `app/clinic/layout.tsx`, `app/portal/layout.tsx` | Empty reads verified by SQL, routing from the code; not run in the app, as it needs a committed change. No data is reached. Read `staff_profiles.active` in `getCurrentUser`, treat a failed read as no access, and sign out on suspension. Offboarding should also ban the Auth account, since suspension alone still issues tokens. | OPEN |
| S-36 | `/auth/confirm` signs in on a plain `GET`. A person can send their own recovery link to a colleague, whose browser is then signed in to the sender's account and asked to choose its password. A link scanner that opens the link also uses up the single-use token. | `app/auth/confirm/route.ts` | From the code; no valid token was used. Have the link open a page whose button posts the token. | OPEN |
| S-37 | `/update-password` accepts any session, not only one from a recovery link, and asks for no current password. Within the window `secure_password_change` allows, an unattended browser or injected script can take over the account. | `app/(auth)/update-password/page.tsx`, `lib/auth/actions.ts` | From the code. Require a recovery session or the current password, and `aal2` for staff once S-11 is done. | OPEN |
| S-38 | `kind = 'patient_upload'` skips the release gate, even when an unreleased report links the document. Staff may also create that kind, with any `source`. The health coach reads such a PDF while the report stays hidden. Follow-on from S-01. | `private.document_gate_open`, documents insert policy | Verified: staff row with `source = 'tdl'` accepted, and the coach read a linked upload while the report returned 0. Limit the staff branch to other kinds, and apply the gate to everyone but the patient and guardian. | OPEN |
| S-39 | `import_items` of a confirmed import can still be changed, because the policy ignores the parent's status. Follow-on from S-08. | `import_items` update policy | Verified. Add a check on the parent's status. | OPEN |
| S-40 | `..` is accepted in `documents.storage_path`, `staff_profiles.signature_path` and `storage.objects.name`, because the checks read only the first segment: `<own id>/../<other id>/x.pdf`. | Check constraints, storage policies | Verified at database level. What the Storage service does with such a name was not tested, because it would leave data. Refuse `..` and empty segments in all three. | OPEN |
| S-41 | The `/portal` letter query does not repeat the release gate. For a doctor who is also a patient, RLS is the clinical branch, so a shared `letter` linked to their own unreleased report appears, by title only. A real patient would not see it. This contradicts the comment on the query, though only server code can create that link. | `lib/data/portal.ts` | Verified by SQL. Results, by contrast, held (see below). Exclude documents linked to an unreleased report, or read through a function that applies the patient's rules. | OPEN |
| S-42 | One PA alone can give any account a verified link to any patient, in her own name. Thomas then read Eleanor's 30 results. The audit trail is now true, but one person can still disclose a record. Follow-on from S-02. | `patient_guardians` policies | Verified. Needs a clinic decision on a second approver, at least for `can_act`. | OPEN |
| S-43 | Invitation acceptance is not built, so nothing checks expiry, that the inviter is still active, that `patient_profiles.user_id` is empty, or that the signed-in email matches. An expired pending row blocks a new invitation to that address. Server code can defeat the expiry check by setting `created_at`. Follow-on from S-03. | `invitations`, `20261102111657_identity_and_accounts.sql` | Blocking and `created_at` verified as `service_role`. Build those checks, delete or expire stale rows, and never pass `created_at`. Decide whether team-role invitations need a second approver. | OPEN |
| S-45 | A patient can still put their own file at a path staff code will use. With a staff row and no file yet, the patient's object was accepted, so staff would open it as a clinic letter. A PA's row over a patient's object was accepted too. At a predictable path the patient can also get there first, and the server's upload then fails on the unique key. A failed upload also tells a patient that a hidden path is occupied. Follow-on from S-09. No clinical data is disclosed. | Storage insert policy, documents insert policy | Verified at database level. Limit patient uploads to a dedicated folder such as `<patient id>/uploads/`, keep staff files out of it, use random file names, and check the object's owner in the staff branch. | OPEN |
| S-49 | Anyone can block a named person. 30 wrong passwords from three addresses refuse that person's correct password for the rest of the 15 minutes, and it can be repeated. 3 reset requests from one address block their reset for an hour. Successful sign-ins count too. Nobody is alerted and no screen clears a block. Reset for that account stayed allowed while sign-in was blocked, as the buckets are separate. | `lib/auth/throttle.ts` | Verified. This is the cost of an account limit, and it is smaller than the original S-32. Alert when an account bucket fills, give admins a way to clear it, and count only failures. | OPEN |
| S-50 | The throttle fails open with one log line. A missing `SUPABASE_SERVICE_ROLE_KEY`, a migration not yet applied to the hosted project, or any RPC error means no limit, and nobody is told. A deployment could run for months like that. Failing open is a reasonable choice for availability, but no human has accepted it. | `lib/auth/throttle.ts` | From the code; the dev server was not restarted to test it. Alert on the log line, and run the post-deployment check in the checklist. | OPEN |
| S-51 | The address limits are easy to rotate. An IPv6 client is counted per full address, and one home connection commonly controls a whole /64. Spraying one password across many accounts then meets only the 30 per account limit. Rotating the address headers does this directly on the dev server (verified, expected with no host in front; `x-real-ip` wins, then the first `x-forwarded-for`). | `lib/auth/throttle.ts` | IPv6 from the code; not run. Count IPv6 by /64. Confirm the host overwrites the headers: see the checklist. | OPEN |
| S-52 | Concurrent attempts overshoot the limit by more than "slightly", as the function's comment says. 40 parallel RPC calls at limit 10 allowed 13, 18, 18 and 19. Through the dev server, 25 parallel sign-ins allowed exactly 10, but that server handled them with less concurrency than a hosted one may. The check and the count are separate statements. | `20261102143000_auth_throttle.sql` | Verified. Take an advisory lock on the sorted keys, or count first and check the returned totals. | OPEN |
| S-53 | Server actions run at paths the proxy skips, so the session limits do not apply to them. `POST /foo.png` with the sign-out action id and an idle-expired session returned 404 but ran the action: its refresh token was gone afterwards. No layout runs there either. Only the session's holder or injected script could use this, and today's actions are only auth actions. Release and import actions will not be. Extends S-29. | `proxy.ts` matcher | Verified. Exclude only real static paths from the matcher, and have every server action check its own session, role and limits. | OPEN |
| S-54 | The total limit is measured from the latest `amr` timestamp. Once MFA exists (S-11), a step-up will restart the 12 hours, and falling back to `iat` when `amr` is empty would restart it at each refresh. `ch_session_kind` is set only at sign-in or password change, so a patient made staff in mid-session keeps patient limits outside `/clinic` until the next sign-in. Since [2026-11] any `/clinic` path uses staff limits whatever the cookie says (verified), which closes the worst case: a staff member working in the clinic area is always on staff limits. | `lib/supabase/proxy.ts`, `lib/auth/actions.ts` | From the code. A refresh does not move the timestamp (verified). Use the earliest timestamp, treat no timestamp as expired, and apply staff limits wherever the signed-in user holds a staff role. | OPEN, partly fixed |

### INFO

| ID | Note | Status |
|---|---|---|
| S-26 | Admins have no read path to `audit_log`, `webhook_events` or `integration_sync_log` other than server code, though the draft says admins read the logs. No such screen is built. | OPEN |
| S-27 | Any signed-in user gets the PostgREST OpenAPI description at `/rest/v1/`: 32 paths, with table and column names including `token_hash`. Anon gets an empty one (one root path). It exposes structure, not data. | OPEN |
| S-28 | `service_role` keeps `delete` and `truncate` on `invitations`, `notifications`, `notification_preferences` and reference tables, and can append any row to `audit_log`, with any actor (verified [2026-11]). `postgres` owns `audit_log`, so a migration could re-grant or drop the triggers. Both are outside what a signed-in user can do. | OPEN |
| S-29 | The proxy matcher skips paths ending in an image extension, so `/clinic/x.png` gets no session refresh or redirect. Verified [2026-11]: a signed-out request gets a 404, as no such route exists. Server layouts must check for themselves, as `CLAUDE.md` already requires. Since [2026-11] these paths also skip the session limits: see S-53. | OPEN |
| S-30 | A signed URL keeps working until it expires, even after a document is unshared. Keep expiries short when the signed URL code is written. Not built yet. | OPEN |
| S-44 | `requestPasswordReset` builds `redirectTo` from the request's `Origin` header. A browser cannot forge it, and a foreign `Origin` is refused, but a client that also sends a matching `X-Forwarded-Host` passed the check on the dev server (verified). Whether that works in production depends on the host overwriting the header. The damage is limited: Auth checks the allow-list, and `recovery.html` uses `{{ .SiteURL }}`. Build the URL from a configured site URL. See the checklist. | OPEN |
| S-55 | `auth_throttle` keys are unsalted SHA-256, so the table holds pseudonymised data. The comments (migration and `throttle.ts`) now say the table holds "no plain email or IP address", which is true [2026-11], so the misleading claim is gone; the weakness is not. An IPv4 address or a known email can be recovered by trying candidates. The rows are short-lived and only the definer function can read them. Use an HMAC with a server secret. | OPEN, partly fixed |
| S-56 | `.env.local` and the `web` launch configuration point at the one hosted project, so plain `pnpm dev` runs unreviewed local code against it, and could reach real data when it holds any. `web-local` is the safe route. Use the local stack by default, and keep real data out of any project a development machine holds keys for. See the checklist. | OPEN |

## What was attacked and held in the third run [2026-11]

All verified unless marked. What did not hold is under S-31, S-32 and S-48 to S-54. S-46 and S-47 were fixed and re-tested in the fourth run.

- **Redirect loops:** an expired session on `/login` goes once to `/login?error=expired` with all `sb-` and `ch_*` cookies cleared, and that request then returns 200. The redirect clears the cookies itself, so a failed sign-out cannot loop (from the code).
- **Server action on expiry:** a `POST` with an expired session gets a 307 to `/login?error=expired` with the cookies cleared, and the action does not run on that hop. A browser repeats the `POST` there. A sign-out action then got a 200 with a JSON body on the dev server and did not redirect. From Next's client code, that raises "An unexpected response was received from the server", so the person sees the error boundary, with their session already ended, in place of the sign-in page. Not run in a browser, because the `HttpOnly` cookie cannot be aged there. Actions with no session reach only RLS, which gives `anon` nothing.
- **Sign-out:** clears all three cookies and the refresh token returns 400.
- **Forged tokens:** an access token with an edited `amr` and `sub` redirected to `/login`.
- **Header spoofing against the app's account limits:** rotating `x-real-ip` and `x-forwarded-for` never got past the 30 per account limit. A blocked `x-real-ip` wins over a new `x-forwarded-for`. Whether a client can rotate them in production depends on the host: see the checklist.
- **Service role and bundle:** `lib/supabase/admin.ts` is now imported only by `lib/auth/throttle.ts`, which starts with `import "server-only"`. `SERVICE_ROLE`, `service_role` and `auth_throttle` appear in 0 files of `.next/static` and `.next/dev/static`. The throttle's error log holds no email or address (from the code). This updates the second run's statement that nothing imported `admin.ts`.
- **Catalogue:** `pnpm db:lint`, `pnpm db:test` and `pnpm db:advisors` pass with the new migration. The counters are in `private`, not the exposed schema.

## What was attacked and held in the second run [2026-11]

All verified unless marked.

- **Doctor who is a patient on `/portal`:** the portal's results query, sent over HTTP as a doctor for a patient with an unreleased report, returned 30 of the 32 rows RLS allows, so the query's own `released_at` filter works. In a rolled-back transaction with Dr Bennett's own released and unreleased reports, only the released value returned. Her own record comes first. Only the letter query lacks the gate (S-41). On `/clinic` she still sees her own unreleased report (S-21).
- **Open redirects:** `next` of `//evil.example`, `https://evil.example`, `/\evil.example` and an encoded variant all ended at `/login?error=link`, with no valid token. With a valid token `next` is limited by an exact allow-list (from the code). Unknown `type` values are refused. The `/login?error=` text comes from a fixed list apart from S-33.
- **Account enumeration:** sign-in gives one message for every failure, and "no access" appears only after a correct password. Reset always replies the same. Timing is S-34.
- **Sessions on screens:** `lib/data/`, `lib/auth/session.ts` and every page read through `lib/supabase/server.ts`. Nothing imports `lib/supabase/admin.ts` or `lib/email/send.ts` at all yet.
- **Client Components:** those importing from `lib/data/` use `import type` only. `lib/auth/actions.ts` reaches the browser only as server action references.
- **Secrets in the bundle:** the values of `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY`, and those names and `service_role`, appear in 0 files of `.next/static` and `.next/dev/static`. `.env.local` was never committed. No key pattern in `app`, `components`, `lib` or `.env.example`.
- **CSRF on server actions:** a `POST` with a foreign or `null` `Origin` returned 500 and the action did not run. The same request with the same origin ran. A request with no `Origin` runs, but only a non-browser client sends that, and it has no victim's cookie. Cookies are `SameSite=Lax` (from the code). See S-44 for `X-Forwarded-Host`.
- **Layout routing, with real session cookies:** a patient on `/clinic` goes to `/portal`, and a doctor with no patient record on `/portal` goes to `/clinic`. Signed-out requests go to `/login`. A crafted router request for `/clinic` as a patient was redirected and rendered no page. Pages do not check the role themselves, but RLS would return a patient nothing there.
- **Data in the page:** the admin's `/clinic` holds no seeded patient name and 0 to review. The health coach's has 0 to review. A patient's `/portal` holds no other patient's name, no external ids and no tokens. Authenticated pages send `Cache-Control: no-store`. Error boundaries show no error text.
- **Catalogue:** RLS enabled and forced on all 32 tables, no `FOR ALL`, no `SECURITY DEFINER` in `public`, every function sets `search_path`, no `anon` table grants, no `CASCADE` or `SET NULL`, no table in the Realtime publication. `authenticated` can delete only from `staff_locations` and `lab_panel_markers`, which are not clinical.
- **Headers and sign-up:** `disable_signup` is true locally. `next.config.ts` is unchanged.

## What was attacked and held in the first run [2026-11]

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

## Not reviewed in the first two runs [2026-11]

- Server actions and functions for invitations, release, import confirmation and webhooks: not built.
- Actual uploads through the Storage API, because they would have left data. Storage policies were tested at database level only.
- A valid recovery link, a sent reset email, or a production build. Checks ran against the dev server.
- Suspended and deactivated users in the running app, because that needs a committed change. Their reads were tested by SQL, and their routing by reading the code.
- Rate limits, because using them up would lock the shared local stack.
- The hosted project: never connected to.

Also not reviewed in the third run: a production build or Vercel, a valid recovery link end to end, the throttle's failure path in a running server, Supabase's per-IP limits (not active locally), and the idle timer in a real browser.

## Documented decisions

- [2026-11] **Admin is deliberately not clinical staff.** `is_clinical_staff` excludes admin, and tests confirm no clinical reads. Admins do read all `profiles`, `care_team` links and `invitations.patient_id` (verified: 11, 12 and 3 rows), so they can see who is a patient and who cares for them. See S-03 for the route around this decision. Open question 2 in `docs/PRD.md`.
- [2026-11] **`in_scope` is open until the clinic answers.** See S-10. Open question 1 in `docs/PRD.md`.
- [2026-11] **Roles live in `user_roles`, written only by server code,** never read from the JWT.
- [2026-11] **Definer code lives in `private`,** not exposed through the Data API. `authenticated` needs `usage` on it because policies call the helpers. Hidden columns are served through invoker wrappers in `public`.
- [2026-11] **No hard deletes.** No `delete` for `authenticated` on clinical tables, and none for `service_role` either. No delete policy on Storage.
- [2026-11] **A staff role needs an active staff profile.** `private.is_active_staff` is checked by `has_role`, `is_clinical_staff` and `is_team`, so deactivating someone ends their access without touching their roles.
- [2026-11] **No browser client.** All Supabase calls run on the server and auth cookies are `HttpOnly`. Any later browser feature, such as direct uploads or Realtime, needs its own design. The Supabase origins in `connect-src` can probably go.
- [2026-11] **Session limits are enforced by the app.** 12 hours and 30 minutes idle for staff, 7 days and 2 hours for patients, read from a signed `amr` claim and from unsigned `ch_*` cookies. The unsigned cookies were chosen on purpose. The residual risk is recorded in S-31, and no human has yet formally accepted it, so S-31 stays OPEN.
- [2026-11] **One hosted environment for now,** with the local stack as development. Owner's decision. See the checklist and S-56.
- [2026-11] **CSP is a starter policy.** Nonces are future work, because the proxy only refreshes the session and redirects. See S-12.

## Manual configuration checklist

A human does these in the hosted project. None can be verified from this repository. Items left open with a reason are the owner's decisions [2026-11], not oversights.

**Before any real data**

- [x] Auth: "Allow new users to sign up" is off. Reported by the owner [2026-11]; not verified by this review, so S-13 stays OPEN until someone records `disable_signup: true` from the hosted `/auth/v1/settings`.
- [ ] Auth: custom SMTP through Resend, with a verified sending domain. **Deferred until there is a domain.** Until then hosted password reset is not reliable (S-25) and the built-in mail cap will be reached sooner. The reply no longer reveals an account when it is (S-47, resolved), but a person whose reset is limited gets no email.
- [ ] Auth: set the recovery email template to the content of `supabase/templates/recovery.html`, with its subject. **Deferred with SMTP, for the same reason** (S-25).
- [ ] Auth: site URL and redirect allow-list hold production URLs only, with no localhost and no broad wildcards (S-44).
- [ ] Auth: session time-box and inactivity limit are set. **Needs the Pro plan** (Supabase docs: "only available on Pro Plans and up"). Until then only the app enforces limits (S-31). They apply to the whole project, so set them no shorter than the patient limits.
- [ ] Auth: leaked password protection is on. **Needs the Pro plan.** Minimum 12 characters, as in `config.toml`.
- [ ] Auth: rate limits reviewed, knowing that sign-in and reset through the app all arrive from the app server and direct calls do not (S-32). Check whether the project supports the `Sb-Forwarded-For` header.
- [ ] Auth: anonymous sign-ins and manual linking are off, as in `config.toml`.
- [ ] Auth: secure password change and double-confirm email change are on, as in `config.toml`.
- [ ] Auth: MFA for staff is on, and enforced by code (S-11).
- [ ] Migration `20261102143000_auth_throttle.sql` is applied and `SUPABASE_SERVICE_ROLE_KEY` is set in the host. Without either, the throttle is silently off (S-50).
- [ ] Project in the London region (`eu-west-2`).
- [ ] Data Processing Agreement signed with Supabase, and with Resend, Vercel and any other processor that sees personal data.
- [ ] Separate dev and prod projects, with separate keys. **Decided against for now:** one hosted environment, with the local stack as development. Real data then needs extra care: stop pointing `.env.local` at that project before it holds any (S-56).
- [ ] Data API: exposed schemas are `public` only. `private` must never be added (S-20).
- [ ] Never run the seed against a hosted project (no `--include-seed`): it creates accounts, including an admin, with one shared password written in the file.
- [ ] Realtime: no tables in the publication, public channel access off, or disable it if not used.
- [ ] Rotate keys if ever exposed. `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` are set as server-only variables in the host, never with `NEXT_PUBLIC_`.
- [ ] Point-in-time recovery or backups are on, with a tested restore. **To check: whether automatic backups need a paid plan.** If they do, real data needs that plan or another tested backup.
- [ ] Network restrictions on direct database connections, with SSL enforced.

**After deployment**

- [ ] Confirm the host overwrites `X-Forwarded-Host`: a request with a foreign `Origin` and a matching `X-Forwarded-Host` must not run a server action (S-44).
- [ ] Confirm Vercel overwrites the client-address headers (S-51). With a forged `x-real-ip` and `x-forwarded-for` that change on each request, send 11 wrong passwords for one invented `@example.test` address from one machine. The 11th must say "Too many attempts". If it does not, the host is passing the headers through and the address limits can be bypassed. Repeat after any change of host or any proxy put in front.
- [ ] Confirm the throttle is running at all, by the same test: an error in the log or no refusal means it is failing open (S-50).
- [ ] Confirm the `sb-` and `ch_*` cookies all carry `Secure` and `HttpOnly` in production (S-31).
- [ ] Confirm the production response headers, including that `connect-src` has the Supabase origin, since `NEXT_PUBLIC_SUPABASE_URL` must be set when headers are generated. With no browser client it may no longer be needed.
- [ ] Confirm the domain should be HSTS preloaded before relying on the `preload` directive: it is hard to undo.
- [ ] Rerun the advisors in the dashboard after each migration push.
