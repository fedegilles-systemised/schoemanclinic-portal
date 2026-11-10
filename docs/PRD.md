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
| Nurse | [2026-11] Exists and can sign in, with a profile and the clinic home. Has no access to patient records until the clinic decides what a nurse may do (question 7 in the knowledge base). Admins can invite a nurse. Built, uncommitted |
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
| Both | Profile `/portal/profile` and `/clinic/profile`: tabs by role (see "What each role can configure" below). Photo, name and phone, notification choices, sign-in security, and the clinic's read-only record or work profile | done [2026-11], uncommitted; locally verified, tablet widths and dark mode not checked |
| Both | Change password (current password asked; other devices signed out) and change sign-in email (current password asked; confirmation link sent to the new address) | done [2026-11], uncommitted |
| Doctor | Signature for letters, stored privately; used when letters are built | done [2026-11], uncommitted (storing only; nothing uses it yet) |
| Both | Notification choices: topics results, payments, appointments and messages, by email and in the portal | done [2026-11], uncommitted (stores the choice; GoHighLevel and the portal bell do not read it yet) |
| Patient | Lab orders | planned |
| Patient | My results `/portal/results` and a marker page `/portal/results/[markerId]`: released results only, each marker with its latest value, range, status and small trend; a marker opens a chart of every released value with the range as a band, a table of values and the doctor's comments | done [2026-11], uncommitted |
| Patient | Upload results (patient's own PDF from the portal). [2026-11] Agreed shape: PDF only, up to 5 files each time (the patient can upload again later), and the name on the report must match the name the patient registered with; a PA checks it is complete. Staff attaching files keep PDF, JPEG or PNG up to 10 MB | planned |
| Patient | Prescriptions. [2026-11] Repeat request at £30 replaces the clinic's Typeform; the approval is passed to SignatureRx, which the doctor signs with a PIN | planned |
| Patient | Appointments. [2026-11] Read-only list. There is no reschedule or cancel button anywhere: the page asks the patient to contact the team and shows the 48-hour policy | planned |
| Patient | Ask the clinic | planned |
| Patient | Letters and documents | planned |
| Patient | Privacy and consent | planned |
| Clinic | Patient list | planned |
| Clinic | Results review `/clinic/results` and a report page `/clinic/results/[id]`: a doctor checks each value, comments on values and releases (the system records who and when); a PA sees the report; a health coach sees released reports only | done [2026-11], uncommitted. Release needs a doctor. [2026-11] On release the patient gets a notice in the portal bell ("Your results are ready") and an email saying a new result is ready, with a sign-in link to `/portal/results` and no value or verdict: we never send results by email. No email is sent if the patient switched off results emails in their profile (topic results, channel email; no saved choice counts as on); the portal notice is still made. No email is sent if the patient has no account or the account is suspended; the doctor is told so on screen. If the email fails, the release still stands, the portal notice is kept and the doctor is told. The GoHighLevel message is not wired to release |
| Clinic | Add results `/clinic/results/new`: a PA or doctor picks the patient and sample date, optionally attaches the lab's file, and enters each value with its unit. A value in another unit is converted to UK units and the original value and unit are kept. Status is set automatically: low or high against the range, borderline when inside the range but within 5% of an edge, otherwise in range; only a doctor sets critical. Conversions use standard factors until the clinic sends its base units | done [2026-11], uncommitted. This is the import without AI |
| Clinic | Import queue (needs-match list, AI reading of PDFs, inbox forwarding) | planned |
| Clinic | Results by lab feed | planned |
| Clinic | Lab orders. [2026-11] Cycle guidance follows sex at birth: day 21 for regular periods, any day for irregular or none; a missing value stops the step and tells a PA | planned |
| Clinic | Activity `/clinic/activity`: admins read who opened or changed a patient's record: date, person and role, what was done, and the patient's name; no clinical values; newest first, fifty at a time. Opening a lab report is logged, at most once every ten minutes per person and report (`log_record_view`). Other record screens will log the same way when built | done [2026-11], uncommitted; only the report page logs views today |
| Clinic | Safeguarding alerts | planned |
| Both | Sex at birth and gender identity. Both are held on the patient record (`patient_profiles.sex` is sex at birth; `gender_identity` is new and free text, up to 60 characters). Sex at birth drives panels and cycle guidance and is never guessed | partly done [2026-11], uncommitted: the columns exist; no screen edits them and nothing yet uses them for panels or cycle guidance |
| Clinic | Team and settings: team invitations (a list with status, who sent it and when, filters, resend and cancel, and an "Invite someone" form). The menu item shows only to PAs and admins | done [2026-11], uncommitted; locally verified at desktop width, tablet and mobile not checked. Managing existing team members (roles, deactivation) and the clinic's tests, prices, partners and locations are planned |
| Both | Invitations: a PA or an admin invites a patient (for a record already held, or a new patient added with a name and date of birth), a guardian (relationship, and whether they may act) or, for admins only, a team member (doctor, PA, health coach, nurse or admin, with a job title). The person gets an email with a link that works once and for 3 days; they create an account with a password, or, if the address already has an account, sign in and add the access. A resend cancels the old link; a cancelled or expired link cannot be used. [2026-11] Checks added: a patient or guardian must enter a date of birth when accepting (the patient's own, or for a guardian the patient's); five wrong dates cancel the link and tell the sender. A patient invitation to an address different from the patient record's contact email needs the sender to confirm ("Send to this address anyway"). Notices in the portal bell, not approvals: other admins are told when a doctor or admin is invited, other PAs when a guardian who can act is invited | done [2026-11], uncommitted; locally verified, not tested with a real email |
| Both | Emails. Built [2026-11], uncommitted : four sign-in service emails (password reset, email change, confirmation code, password changed) and three clinic emails (invitation, guardian access, result ready), in the clinic's look, with no clinical values in any of them. Sent by the sign-in service for the first four (hosted set-up is manual and not done); of the three clinic emails the invitation is sent by the invitations feature, and the guardian access and result ready emails are wired to no flow | partly done; the guardian access flow is unbuilt. [2026-11] Wording rules agreed from the clinic's emails: every email closes with the clinic's phone, email and WhatsApp (`lib/email/contact.ts`, added by `lib/email/layout.ts`), the clinic's own emails open "Dear" and the first name and are signed "The Schoeman Clinic team". Clinic Hub sends the portal's own emails (sign-in, invitations, result ready) through Resend; GoHighLevel handles the clinic's own reminders and WhatsApp, managed by the team there. WhatsApp goes only to patients who agreed, and always alongside an alert to the PAs. Built in the templates, uncommitted |
| Both | Staff Knowledge base `/knowledge-base`: admins only, unlisted page for the clinic to validate roles, access, flows and open questions; sign-in brings an admin back to it (other roles go to their own home) | done [2026-11], uncommitted; not a patient feature |

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

[2026-11] The knowledge base (`content/knowledge-base.md`) now holds 33 numbered questions, grouped by topic. This list keeps its own numbering, which the Decisions and Findings below cite. Mapping to the knowledge base (KB): 1=KB1, 2=KB2 (and KB27), 3=KB3, 4=KB5, 5=KB19, 6=KB18, 7=KB10, 8=KB5, 9=KB4, 10=KB5 (patient switcher is KB-flow 11), 12 to 14 and 16 have no KB number (KB17 holds the sender question), 15=KB17, 17=KB22, 18=KB25, 19=KB23, 20=KB26, 21=KB17, 22=KB6, 23=KB6, 24=KB6, 25=KB28, 26=KB6, 27=KB2, 28=KB28, 29=KB12, 30=KB11. Questions 31 to 35 below are new.

1. **Access scope.** Do staff see all patients, or only those on their care team? `in_scope` currently returns true for any clinical staff member. The policies on the care team, patient profiles, guardian links, safeguarding alerts, repeat requests and result imports already go through it, so the answer is one change in the database, not a rewrite. It stays permissive until the clinic decides.
2. **Admins and clinical records.** May admins read clinical records? Currently no (least privilege); the draft distinguishes "clinical team" from "team".
3. **Health coach.** May the health coach read team-only tables? Currently no.
4. **Guardians.** What age and consent rules apply (for example under-18s, transition to adult access)?
5. **Retention.** What retention periods apply to clinical records, uploads and audit logs?
6. **Sign-in method.** The prototype shows magic link; the brief says email and password. Which one?
7. **AI extraction provider** for PDF imports: which provider, and what data-processing terms?
8. **Guardian links.** May PAs create verified guardian links alone, or is a second approver needed before a link gets `can_act`?
9. **Doctors who are patients.** May a doctor see their own unreleased results and safeguarding alerts?
10. **Several patients.** Do guardians of more than one patient need a patient switcher?

11. **Knowledge base visibility.** ANSWERED [2026-11]: admins only (see Decisions). Left here so the numbering holds.
12. **Who else may read the knowledge base.** The page is admins only, but the clinic's owner is a doctor, and the doctors who need it cannot open it. Should those doctors also be given the admin role (which widens their power), or should another role (for example doctors) be allowed to read the page? Needs the owner's decision.
13. **Email wording.** Who approves the wording of the seven emails (the owner, the clinic's doctors, or both)? The tone is calm, with no medical promises.
14. **Reply-to address.** Which address receives replies to emails (`EMAIL_REPLY_TO`), or should replies be turned off?
15. **Result-ready email.** Is it sent from Clinic Hub, or left to GoHighLevel's reminders, which already carry messaging? It says only that a result is ready and links to the portal; it never holds a value.
16. **Sending domain.** Which domain sends the email, and how is it spelled (`systemizedtoscale` or `systemisedtoscale`)?
17. **Patient contact details.** May a patient edit their own phone and contact email on the record, or only through the clinic? Today the record is read-only and says "contact the clinic"; the account phone (Details tab) is the one they can edit and is separate from the record's contact phone. Which one does the clinic use to reach them?
18. **WhatsApp and SMS.** When do they join the notification choices? Only email and the portal are offered until GoHighLevel is connected and the clinic has agreed consent wording for each channel.
19. **Patient photos.** Who may see a patient's photo? Today the patient, and every doctor, PA and admin whatever their care team, but not the health coach or a guardian. Should it follow the care team, include the coach, or should patients not have photos at all?
20. **Changing a sign-in email.** Is it right that anyone may do it themselves, with a confirmation link and their password, or should the clinic do it (for patients especially, because a changed email takes over the account)? The safer position is open until the clinic decides (`docs/SECURITY.md` S-68, S-69).
21. **Notification choices that cannot be turned off.** Should some messages (a result is ready, a payment failed, safeguarding follow-up) ignore the choices?
22. **Second approval for team invitations.** Admins can invite a doctor or another admin, and the link is the only check. Should that need a second admin's approval, or at least an email to the other admins when it is sent and when it is accepted? (`docs/SECURITY.md` S-43 note, S-74, S-75.)
23. **Who may invite patients and guardians.** PAs and admins can today. Should admins invite patients and guardians at all, given that they have no clinical access and an invitation to a second address of their own would give it (see question 2; S-75)? Should a guardian invitation that lets the guardian act (`can_act`) need a second person, as in question 8?
24. **Do doctors invite their own patients?** Today only PAs and admins can; a doctor has to ask a PA.
25. **Proof that the right person has the link.** A mistyped or forwarded address gives a stranger a patient's portal. Should the invited person also enter their date of birth (and a guardian the patient's) before the account is made, and should an invitation go only to the contact email already on the patient's record? (S-74.)
26. **Managing existing team members.** The Team and settings page lists invitations only. Who may change a member's role, deactivate them or restore them, and should that need a second approver?
27. **Patient list for admins.** The invitation form loads every patient's name and reference for admins as well as PAs. Do admins need to see it, or should they search by name only? (S-83.)

28. **Are notices enough?** [2026-11] When a doctor, an admin or a guardian who can act is invited, other admins or PAs get a notice in the portal bell only. Is that enough, or should the notice also go by email, or should a second person approve before the invitation is sent? Is the patient's date of birth enough proof that the right person opened the link, or does the clinic want more for guardians who can act? (Partly answers question 25 as built; extends 22 and 23. Same as question 28 in the knowledge base.)

29. **Markers, units and ranges.** [2026-11] Which markers are tested, what are the clinic's base units and ranges in UK units, and which range does the patient see when a lab's differs? Is "borderline" right at within 5% of an edge? (Knowledge base Q12; the call of 6 November asked for UK units.)
30. **Release rules.** [2026-11] Only a doctor releases today. May a PA release normal results? Is a second doctor needed for critical values? Do some markers need a hold-back? (Knowledge base Q11.)

31. **What may a nurse do?** [2026-11] A nurse signs in and sees no patient records. Which records may a nurse read or change, and may they see results before release? (Knowledge base Q7.)
32. **Notes locked and versioned for CQC.** [2026-11] The clinic needs notes locked once a doctor signs them off, with versions kept. Does Semble or Clinic Hub hold them, who may reopen a signed note, and what is kept of each version? Assumed: Semble, as today. (Knowledge base Q32.)
33. **Four lab choices.** [2026-11] The clinic's flow offers the clinic's own lab (not yet live, the patient pays the lab directly), TDL, a TDL home kit and "I have my own results". Should ordering follow those choices instead of a doctor creating an order? Assumed: no, until confirmed. (Knowledge base Q33.)
34. **Registration, ID and consent.** [2026-11] Must a PA check ID before a patient gets in, and which of the clinic's Semble form and the portal is the record that counts? Not built. (Knowledge base Q29.)
35. **Retention for CQC and for under-18s.** [2026-11] Sharpens question 5: the clinic has its own retention rules for patients under 18. (Knowledge base Q19.)

## 7. Decisions

- [2026-11] MVP centres on the bloods loop; messaging, reminders, calendar, invoices and marketing stay in GoHighLevel, notes in Semble. Prescribing goes through SignatureRx, not Semble (corrected after the clinic's patient flow V8).
- [2026-11] After comparing the clinic's patient flow V8, its email wording and the emails since with our assumptions: (a) a nurse role exists, signs in, and has no patient access until the clinic decides (question 31); (b) the admin has an Activity screen showing who opened or changed a patient's record, and opening a report is logged at most once every ten minutes; (c) every email closes with the clinic's phone, email and WhatsApp, opens "Dear" and signs off "The Schoeman Clinic team"; Clinic Hub sends the portal's own emails through Resend and GoHighLevel handles the clinic's own reminders and WhatsApp; (d) there is no reschedule or cancel button: the team handles it and the 48-hour policy is shown; (e) sex at birth and gender identity are both kept; sex at birth drives panels and cycle guidance (day 21 for regular periods, any day otherwise) and a missing value stops the step and tells a PA; (f) a patient's own upload will take PDF only, up to 5 files each time, in the name matching the registration. (a), (b) and (c) are built; (d), (e) and (f) describe screens not yet built.
- [2026-11] Least privilege by default: admins and the health coach have no clinical access until the clinic decides otherwise.
- [2026-11] Patients see results only after doctor release; safeguarding alerts are doctors only.
- [2026-11] Owner decision: multi-factor sign-in for staff and a CAPTCHA on sign-in are deferred until the clinic has accounts to enrol. Neither is built, and neither is in the MVP scope above.
- [2026-11] Sessions end on their own: staff after 12 hours or 30 minutes idle, patients and guardians after 7 days or 2 hours idle. A signed-out person sees "You were signed out to protect your account. Please sign in again." An open screen asks the server to check every few minutes while the person is active, so an abandoned screen does not stay readable.
- [2026-11] Every change to records made by the system rather than a person is attributed to the person it acts for or to a named background job in the audit log.
- [2026-11] The knowledge base is for admins only (the owner first chose signed-in staff, then narrowed it to the admin role; answers open question 11). Doctors, PAs, the health coach, patients and guardians are sent to their own area; signed-out visitors go to sign in and an admin returns to the page. Open question 12 asks whether doctors should get access.
- [2026-11] The knowledge base (`content/knowledge-base.md`, shown at `/knowledge-base`) is a stakeholder deliverable: the owner shares it with the clinic so they can confirm the roles, access, flows and its 33 open questions (it overlaps with section 6, which stays the shorter list). Its access table is derived from the row-level security policies, so it must be re-checked whenever policies change.

- [2026-11] Invitations decisions, as built. Admins invite every kind (patient, guardian, team member); PAs invite patients and guardians; doctors, health coaches and patients invite nobody. A link works once and for 3 days; a resend cancels the old link and makes a new one. There is **no second approval** for any kind, including doctor and admin (questions 22 and 23). Sign-up is by invitation only. A person whose address already has an account signs in to accept and the access is added to that account (a doctor can also be a guardian or a patient); the signed-in address must equal the invited one. A new patient can be added from the invitation form with a name and date of birth; the clinic reference is made automatically. **Admins see every invitation and the list of patient names for the form, but no clinical record** (question 2 stays open). Acceptance is recorded under the person who invited. Cancelling does not tell the invited person; they see "no longer valid".
- [2026-11] Invitation checks, as built. Patient and guardian invitations need a date of birth at acceptance; five wrong dates cancel the link and tell the sender. A patient invitation to an address other than the record's contact email needs the sender's confirmation. Other admins are told when a doctor or admin is invited, and other PAs when a guardian who can act is invited. These are notices, not approvals, so the "no second approval" decision above still stands; question 28 asks whether it should.
- [2026-11] Profile decisions. Patient contact details on the record are read-only in the app: a patient who wants one changed contacts the clinic (open question 17 asks whether that should change). Notification choices offer email and the portal only for now; WhatsApp and SMS join when GoHighLevel is connected (question 18). Anyone may change their own sign-in email, confirmed by a link sent to the new address and by asking for their current password (question 20). Signatures are for doctors only, stored privately, and used only when letters are built. Photos are for everyone. Roles, work profile and guardian links are managed by the clinic, not by the person.
- [2026-11] A missing notification choice counts as on, so a new person hears about everything until they turn something off.
- [2026-11] No email carries a result, a value, a diagnosis or a medicine. It says that something is ready, or that an account is offered, and links to the portal.

- [2026-11] Results decisions, as built. Results are entered by hand, without AI: a PA or doctor types each value from the lab's report. Values convert to UK units on entry and the original is kept. Status is automatic (low, high, borderline within 5% of an edge, in range) and only a doctor sets critical. Only a doctor releases; one doctor is enough; no hold-backs. The patient sees the range held for each marker. These are assumptions the clinic has not confirmed (open questions 29 and 30; knowledge base Q10, Q11, Q12).

## Findings

- [2026-11] Result-ready email on release: the code now reads the patient's saved choice for results by email and skips the email if it is off (no saved choice counts as on); the portal notice is created whatever they chose. When the email is skipped for that reason the doctor still sees "The patient has been told", which is true only of the portal notice. The clinic should confirm a result-ready email may be switched off. The email goes to the sign-in address on the account, not the patient record's contact email; the two can differ. The "no account or suspended" and "email failed" cases are reported to the doctor on screen only, and are not logged anywhere else; not tested with a real email.

- [2026-11] Results are built and uncommitted (migration `20261109120000_results_entry_and_release.sql`, pgTAP `06_results.test.sql`). The bloods loop is still partial: lab orders, Stripe payment and barcode, the lab feed, patient upload and AI reading are not built, so results enter only by hand. The bell notice and the "result ready" email on release are now both built (`lib/results/actions.ts`, `release_report`); see the 2026-11 finding below on notification choices. Open question 7 (AI provider) stays open. The nav, dashboards and the "Coming soon" note in section 5 may still show disabled buttons for results; not checked. The knowledge base's flow 5 step 3 still describes the AI step as if built, while its status line says it is not.
- [2026-11] Earlier finding that sign-in and dashboard routes do not exist no longer holds: `/login`, `/forgot-password`, `/update-password`, `/auth/confirm`, `/portal` and `/clinic` exist (committed in `c831ccf`).
- [2026-11] Sign-in method differs between prototype (magic link) and brief (email and password); `CLAUDE.md` lists forgot and update password routes, which implies passwords. The code implements email and password, so the question is effectively settled unless the clinic wants magic link.
- [2026-11] Sign-in hardening (attempt limits, session limits, signed session cookies, content security policy, scoped audit actor) is built but uncommitted and not yet on the hosted project. It adds no screen and changes no scope.
- [2026-11] The knowledge base lists 21 open questions and this document 10 (plus question 11 above). They are not reconciled yet; after the clinic answers, update both. It adds no scope and no role.
- [2026-11] Emails: `invitationEmail` is now wired to the invitations feature; `resultReadyEmail` is now wired to report release (see below); guardian access does not exist yet, so `guardianAccessEmail` is unused. (Earlier note: `invitationEmail`, `guardianAccessEmail` and `resultReadyEmail` were all unused.) The knowledge base's email table was updated by the main session; its open-question count and this document's are still not reconciled.
- [2026-11] The Profile screens are built and uncommitted. They add five open questions (17 to 21) and no new role. The notification choices are stored but nothing reads them yet, and the three clinic emails are still wired to no flow, so for now they change nothing a person receives. The knowledge base (`content/knowledge-base.md`) was edited in the same working tree; its open-question count is still not reconciled with this document.
- [2026-11] The Profile page says a changed email takes effect "once you confirm". The sign-in service finished the change on one link locally although two are set, so that wording is stronger than what was seen (`docs/SECURITY.md` S-68).
- [2026-11] Invitations are built and uncommitted. They add questions 22 to 27 and no new role. The knowledge base already describes them (`content/knowledge-base.md`, the team invitations page, the accept page and the flow "Invitation"); its question list and this one are still not reconciled. The guardian-access email is not sent when a guardian accepts. A cancelled invitation sends no notice. The menu item "Team and settings" opens a page that holds invitations only.
- [2026-11] Reconciliation with the knowledge base's 33 questions, partly done. Could not reconcile: (1) the numbering still differs, so this list carries a mapping rather than the same numbers; (2) PRD questions 12 to 14 and 16 (who else reads the knowledge base, email wording approval, reply-to address, sending domain) have no knowledge base counterpart, and KB17 now answers wording approval (the clinic approves; Mary Anne rewrites, Gina approves) but I did not remove 13; (3) KB20 (data protection lead), KB30 (education and wearables) and KB31 (moving from Semble) are not in this list because they add no MVP scope; (4) KB29 (ID and consent at first sign-in) is a new requirement the call agreed but no screen or table exists, so it is not a feature row; (5) the knowledge base says the Activity screen and the nurse are "Built" while the changes are uncommitted.
- [2026-11] Sex at birth: the PRD and knowledge base call it sex at birth, but the column is `patient_profiles.sex` (comment added in migration `20261110120100`). Nothing in `app/` or `lib/` reads it, so panel choice, the day-21 cycle rule and the "missing value stops the step" check are not built. No screen edits `gender_identity`.
- [2026-11] The knowledge base Roles table says "There are six roles" yet lists seven rows including the nurse; the Pages table says "Ten screens are built" and the "Activity" page is under Planned clinic pages with "Built" in its text; the "My results" and results rows have a stray "None" column; the status line "Steps 1 to 7 as screens ... are planned" is out of date now results are built. Knowledge base flow 6 step 4 says "A message by WhatsApp is planned" while the decisions say GoHighLevel handles WhatsApp.
- [2026-11] The knowledge base "Access by role" table has no nurse column, and the profile table in section 5 here has none either. The knowledge base says only admins read the Activity screen; `lib/data/activity.ts` was not checked against the policy.
- [2026-11] Question 25 (date of birth, contact email only) is now partly built: the date of birth is required and the address mismatch needs confirmation, but an invitation may still go to a different address. Decision above, line "Invitations decisions, as built", still says the link is the only check for team invitations, which holds (no date of birth for staff). The knowledge base now has 28 open questions; this document's list is still shorter and not reconciled. The decision about the knowledge base mentions "21 open questions", which is out of date.
