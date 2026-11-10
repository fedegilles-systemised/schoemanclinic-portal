# Clinic Hub: product requirements

Owner: `prd-keeper`. Last updated [2026-11].

## 1. Context and problem

The Schoeman Clinic (hormone, longevity and functional medicine, London) needs a patient portal and a clinic portal. Today results, orders and requests are spread across GoHighLevel, Semble, email and PDFs, so staff re-key data and patients cannot see their bloods in one place or follow a trend over time.

## 2. Goals

- Run the bloods loop end to end in one place.
- Give patients a clear, calm view of their results and trends, shown only after a doctor releases them.
- Cut manual import and chasing work for PAs and doctors.
- Keep clinical data private by default, enforced in the database (row-level security).

## 3. MVP scope

The MVP is built around the bloods loop: order, Stripe payment and barcode, results by lab feed or PDF import with PA review, doctor review and release, then the patient sees the trend.

**In:** the bloods loop above; sign-in; patient and clinic home dashboards; the screens listed in section 5.

**Out (stays elsewhere):**
- GoHighLevel keeps messaging, reminders, tasks, calendar, invoices and marketing.
- Semble keeps consultation notes for now. [2026-11] Prescribing goes through SignatureRx, where the doctor signs with a PIN (the clinic's patient flow V8); Semble is not the prescribing system.

## 4. Roles

| Role | Purpose |
|---|---|
| Patient | Sees own record, released results, orders tests, uploads results, asks the clinic |
| Guardian | Verified by the clinic; sees or manages a patient's account (for example a parent of an under-18) |
| Doctor | Reviews and releases results; sees safeguarding alerts (doctors only) |
| PA | Reviews imports, manages orders, invites patients and guardians |
| Health coach | Sees released results only; no team-only tables (current position) |
| Nurse | [2026-11] Exists and can sign in, with a profile and the clinic home. Has no access to patient records until the clinic decides what a nurse may do (question 7). Admins can invite a nurse. Built |
| Admin | Manages team, roles and settings; invites anyone, including team members; no clinical record access (current position) |

## 5. Features

Status is "done" only where the screen and data path exist in code. Current state [2026-11]: foundations, database migrations, sign-in, role routing, the app shell and both home screens are built with real data. Every action button on those screens is disabled; navigation to unbuilt screens shows "Coming soon".

| Area | Feature | Status |
|---|---|---|
| Foundation | Next.js and Supabase scaffold, design tokens, restyled components | done [2026-11] |
| Both | Sign-in (email and password, forgot and update password, no sign-up) | done [2026-11] |
| Both | Role routing (patient and guardian to `/portal`, clinic staff to `/clinic`) | done [2026-11] |
| Both | App shell (navigation, user menu, notifications bell) | done [2026-11]; unbuilt nav items disabled |
| Patient | Home dashboard `/portal` | done [2026-11]; real data, all action buttons disabled |
| Clinic | Dashboard `/clinic` | done [2026-11]; real data, all action buttons disabled |
| Both | Profile `/portal/profile` and `/clinic/profile`: tabs by role (see "What each role can configure" below). Photo, name and phone, notification choices, sign-in security, and the clinic's read-only record or work profile | done [2026-11]; locally verified, tablet widths and dark mode not checked |
| Both | Change password (current password asked; other devices signed out) and change sign-in email (current password asked; confirmation link sent to the new address) | done [2026-11] |
| Doctor | Signature for letters, stored privately; used when letters are built | done [2026-11] (storing only; nothing uses it yet) |
| Both | Notification choices: topics results, payments, appointments and messages, by email and in the portal | done [2026-11] (stores the choice; GoHighLevel and the portal bell do not read it yet) |
| Patient | Lab orders | planned |
| Patient | My results `/portal/results` and a marker page `/portal/results/[markerId]`: released results only, each marker with its latest value, range, status and small trend; a marker opens a chart of every released value with the range as a band, a table of values and the doctor's comments | done [2026-11] |
| Patient | Upload results (patient's own PDF from the portal). [2026-11] Agreed shape: PDF only, up to 5 files each time (the patient can upload again later), and the name on the report must match the name the patient registered with; a PA checks it is complete. Staff attaching files keep PDF, JPEG or PNG up to 10 MB | planned |
| Patient | Prescriptions. [2026-11] Repeat request at £30 replaces the clinic's Typeform; the approval is passed to SignatureRx, which the doctor signs with a PIN | planned |
| Patient | Appointments. [2026-11] Read-only list. There is no reschedule or cancel button anywhere: the page asks the patient to contact the team and shows the 48-hour policy | planned |
| Patient | Ask the clinic | planned |
| Patient | Letters and documents | planned |
| Patient | Privacy and consent | planned |
| Clinic | Patient list | planned |
| Clinic | Results review `/clinic/results` and a report page `/clinic/results/[id]`: a doctor checks each value, comments on values and releases (the system records who and when); a PA sees the report; a health coach sees released reports only | done [2026-11]. Release needs a doctor. [2026-11] On release the patient gets a notice in the portal bell ("Your results are ready") and an email saying a new result is ready, with a sign-in link to `/portal/results` and no value or verdict: we never send results by email. No email is sent if the patient switched off results emails in their profile (topic results, channel email; no saved choice counts as on); the portal notice is still made. No email is sent if the patient has no account or the account is suspended; the doctor is told so on screen. If the email fails, the release still stands, the portal notice is kept and the doctor is told. The GoHighLevel message is not wired to release |
| Clinic | Add results `/clinic/results/new`: a PA or doctor picks the patient and sample date, optionally attaches the lab's file, and enters each value with its unit. A value in another unit is converted to UK units and the original value and unit are kept. Status is set automatically: low or high against the range, borderline when inside the range but within 5% of an edge, otherwise in range; only a doctor sets critical. Conversions use standard factors until the clinic sends its base units | done [2026-11]. This is the import without AI |
| Clinic | Import queue (needs-match list, AI reading of PDFs, inbox forwarding) | planned |
| Clinic | Results by lab feed | planned |
| Clinic | Lab orders. [2026-11] Cycle guidance follows sex at birth: day 21 for regular periods, any day for irregular or none; a missing value stops the step and tells a PA | planned |
| Clinic | Activity `/clinic/activity`: admins read who opened or changed a patient's record: date, person and role, what was done, and the patient's name; no clinical values; newest first, fifty at a time. Opening a lab report is logged, at most once every ten minutes per person and report (`log_record_view`). Other record screens will log the same way when built | done [2026-11]; only the report page logs views today |
| Clinic | Safeguarding alerts | planned |
| Both | Sex at birth and gender identity. Both are held on the patient record (`patient_profiles.sex` is sex at birth; `gender_identity` is new and free text, up to 60 characters). Sex at birth drives panels and cycle guidance and is never guessed | partly done [2026-11]: the columns exist; no screen edits them and nothing yet uses them for panels or cycle guidance |
| Clinic | Team and settings: team invitations (a list with status, who sent it and when, filters, resend and cancel, and an "Invite someone" form). The menu item shows only to PAs and admins | done [2026-11]; locally verified at desktop width, tablet and mobile not checked. Managing existing team members (roles, deactivation) and the clinic's tests, prices, partners and locations are planned |
| Both | Invitations: a PA or an admin invites a patient (for a record already held, or a new patient added with a name and date of birth), a guardian (relationship, and whether they may act) or, for admins only, a team member (doctor, PA, health coach, nurse or admin, with a job title). The person gets an email with a link that works once and for 3 days; they create an account with a password, or, if the address already has an account, sign in and add the access. A resend cancels the old link; a cancelled or expired link cannot be used. [2026-11] Checks added: a patient or guardian must enter a date of birth when accepting (the patient's own, or for a guardian the patient's); five wrong dates cancel the link and tell the sender. A patient invitation to an address different from the patient record's contact email needs the sender to confirm ("Send to this address anyway"). Notices in the portal bell, not approvals: other admins are told when a doctor or admin is invited, other PAs when a guardian who can act is invited | done [2026-11]; locally verified, not tested with a real email |
| Both | Emails. Built [2026-11]: four sign-in service emails (password reset, email change, confirmation code, password changed) and three clinic emails (invitation, guardian access, result ready), in the clinic's look, with no clinical values in any of them. Sent by the sign-in service for the first four (hosted set-up is manual and not done); of the three clinic emails the invitation is sent by the invitations feature, and the guardian access and result ready emails are wired to no flow | partly done; the guardian access flow is unbuilt. [2026-11] Wording rules agreed from the clinic's emails: every email closes with the clinic's phone, email and WhatsApp (`lib/email/contact.ts`, added by `lib/email/layout.ts`), the clinic's own emails open "Dear" and the first name and are signed "The Schoeman Clinic team". Clinic Hub sends the portal's own emails (sign-in, invitations, result ready) through Resend; GoHighLevel handles the clinic's own reminders and WhatsApp, managed by the team there. WhatsApp goes only to patients who agreed, and always alongside an alert to the PAs. Built in the templates |
| Both | Staff Knowledge base `/knowledge-base`: admins only, unlisted page for the clinic to validate roles, access, flows and open questions; sign-in brings an admin back to it (other roles go to their own home) | done [2026-11]; not a patient feature |

### What each role can configure on the profile [2026-11]

| | Patient | Guardian | Doctor | PA | Health coach | Admin |
|---|---|---|---|---|---|---|
| Photo, name, phone | Yes | Yes | Yes | Yes | Yes | Yes |
| Sign-in email (confirmed by link), password, sign out other devices | Yes | Yes | Yes | Yes | Yes | Yes |
| Notification choices (email, portal) | Yes | Yes | Yes | Yes | Yes | Yes |
| Their patient record (name, date of birth, reference, contact details, doctor) | Read only; "contact the clinic" | No record unless also a patient | Only if also a patient | No | No | No |
| People they look after | Not shown | Read only | No | No | No | No |
| Work profile (job title, role, GMC number for doctors, locations, status) | No | No | Read only; an admin manages it | Read only | Read only | Read only, if they have a staff profile |
| Signature | No | No | Yes | No | No | No |

[2026-11] A nurse sees the same as a PA in this table, except that the work profile is read only (details, security and notifications as for every staff role); the table has no nurse column yet.

A doctor who is also a patient sees the patient tabs under `/portal/profile` and the work tabs under `/clinic/profile`. The roles shown are set by the clinic and cannot be changed here. Session lengths are shown, not editable.

## 6. Open questions for the clinic

[2026-11] One list. The knowledge base (`content/knowledge-base.md`, "Open questions for the clinic") is the list the clinic answers, and this section uses its numbers. Each entry here adds what the build assumes today. Where this document used its own numbers before, they are shown as "was n", so older references can still be followed. Questions that are not for the clinic are at the end.

1. **Access scope.** Do staff see all patients, or only those on their care team? `in_scope` currently returns true for any clinical staff member. The policies on the care team, patient profiles, guardian links, safeguarding alerts, repeat requests and result imports already go through it, so the answer is one change in the database, not a rewrite. It stays permissive until the clinic decides. (was 1)
2. **Admins and clinical records.** May admins read clinical records? Currently no (least privilege). Also: the invitation form loads every patient's name and reference for admins as well as PAs; do admins need it, or should they search by name only? (S-83.) (was 2 and 27)
3. **Health coach.** What may the health coach see beyond released results? Currently no team-only tables. (was 3)
4. **Doctors who are patients.** May a doctor see their own unreleased results and safeguarding alerts? Currently no. (was 9)
5. **Guardians.** What age and consent rules apply (for example under-18s, transition to adult access)? May one PA create a verified guardian link with `can_act`, or is a second approver needed? Do guardians of more than one patient need a patient switcher? (was 4, 8 and 10)
6. **Invitations and team.** Should inviting a doctor or an admin need a second admin's approval, or an email to the other admins? Should admins invite patients and guardians at all, given they have no clinical access? Do doctors invite their own patients (today only PAs and admins)? Who may change a member's role, deactivate or restore them, and does that need a second approver? Today there is no second approval for anything (`docs/SECURITY.md` S-74, S-75). (was 22, 23, 24 and 26)
7. **Nurse and other roles.** What may a nurse read or change, and may they see results before release? A nurse signs in today and sees no patient record. Are other roles missing (reception, phlebotomist)? (was 31)
8. **Orders and payment.** Barcodes, where samples are taken, fixed prices, unpaid orders and refunds. Nothing built yet.
9. **Lab feed.** Which labs send results electronically, in what format, and what happens to an unknown barcode or marker. Nothing built yet.
10. **AI reading of PDFs.** Which provider, which data-processing terms, which inbox, how long originals are kept. Results are entered by hand until this is answered. (was 7)
11. **Release rules.** Only a doctor releases today, and one doctor is enough. May a PA release normal results? Is a second doctor needed for critical values? Do some markers need a hold-back? (was 30)
12. **Markers, units and ranges.** Which markers are tested, what are the clinic's base units and ranges in UK units, and which range does the patient see when a lab's differs? Is "borderline" right at within 5% of an edge? Standard conversion factors are used until then. (was 29)
13. **Repeat prescriptions.** Fee, refunds, which medicines and how often, and how an approval reaches SignatureRx and the pharmacy. Nothing built yet.
14. **Messages.** Whether replies show in the portal, what patients do in an emergency, and how fast "important" is answered. Nothing built yet.
15. **Source of truth.** Which system holds bookings, contact details and notes, and which appointment types need bloods.
16. **Accounts and tools.** What Fathom is for, and which accounts (GitHub, Supabase, Resend, Vercel, the domain) the clinic will own.
17. **Emails.** Which sender address and domain patients see, and which address receives replies (`EMAIL_REPLY_TO`), or whether replies are turned off. Whether a result-ready email comes from Clinic Hub or from GoHighLevel (today Clinic Hub sends it through Resend, with no value in it). Whether some messages (a result is ready, a payment failed, safeguarding follow-up) ignore a patient's notification choices. Wording approval is answered: the clinic approves (rewritten by Mary Anne, approved by Gina). (was 13, 14, 15, 16 and 21)
18. **Sign-in.** Session lengths, a second step for staff, who resets a staff password, whether reception is a shared computer. Email and password is built; magic link only if the clinic asks. (was 6)
19. **Retention.** Retention periods for clinical records, uploads and the activity log, including the clinic's own rules for patients under 18 and for CQC. (was 5 and 35)
20. **Data protection.** Who the data protection lead is, how requests to see or erase data are handled when records are archived rather than deleted, and whether the privacy notice covers page-speed and visit counts.
21. **Priorities.** Which planned pages matter most for the first release, in order.
22. **Patient contact details.** May a patient edit their own phone and contact email on the record, or only through the clinic? Today the record is read-only and says "contact the clinic"; the account phone (Details tab) is separate and editable. (was 17)
23. **Patient photos.** Who may see a patient's photo? Today the patient, and every doctor, PA and admin whatever their care team, but not the health coach or a guardian. (was 19)
24. **Letters.** Who signs letters: doctors only, or also PAs or the clinic. Today only doctors store a signature, and nothing uses it yet.
25. **WhatsApp and SMS.** When they join the notification choices, and what is on by default for a new account. Today only email and the portal are offered. (was 18)
26. **Changing a sign-in email.** Is a confirmation link and the current password enough, or should the clinic check it (for patients especially, because a changed email takes over the account)? (`docs/SECURITY.md` S-68, S-69.) (was 20)
27. **Admin seeing everything.** Should the admin see clinical records too, to solve problems across the system? Today no. See also 2.
28. **Are notices enough?** When a doctor, an admin or a guardian who can act is invited, other admins or PAs get a notice in the portal bell only. Is that enough, or should it also go by email, or need a second person's approval? Is the patient's date of birth enough proof that the right person opened the link? (was 25 and 28)
29. **Registration, ID and consent.** The clinic's Semble registration form already asks for photo ID and three consents, and the call of 6 November agreed to ask for them again at the first portal sign-in. Which one is the record that counts, can one be dropped, and must a PA check the ID before the patient gets in? Not built. (was 34)
30. **Education and wearables.** Which content goes in the portal first, and who adds it. Not in the MVP.
31. **Moving over from Semble.** What moves (historical PDFs, notes, contacts), who checks it, and when to train the team. Not in the MVP.
32. **Notes locked and versioned for CQC.** Does Semble or Clinic Hub hold notes once a doctor signs them off, who may reopen one, and what is kept of each version? Assumed: Semble, as today. (was 32)
33. **Four lab choices.** The clinic's flow offers its own lab, TDL, a TDL home kit and "I have my own results". Should ordering follow those choices instead of a doctor creating an order? Assumed: no, until confirmed. (was 33)

**Not for the clinic: the owner's decisions**

- **Who else may read the knowledge base.** It is for admins only, but the clinic's owner is a doctor and doctors cannot open it. Should doctors get the admin role (which widens their power), or should another role be allowed to read the page? (was 12)
- Answered: knowledge base visibility, admins only (see Decisions). (was 11)

## 7. Decisions

- [2026-11] MVP centres on the bloods loop; messaging, reminders, calendar, invoices and marketing stay in GoHighLevel, notes in Semble. Prescribing goes through SignatureRx, not Semble (corrected after the clinic's patient flow V8).
- [2026-11] After comparing the clinic's patient flow V8, its email wording and the emails since with our assumptions: (a) a nurse role exists, signs in, and has no patient access until the clinic decides (question 7); (b) the admin has an Activity screen showing who opened or changed a patient's record, and opening a report is logged at most once every ten minutes; (c) every email closes with the clinic's phone, email and WhatsApp, opens "Dear" and signs off "The Schoeman Clinic team"; Clinic Hub sends the portal's own emails through Resend and GoHighLevel handles the clinic's own reminders and WhatsApp; (d) there is no reschedule or cancel button: the team handles it and the 48-hour policy is shown; (e) sex at birth and gender identity are both kept; sex at birth drives panels and cycle guidance (day 21 for regular periods, any day otherwise) and a missing value stops the step and tells a PA; (f) a patient's own upload will take PDF only, up to 5 files each time, in the name matching the registration. (a), (b) and (c) are built; (d), (e) and (f) describe screens not yet built.
- [2026-11] Least privilege by default: admins and the health coach have no clinical access until the clinic decides otherwise.
- [2026-11] Patients see results only after doctor release; safeguarding alerts are doctors only.
- [2026-11] Owner decision: multi-factor sign-in for staff and a CAPTCHA on sign-in are deferred until the clinic has accounts to enrol. Neither is built, and neither is in the MVP scope above.
- [2026-11] Sessions end on their own: staff after 12 hours or 30 minutes idle, patients and guardians after 7 days or 2 hours idle. A signed-out person sees "You were signed out to protect your account. Please sign in again." An open screen asks the server to check every few minutes while the person is active, so an abandoned screen does not stay readable.
- [2026-11] Every change to records made by the system rather than a person is attributed to the person it acts for or to a named background job in the audit log.
- [2026-11] The knowledge base is for admins only (the owner first chose signed-in staff, then narrowed it to the admin role; answered; see the owner's decisions at the end of section 6). Doctors, PAs, the health coach, patients and guardians are sent to their own area; signed-out visitors go to sign in and an admin returns to the page. The owner still has to decide whether doctors should get access (end of section 6).
- [2026-11] The knowledge base (`content/knowledge-base.md`, shown at `/knowledge-base`) is a stakeholder deliverable: the owner shares it with the clinic so they can confirm the roles, access, flows and its 33 open questions (section 6 uses the same numbers). Its access table is derived from the row-level security policies, so it must be re-checked whenever policies change.

- [2026-11] Invitations decisions, as built. Admins invite every kind (patient, guardian, team member); PAs invite patients and guardians; doctors, health coaches and patients invite nobody. A link works once and for 3 days; a resend cancels the old link and makes a new one. There is **no second approval** for any kind, including doctor and admin (question 6). Sign-up is by invitation only. A person whose address already has an account signs in to accept and the access is added to that account (a doctor can also be a guardian or a patient); the signed-in address must equal the invited one. A new patient can be added from the invitation form with a name and date of birth; the clinic reference is made automatically. **Admins see every invitation and the list of patient names for the form, but no clinical record** (question 2 stays open). Acceptance is recorded under the person who invited. Cancelling does not tell the invited person; they see "no longer valid".
- [2026-11] Invitation checks, as built. Patient and guardian invitations need a date of birth at acceptance; five wrong dates cancel the link and tell the sender. A patient invitation to an address other than the record's contact email needs the sender's confirmation. Other admins are told when a doctor or admin is invited, and other PAs when a guardian who can act is invited. These are notices, not approvals, so the "no second approval" decision above still stands; question 28 asks whether it should.
- [2026-11] Profile decisions. Patient contact details on the record are read-only in the app: a patient who wants one changed contacts the clinic (question 22 asks whether that should change). Notification choices offer email and the portal only for now; WhatsApp and SMS join when GoHighLevel is connected (question 25). Anyone may change their own sign-in email, confirmed by a link sent to the new address and by asking for their current password (question 26). Signatures are for doctors only, stored privately, and used only when letters are built. Photos are for everyone. Roles, work profile and guardian links are managed by the clinic, not by the person.
- [2026-11] A missing notification choice counts as on, so a new person hears about everything until they turn something off.
- [2026-11] No email carries a result, a value, a diagnosis or a medicine. It says that something is ready, or that an account is offered, and links to the portal.

- [2026-11] Results decisions, as built. Results are entered by hand, without AI: a PA or doctor types each value from the lab's report. Values convert to UK units on entry and the original is kept. Status is automatic (low, high, borderline within 5% of an edge, in range) and only a doctor sets critical. Only a doctor releases; one doctor is enough; no hold-backs. The patient sees the range held for each marker. These are assumptions the clinic has not confirmed (questions 11 and 12).

## Findings

- [2026-11] Result-ready email on release: the code now reads the patient's saved choice for results by email and skips the email if it is off (no saved choice counts as on); the portal notice is created whatever they chose. When the email is skipped for that reason the doctor still sees "The patient has been told", which is true only of the portal notice. The clinic should confirm a result-ready email may be switched off. The email goes to the sign-in address on the account, not the patient record's contact email; the two can differ. The "no account or suspended" and "email failed" cases are reported to the doctor on screen only, and are not logged anywhere else; not tested with a real email.

- [2026-11] Results are built and committed (`2f5f7f0`; migration `20261109120000_results_entry_and_release.sql`, pgTAP `06_results.test.sql`). The bloods loop is still partial: lab orders, Stripe payment and barcode, the lab feed, patient upload and AI reading are not built, so results enter only by hand. The bell notice and the "result ready" email on release are now both built (`lib/results/actions.ts`, `release_report`); see the 2026-11 finding below on notification choices. Question 10 (AI provider) stays open. The nav, dashboards and the "Coming soon" note in section 5 may still show disabled buttons for results; not checked. The knowledge base's flow 5 step 3 still describes the AI step as if built, while its status line says it is not.
- [2026-11] Earlier finding that sign-in and dashboard routes do not exist no longer holds: `/login`, `/forgot-password`, `/update-password`, `/auth/confirm`, `/portal` and `/clinic` exist (committed in `c831ccf`).
- [2026-11] Sign-in method differs between prototype (magic link) and brief (email and password); `CLAUDE.md` lists forgot and update password routes, which implies passwords. The code implements email and password, so the question is effectively settled unless the clinic wants magic link.
- [2026-11] Sign-in hardening (attempt limits, session limits, signed session cookies, content security policy, scoped audit actor) is committed and not yet on the hosted project. It adds no screen and changes no scope.
- [2026-11] Emails: `invitationEmail` is now wired to the invitations feature; `resultReadyEmail` is now wired to report release (see below); guardian access does not exist yet, so `guardianAccessEmail` is unused. (Earlier note: `invitationEmail`, `guardianAccessEmail` and `resultReadyEmail` were all unused.)
- [2026-11] The Profile screens are built. They added questions now numbered 17, 22, 25 and 26, and no new role. The notification choices are stored but nothing reads them yet, and the three clinic emails are still wired to no flow, so for now they change nothing a person receives.
- [2026-11] The Profile page says a changed email takes effect "once you confirm". The sign-in service finished the change on one link locally although two are set, so that wording is stronger than what was seen (`docs/SECURITY.md` S-68).
- [2026-11] Invitations are built. They added the questions now numbered 2, 6 and 28, and no new role. The knowledge base already describes them (`content/knowledge-base.md`, the team invitations page, the accept page and the flow "Invitation"). The guardian-access email is not sent when a guardian accepts. A cancelled invitation sends no notice. The menu item "Team and settings" opens a page that holds invitations only.
- [2026-11] Sex at birth: the PRD and knowledge base call it sex at birth, but the column is `patient_profiles.sex` (comment added in migration `20261110120100`). Nothing in `app/` or `lib/` reads it, so panel choice, the day-21 cycle rule and the "missing value stops the step" check are not built. No screen edits `gender_identity`.
- [2026-11] The knowledge base Roles table says "There are six roles" yet lists seven rows including the nurse; the Pages table says "Ten screens are built" and the "Activity" page is under Planned clinic pages with "Built" in its text; the "My results" and results rows have a stray "None" column; the status line "Steps 1 to 7 as screens ... are planned" is out of date now results are built. Knowledge base flow 6 step 4 says "A message by WhatsApp is planned" while the decisions say GoHighLevel handles WhatsApp.
- [2026-11] The knowledge base "Access by role" table has no nurse column, and the profile table in section 5 here has none either. The knowledge base says only admins read the Activity screen; `lib/data/activity.ts` was not checked against the policy.
- [2026-11] Open questions reconciled: section 6 now uses the knowledge base's 33 numbers, and each entry shows its old number. Earlier PRD questions 13 (wording approval, answered in KB17), 14 (reply-to) and 16 (sending domain) were folded into question 17; question 12 (who else reads the knowledge base) is the owner's decision, not the clinic's, and sits at the end of section 6. Question 28 is partly built: the date of birth is required and an address mismatch needs confirmation, but an invitation may still go to a different address, and a team link is still the only check (no date of birth for staff). `docs/CONTEXT.md` still cites the old "PRD open question 11 answered, question 12" in its changelog.
