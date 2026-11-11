# Clinic Hub: product requirements

Owner: `prd-keeper`. Last updated [2026-11]. Latest change [2026-11]: brought in step with the clinic's decisions of 11 November 2026 (`content/knowledge-base.md`, "Decided by the clinic on 11 November") and with what branch `feat/clinic-decisions-nov` builds.

## 1. Context and problem

The Schoeman Clinic (hormone, longevity and functional medicine, London) needs a patient portal and a clinic portal. Today results, orders and requests are spread across GoHighLevel, Semble, email and PDFs, so staff re-key data and patients cannot see their bloods in one place or follow a trend over time.

## 2. Goals

- Run the bloods loop end to end in one place.
- Give patients a clear, calm view of their results and trends, shown only after a doctor releases them.
- Cut manual import and chasing work for PAs and doctors.
- Keep clinical data private by default, enforced in the database (row-level security), with access set by the patient's care team.
- [2026-11] Replace Semble in stages: clinical notes and, later, appointments move into Clinic Hub.

## 3. MVP scope

The MVP is built around the bloods loop: order, Stripe payment and barcode, results by lab feed or PDF import with PA review, doctor review and release, then the patient sees the trend.

**In:** the bloods loop above; sign-in; patient and clinic home dashboards; the screens listed in section 5. [2026-11] The clinic added to the build (question 21): clinical notes, education content and wearables.

**Stays elsewhere, or moves later:**
- GoHighLevel keeps messaging, reminders, tasks, invoices and marketing. [2026-11] Clinic Hub will send messages by email and WhatsApp through GoHighLevel, connected with a private integration key (question 17); not built. The Christmas prescription email is sent from GoHighLevel.
- [2026-11] Booking: the clinic decided appointments move into Clinic Hub (question 15). Patient booking in Clinic Hub is not built, so booking stays in GoHighLevel for now. The staff Calendar in section 5 shows each team member's own Google Calendar and does not book patients.
- [2026-11] Semble: consultation notes no longer stay in Semble. Notes are written in Clinic Hub (built) and Semble is retired in stages (questions 15 and 32). What moves from Semble, and when, is open (question 31).
- Prescribing goes through SignatureRx, where the doctor signs with a PIN (the clinic's patient flow V8). [2026-11] Not built.
- [2026-11] Fathom is to be replaced by call recording and transcription inside Clinic Hub (question 16). Not built.

## 4. Roles

[2026-11] Access follows the care team (clinic decision, questions 1 to 3 and 7; migration `20261112120100_access_by_care_team.sql`, function `private.in_scope`). PAs and admins see every patient. Doctors, nurses and health coaches see only the patients whose care team they are on, from the `since` day until the `until` day. Inside that scope they see the whole record, except as stated below.

| Role | Purpose and access |
|---|---|
| Patient | Sees own record, released results, assigned education courses and own wearable readings; enters wearable readings; will order tests, upload results and ask the clinic (not built). [2026-11] Cannot remove a guardian |
| Guardian | Verified by the clinic; sees a patient's account, and with "can act" acts for them (for example enters wearable readings). Not a role in the database: a verified guardian link. [2026-11] A PA can create a link that lets a guardian act, with no second approver. Age and consent rules for under-18s are still to be set |
| Doctor | Care-team patients only. Reads the whole record, enters results, writes and signs notes, records allergies, diagnoses and prescriptions, sees and writes safeguarding alerts, and is the only role that releases results. [2026-11] Keeps the care team up to date, invites their own patients (a new patient they invite joins their care team as primary doctor) and opens Team and settings |
| Nurse | [2026-11] Care-team patients only. Works like a doctor: reads the record, enters results, records allergies, writes and signs notes, works the import queue. Diagnoses, prescribing, safeguarding alerts and release stay with doctors. Built (was: no patient access) |
| PA | [2026-11] Every patient. Reads the record, enters results, works the import queue, records allergies, manages orders, invites patients and guardians, keeps the care team up to date, links guardians. Does not release results, write notes or see safeguarding alerts |
| Health coach | [2026-11] Care-team patients only. Sees everything about them, including unreleased results, notes, diagnoses and medications, except safeguarding alerts. Writes and signs notes. Does not enter or release results (was: released results only) |
| Admin | [2026-11] Every patient. Reads every clinical record, including locked notes, but writes no clinical data. Manages team, roles and settings; invites anyone; keeps the care team up to date; builds the education library; reads the Activity screen (was: no clinical record access) |

A doctor who is also a patient sees, as a patient, only what any patient sees (question 4).

## 5. Features

Status is "done" only where the screen and data path exist in code. Current state [2026-11]: foundations, sign-in, role routing, the app shell, both home screens, profile, invitations, results entry, review and release, the patient's results, the Activity screen, the staff Calendar, and on branch `feat/clinic-decisions-nov` access by care team, the Patient list and record, clinical notes, education and manual wearable readings. Nav items for unbuilt screens are disabled and show "Coming soon". The new migrations (`20261112120000` to `20261112120400`) were read for this document, not run by it.

| Area | Feature | Status |
|---|---|---|
| Foundation | Next.js and Supabase scaffold, design tokens, restyled components | done [2026-11] |
| Both | Sign-in (email and password, forgot and update password, no sign-up) | done [2026-11] |
| Both | Role routing (patient and guardian to `/portal`, clinic staff to `/clinic`) | done [2026-11] |
| Both | App shell (navigation, user menu, notifications bell) | done [2026-11]; unbuilt nav items disabled |
| Patient | Home dashboard `/portal` | done [2026-11]; real data, all action buttons disabled |
| Clinic | Dashboard `/clinic` | done [2026-11]; real data, all action buttons disabled |
| Both | Profile `/portal/profile` and `/clinic/profile`: tabs by role (see "What each role can configure" below). Photo, name and phone, notification choices, sign-in security, and the clinic's read-only record or work profile | done [2026-11]; locally verified, tablet widths and dark mode not checked |
| Both | Change password (current password asked; other devices signed out) and change sign-in email (current password asked; confirmation link sent to the new address; the old address is told) | done [2026-11] |
| Doctor | Signature for letters, stored privately; only doctors sign letters (question 24) | done [2026-11] (storing only; nothing uses it yet) |
| Both | Notification choices: topics results, payments, appointments and messages, by email and in the portal | done [2026-11] (release reads the results-by-email choice; nothing else reads them yet). [2026-11] WhatsApp is offered once GoHighLevel is connected, off until the patient turns it on (question 25): planned |
| Clinic | Access by care team [2026-11]: `private.in_scope` gives PAs and admins every patient, and doctors, nurses and health coaches the patients whose care team they are currently on. The nurse is clinical staff and can be on a care team (`care_relationship` gains `nurse`). Health coaches and admins read unreleased results in scope; safeguarding alerts stay with doctors in scope; diagnoses and medications are written by doctors only; release is doctor only | done [2026-11] in the database (`20261112120000_care_team_nurse.sql`, `20261112120100_access_by_care_team.sql`) |
| Clinic | Patient list `/clinic/patients` [2026-11]: the patients this person may see (every patient for PAs and admins; care-team patients for the others), with date of birth and care team. PAs, admins and doctors add someone to a patient's care team (doctor, primary doctor, nurse, PA, health coach) or remove them | done [2026-11] |
| Clinic | Patient record `/clinic/patients/[id]` [2026-11]: clinic reference, name, date of birth and care team; education courses on the patient's portal (add and take away); the patient's wearable readings; clinical notes. Opening it is written to the activity log, and the page is not shown if the log cannot be written | done [2026-11] for those parts. Results, allergies, diagnoses, medications, documents, appointments and safeguarding are not on this page yet (prototype `c-record` has more) |
| Clinic | Clinical notes on the patient record [2026-11]: doctors, nurses and health coaches on the care team write a draft, edit or archive their own draft, and sign it. A signed note is locked for everyone (database trigger); a correction is a new version that supersedes it and is signed in turn; nothing is deleted. Everyone who may open the record reads the notes, admins included. Patients and guardians do not see notes | done [2026-11] (`20261112120300_clinical_notes.sql`, `lib/notes/actions.ts`) |
| Clinic | Call recording and transcription [2026-11]: replaces Fathom. From a patient's record a team member records the call; both sides are transcribed and saved as a draft note that the author checks and signs. The clinic already holds consent to record. Needs a transcription service | planned. The notes table already accepts a `recording` source and the page shows a "From a recording" badge; nothing records or transcribes |
| Clinic | Education library `/clinic/education` and course page `/clinic/education/[id]` [2026-11]: admins build courses of sections and modules (text and an optional https video link) and publish them; every staff member reads the library. Staff who can open a patient's record add a published course to that patient's portal, or take it away | done [2026-11]; starts empty for the clinic's own content |
| Patient | Education `/portal/education` and `/portal/education/[id]` [2026-11]: the published courses assigned to the patient (or to a patient the guardian looks after) | done [2026-11] |
| Patient | Wearables `/portal/wearables` [2026-11]: the patient, or a guardian who can act, types in daily readings (sleep, readiness, resting heart rate, HRV, steps, active minutes, weight, body fat, VO2 max, SpO2, temperature deviation) with an optional device name; they archive a reading they entered. Staff in scope read them on the patient record | done [2026-11] for manual entry. Device connections (Oura, Whoop, Garmin and so on) come next: planned |
| Patient | Lab orders. [2026-11] Clinic Hub follows the clinic's four choices for bloods: the clinic's own lab, TDL, a TDL home kit, or the patient's own results. Only TDL and the home kit are paid through Stripe and get a barcode (question 33) | planned |
| Patient | My results `/portal/results` and a marker page `/portal/results/[markerId]`: released results only, each marker with its latest value, range, status and small trend; a marker opens a chart of every released value with the range as a band, a table of values and the doctor's comments | done [2026-11] |
| Patient | Upload results (patient's own PDF from the portal). [2026-11] Agreed shape: PDF only, up to 5 files each time (the patient can upload again later), and the name on the report must match the name the patient registered with; a PA checks it is complete. Staff attaching files keep PDF, JPEG or PNG up to 10 MB | planned |
| Patient | Prescriptions. [2026-11] Repeat request at £30 replaces the clinic's Typeform and is requested three weeks before the supply runs out. When the patient has paid, the admins, the PAs and the doctor are told that payment is made and the prescription is to be offered (question 13). The approval goes to SignatureRx, which the doctor signs with a PIN (question 24) | planned (payment alerts and SignatureRx not built) |
| Patient | Appointments. [2026-11] Read-only list. There is no reschedule or cancel button anywhere: the page asks the patient to contact the team and shows the 48-hour policy. Patient booking inside Clinic Hub is agreed (question 15) | planned |
| Patient | Ask the clinic. [2026-11] Replies show in the portal with a status; the page says it is not for emergencies; response times are agreed later (question 14). A patient who wants their contact details changed messages the clinic here (question 22) | planned |
| Patient | Letters and documents | planned |
| Patient | Privacy and consent. [2026-11] Follows the clinic's policy at https://theschoemanclinic.com/privacy/; questions go to info@theschoemanclinic.com (question 20). Photo ID and consent at first sign-in are still open (question 29) | planned |
| Clinic | Results review `/clinic/results` and a report page `/clinic/results/[id]`: a doctor checks each value, comments on values and releases (the system records who and when). [2026-11] Who sees reports follows `in_scope`: PAs and admins every report, doctors, nurses and health coaches their care-team patients' reports, released or not | done [2026-11]. Release needs a doctor. On release the patient gets a notice in the portal bell ("Your results are ready") and an email saying a new result is ready, with a sign-in link to `/portal/results` and no value or verdict: we never send results by email. No email is sent if the patient switched off results emails in their profile (topic results, channel email; no saved choice counts as on); the portal notice is still made. No email is sent if the patient has no account or the account is suspended; the doctor is told so on screen. If the email fails, the release still stands, the portal notice is kept and the doctor is told. The GoHighLevel message is not wired to release |
| Clinic | Add results `/clinic/results/new`: a PA, doctor or [2026-11] nurse picks the patient and sample date, optionally attaches the lab's file, and enters each value with its unit. A value in another unit is converted to UK units and the original value and unit are kept. Status is set automatically: low or high against the range, borderline when inside the range but within 5% of an edge, otherwise in range; only a doctor sets critical. Conversions use standard factors until the clinic sends its base units | done [2026-11]. This is the import without AI |
| Clinic | Import queue (needs-match list, AI reading of PDFs, inbox forwarding). [2026-11] The nav item shows to PAs, doctors and nurses | planned |
| Clinic | Results by lab feed | planned |
| Clinic | Lab orders. [2026-11] Cycle guidance follows sex at birth: day 21 for regular periods, any day for irregular or none; a missing value stops the step and tells a PA | planned |
| Clinic | Activity `/clinic/activity`: admins read who opened or changed a patient's record: date, person and role, what was done, and the patient's name; no clinical values; newest first, fifty at a time. Opening a lab report or [2026-11] a patient record is logged, at most once every ten minutes per person and record (`log_record_view`). [2026-11] Since access by care team, admins and nurses opening a record are logged too | done [2026-11]; other record screens will log the same way when built |
| Clinic | Safeguarding alerts | planned (database: doctors in scope only) |
| Clinic | Guardian links. [2026-11] A PA links a guardian (through an invitation) and may let them act; a PA or an admin removes a guardian; a patient cannot (question 5) | partly done: PA linking through invitations is built; the database lets a PA change a link, but no screen does; removal by an admin is not built |
| Both | Sex at birth and gender identity. Both are held on the patient record (`patient_profiles.sex` is sex at birth; `gender_identity` is new and free text, up to 60 characters). Sex at birth drives panels and cycle guidance and is never guessed | partly done [2026-11]: the columns exist; no screen edits them and nothing yet uses them for panels or cycle guidance |
| Clinic | Team and settings: team invitations (a list with status, who sent it and when, filters, resend and cancel, and an "Invite someone" form). [2026-11] The menu item shows to PAs, admins and doctors | done [2026-11]; locally verified at desktop width, tablet and mobile not checked. Managing existing team members (roles, deactivation) and the clinic's tests, prices, partners and locations are planned |
| Both | Invitations: a PA or an admin invites a patient (for a record already held, or a new patient added with a name and date of birth), a guardian (relationship, and whether they may act) or, for admins only, a team member (doctor, PA, health coach, nurse or admin, with a job title). [2026-11] A doctor invites patients, but only their own: a patient on their current care team, or a new patient, who then joins their care team as primary doctor; a doctor resends or cancels only those and reads the patient invitations they sent. The person gets an email with a link that works once and for 3 days; they create an account with a password, or, if the address already has an account, sign in and add the access. A resend cancels the old link; a cancelled or expired link cannot be used. A patient or guardian must enter a date of birth when accepting; five wrong dates cancel the link and tell the sender. A patient invitation to an address different from the patient record's contact email needs the sender to confirm. Notices in the portal bell, not approvals: other admins are told when a doctor or admin is invited, other PAs when a guardian who can act is invited. [2026-11] When a doctor or an admin is invited, drgina@theschoemanclinic.com is also emailed (`TEAM_INVITE_ALERT_TO`); a failed alert email does not stop the invitation | done [2026-11]; locally verified, not tested with a real email |
| Both | Emails. Built [2026-11]: four sign-in service emails (password reset, email change, confirmation code, password changed) and four clinic emails (invitation, guardian access, result ready, and [2026-11] the team invitation alert to Dr Gina Schoeman), in the clinic's look, with no clinical values in any of them. Every email closes with the clinic's phone, email and WhatsApp; the clinic's own emails open "Dear" and the first name and are signed "The Schoeman Clinic team". Clinic Hub sends the portal's own emails through Resend | partly done; the guardian access email is wired to no flow. [2026-11] Messages by email and WhatsApp through GoHighLevel (a plug-in turns GoHighLevel texts into WhatsApp) are planned (questions 17 and 25). WhatsApp goes only to patients who agreed, and always alongside an alert to the PAs |
| Clinic | Calendar `/clinic/calendar`: every team member (doctor, PA, health coach, nurse, admin) connects their own Google Calendar and sees one week at a time, Monday to Sunday, in London time, with previous, this and next week. They add, edit or delete timed events (title, date, start and end time, place, notes), which are written to their main Google calendar straight away; changes made in Google show here. Repeating events show as single occurrences. All-day events can be deleted here but are edited in Google. Each event links to Google. The add form asks staff to use a patient's clinic reference rather than their full name (advice only, not checked). Disconnecting revokes access at Google and deletes the stored token. The token is encrypted on the server and never reaches the browser; connecting and disconnecting are in the audit log, event changes are not. No patient or guardian access | done in code [2026-11]: the route, nav item and migration `20261111120000_google_calendar_connections.sql` are in this branch's tree. Earlier caveats (migration and pgTAP test run against a database, security review) are not re-checked here (see Findings) |
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

A nurse sees the same as a PA in this table (details, security and notifications as for every staff role; work profile read only); the table has no nurse column yet.

A doctor who is also a patient sees the patient tabs under `/portal/profile` and the work tabs under `/clinic/profile`. The roles shown are set by the clinic and cannot be changed here. Session lengths are shown, not editable.

## 6. Open questions for the clinic

[2026-11] One list. The knowledge base (`content/knowledge-base.md`, "Open questions for the clinic") is the list the clinic answers, and this section uses its numbers. On 11 November 2026 the clinic answered every question except 8, 9, 10, 11, 12, 29 and 31; the answers are in section 7. Each open entry adds what the build assumes today.

8. **Orders and payment.** Barcodes, where samples are taken, fixed prices, unpaid orders and refunds. The four lab choices are decided (question 33); nothing is built yet.
9. **Lab feed.** Which labs send results electronically, in what format, and what happens to an unknown barcode or marker. Nothing built yet.
10. **AI reading of PDFs.** Which provider, which data-processing terms, which inbox, how long originals are kept. Results are entered by hand until this is answered. (was 7)
11. **Release rules.** Only a doctor releases today, and one doctor is enough. May a PA release normal results? Is a second doctor needed for critical values? Do some markers need a hold-back? A nurse does not release (decided, question 7). (was 30)
12. **Markers, units and ranges.** Which markers are tested, what are the clinic's base units and ranges in UK units, and which range does the patient see when a lab's differs? Is "borderline" right at within 5% of an edge? Standard conversion factors are used until then. (was 29)
29. **Registration, ID and consent.** The clinic's Semble registration form already asks for photo ID and three consents, and the call of 6 November agreed to ask for them again at the first portal sign-in. Which one is the record that counts, can one be dropped, and must a PA check the ID before the patient gets in? The clinic's answer to question 28 names "the ID at first sign-in" as a check, which assumes this is built. Not built. (was 34)
31. **Moving over from Semble.** What moves (historical PDFs, notes, contacts), who checks it, and when to train the team. Now that notes are written in Clinic Hub and Semble is to be retired in stages, this decides go-live. The Semble login has been shared; nothing moves until we know what its API exports.

Residue of answered questions, still to settle with the clinic but not on the knowledge base's open list:
- Age and consent rules for under-18s and the move to adult access (from question 5).
- Response times for "Ask the clinic" (from question 14).

**Added by this document, not in the knowledge base's list**

34. **Staff Google Calendar.** (a) *Patient names in Google.* Event titles, places and notes are stored in Google, outside Clinic Hub. May staff put a patient's name there, or only the clinic reference? Does the clinic's Google account have a data-processing agreement that covers patient data? Assumed today: the form advises the clinic reference, and nothing enforces it. (b) *Google app verification.* Until the clinic's Google project is verified staff see "Google hasn't verified this app". Who owns the Google Cloud project, and should the clinic apply for verification? (c) *GoHighLevel overlap.* If GoHighLevel syncs bookings to staff calendars, they show here and can be edited here, which may not change, or may wrongly change, the booking in GoHighLevel. [2026-11] The clinic's answer to question 15 (appointments move into Clinic Hub; staff see and add appointments through their own Google Calendar) does not settle (a) to (c).

**Not for the clinic: the owner's decisions**

- **Who else may read the knowledge base.** It is for admins only, but the clinic's owner is a doctor and doctors cannot open it. Should doctors get the admin role (which widens their power, and since 11 November means reading every record), or should another role be allowed to read the page? (was 12)

## 7. Decisions

### Decided by the clinic on 11 November 2026 [2026-11]

From `content/knowledge-base.md`. "Built" is checked against this branch's code; where this document's check differs from the knowledge base, see Findings.

- **Access (questions 1 to 3).** PAs and admins see every patient; doctors, nurses and health coaches see only their care-team patients. PAs, admins and doctors keep the care team up to date on the Patient list. Admins read every clinical record, including locked notes. A health coach sees everything about their care-team patients except safeguarding alerts. Built.
- **Doctors who are patients (question 4).** As a patient, they see only what any patient sees. Built.
- **Guardians (question 5).** A PA can create a link that lets a guardian act, with no second approver. A patient cannot remove a guardian; a PA or an admin does. PA linking built; removal screens not built; under-18 rules to be set.
- **Invitations (questions 6 and 28).** Doctors invite their own patients; a new patient a doctor invites joins their care team as primary doctor. When a doctor or an admin is invited, drgina@theschoemanclinic.com is emailed as well as the bell notice to other admins. No second approval. Date of birth at acceptance, and for patients the ID at first sign-in, are the identity checks. Built, except the ID check (question 29).
- **Roles (question 7).** Doctor, nurse, health coach, PA and admin, plus patients and guardians. A nurse works like a doctor on care-team patients; diagnoses, prescribing, safeguarding alerts and release stay with doctors. Built.
- **Repeat prescriptions (question 13).** Requested three weeks before they run out; on payment the admins, the PAs and the doctor are told. Not built.
- **Messages (question 14).** Replies show in the portal with a status; not for emergencies. Not built.
- **Source of truth (questions 15 and 32).** Everything moves into Clinic Hub. Clinical notes are written here, locked once signed and corrected only by a new version: built. Staff connect their own Google Calendar: built. Patient booking in Clinic Hub: not built.
- **Fathom and accounts (question 16).** Fathom is replaced by call recording and transcription into a draft note the author checks and signs. Not built. Every account is in the clinic's name.
- **Emails and WhatsApp (questions 17 and 25).** Messages go by email and WhatsApp through GoHighLevel, connected with a private integration key; a plug-in turns GoHighLevel texts into WhatsApp. WhatsApp is offered once connected, off until the patient turns it on. Not built.
- **Sign-in (question 18).** Session lengths stay as built; no second sign-in step for staff yet; staff reset their own password. Built.
- **Retention (question 19).** Nothing is deleted: records are archived and accounts suspended. Built.
- **Data protection (question 20).** The clinic's privacy policy applies; questions go to info@theschoemanclinic.com.
- **Priorities (question 21).** Everything heard on the call matters. Education and wearables are part of the build. Admins build courses of sections and modules, staff add them to a patient's portal: built. Patients type in wearable readings until device connections are built: manual entry built.
- **Contact details (question 22).** The clinic keeps them; a patient messages the clinic to change one. Read-only record built; messaging not built.
- **Photos (question 23).** Staff see patients' photos; patients do not see staff photos. See Findings: the storage policy does not match.
- **Letters (question 24).** Only doctors sign letters; prescribing goes through SignatureRx. Signatures built; SignatureRx not built.
- **Changing a sign-in email (question 26).** The confirmation link is enough, and the old address is told. Built.
- **Four lab choices (question 33).** The clinic's own lab, TDL, a TDL home kit, or the patient's own results; only TDL and the home kit go through Stripe and get a barcode. Not built.

### Earlier decisions, still standing

- [2026-11] MVP centres on the bloods loop. GoHighLevel keeps messaging, reminders, invoices and marketing. Prescribing goes through SignatureRx. (Superseded in part [2026-11]: notes no longer stay in Semble, and patient booking is to move into Clinic Hub; see question 15 above.)
- [2026-11] Patients see results only after doctor release; safeguarding alerts are doctors only (since 11 November, doctors on the care team).
- [2026-11] After comparing the clinic's patient flow V8 and its emails: every email closes with the clinic's phone, email and WhatsApp, opens "Dear" and signs off "The Schoeman Clinic team"; Clinic Hub sends the portal's own emails through Resend; there is no reschedule or cancel button and the 48-hour policy is shown; sex at birth and gender identity are both kept, sex at birth drives panels and cycle guidance and a missing value stops the step and tells a PA; a patient's own upload takes PDF only, up to 5 files each time, in the name matching the registration. The emails are built; the other items describe screens not yet built.
- [2026-11] Owner decision: multi-factor sign-in for staff and a CAPTCHA on sign-in are deferred until the clinic has accounts to enrol (confirmed by the clinic, question 18).
- [2026-11] Sessions end on their own: staff after 12 hours or 30 minutes idle, patients and guardians after 7 days or 2 hours idle. A signed-out person sees "You were signed out to protect your account. Please sign in again." An open screen asks the server to check every few minutes while the person is active.
- [2026-11] Every change to records made by the system rather than a person is attributed to the person it acts for or to a named background job in the audit log.
- [2026-11] The knowledge base is for admins only. The owner still has to decide whether doctors should get access (end of section 6). It is a stakeholder deliverable and its access table is derived from the row-level security policies, so it must be re-checked whenever policies change.
- [2026-11] Invitations, as built: admins invite every kind; PAs invite patients and guardians; doctors invite their own patients (since 11 November); health coaches, nurses and patients invite nobody. A link works once and for 3 days; a resend cancels the old link. No second approval for any kind. Sign-up is by invitation only. A person whose address already has an account signs in to accept and the access is added to that account. Acceptance is recorded under the person who invited. Cancelling does not tell the invited person.
- [2026-11] Profile: patient contact details on the record are read-only in the app. Anyone may change their own sign-in email, confirmed by a link and their current password. Signatures are for doctors only. Roles, work profile and guardian links are managed by the clinic.
- [2026-11] A missing notification choice counts as on.
- [2026-11] No email carries a result, a value, a diagnosis or a medicine.
- [2026-11] Staff Google Calendar: each team member connects their own Google account; no clinic-wide calendar and no patient booking. One encrypted token per person, read only by the server; disconnecting revokes and deletes it. Owner decision: any Google account may be connected, personal accounts included, but only by staff. `GOOGLE_WORKSPACE_DOMAIN` stays unset (`docs/SECURITY.md` S-106, accepted).
- [2026-11] Results, as built: entered by hand without AI; converted to UK units on entry with the original kept; status automatic and only a doctor sets critical; only a doctor releases; one doctor is enough; no hold-backs. Assumptions until questions 11 and 12 are answered.

### Superseded on 11 November 2026 [2026-11]

- "Least privilege by default: admins and the health coach have no clinical access." Replaced: admins read every record; health coaches see their care-team patients' records except safeguarding.
- "A nurse has no patient access until the clinic decides." Replaced: a nurse works like a doctor on care-team patients, minus diagnoses, prescribing, safeguarding and release.
- "Notes stay in Semble" (and the assumption under old question 32). Replaced: notes are written, signed and locked in Clinic Hub.
- "Admins see every invitation and the list of patient names, but no clinical record." Replaced: admins read every clinical record.
- "Only PAs and admins invite patients." Replaced: doctors invite their own patients.
- "Staff see all patients" (`in_scope` permissive). Replaced by access by care team.

## Findings

- [2026-11] Clinic decisions of 11 November, checked against `feat/clinic-decisions-nov`:
  - **Activity log role for nurses and admins.** `private.log_record_view` (redefined in `20261112120100_access_by_care_team.sql`) now lets admins and nurses log a view, but picks the actor's role only from doctor, PA and health coach. A nurse or an admin opening a record is logged with an empty role, so the Activity screen cannot say they were a nurse or an admin.
  - **Staff photos visible to patients.** The clinic decided patients do not see staff photos (question 23, marked built in the knowledge base). The storage policy "People read their own avatar, staff avatars, and the team reads all" (`20261102111728_storage.sql`) lets anyone signed in, patients included, read a staff photo, and `get_staff_directory()` returns `avatar_path` to patients. Whether any patient screen shows one was not checked.
  - **Patient photos for nurses and health coaches.** The decision says staff see patients' photos. The same storage policy gives other people's photos to `is_team()` only (doctor, PA, admin), so nurses and health coaches cannot see a patient's photo.
  - **Guardian removal.** The knowledge base says question 5 is "Built for PAs". The database lets a PA update a guardian link, but no screen in `app/` or `components/` touches `patient_guardians` (only `lib/data/profile.ts` reads it), so a PA cannot remove a guardian from the app. Admin removal is not built at all.
  - **Patient record is thin.** `/clinic/patients/[id]` shows care team, education, wearables and notes only. Allergies (which nurses may now record), diagnoses, medications, results, documents and safeguarding have no screen on the record; the prototype's `c-record` shows more.
  - **Wearables wording.** `/portal/wearables` tells patients "Your clinic team sees them alongside your results"; staff see readings on the patient record, which has no results.
  - **Recording source without recording.** `clinical_notes.source` accepts `recording` and the record page shows a "From a recording" badge, but nothing records or transcribes, and `lib/notes/actions.ts` never sets the source, so every note is `typed`. Not a defect; noted so the badge is not read as a built feature.
  - **Health coach release gate.** `docs/CONTEXT.md` 4.2 and 4.5 still say the health coach reads released results only and that `in_scope` is permissive; the code now gives health coaches on the care team unreleased results. The policy names on `results` and `lab_reports` still say "Patients, guardians and the health coach read released ...".
  - **Stale scope text elsewhere.** `CLAUDE.md` line 3 and `docs/CONTEXT.md` section 1 still say "Semble keeps consultation notes" and that GoHighLevel keeps "calendar"; both are superseded by question 15.
  - **Calendar branch.** The knowledge base says the staff Calendar is "built, on its own branch", and this document used to say branch `feat/staff-google-calendar`, not merged. The route, nav item, `lib/calendar/` and its migration are in this branch's tree (and `/portal/wearables` imports `lib/calendar/time`). Whether the migration and `07_google_calendar.test.sql` have since been run, and whether it has been security reviewed, was not re-checked.
  - **Question 29 and question 28 lean on each other.** The answer to question 28 counts "the ID at first sign-in" as a check, but question 29 (whether and how ID is taken) is still open and nothing is built.
  - **Prototype gaps.** `docs/reference/portal-prototype.html` has no Education, Wearables, Calendar or Activity screen; the nav now shows Education and Wearables to patients and Education to every staff role.
  - **Migrations not run by this keeper.** `20261112120000` to `20261112120400` were read, not run. The `nurse` value added to `care_relationship` is in its own migration so the next can use it.

- [2026-11] Staff Google Calendar (earlier findings, not re-checked): editing an event that runs past midnight fills the end time as 23:59 on the start day (`draftFor` in `app/clinic/calendar/page.tsx`); editing a repeating event changes one occurrence without saying so; event changes leave no audit record; the connect screen teaches staff to click past Google's unverified-app warning (question 34 b); the clinic-reference advice is not enforced (question 34 a); `lib/database.types.ts` was edited by hand.

- [2026-11] Result-ready email on release: when the email is skipped because the patient switched it off, the doctor still sees "The patient has been told", which is true only of the portal notice. The email goes to the sign-in address, not the patient record's contact email. The "no account or suspended" and "email failed" cases are reported on screen only; not tested with a real email.

- [2026-11] The bloods loop is still partial: lab orders, Stripe payment and barcode, the lab feed, patient upload and AI reading are not built, so results enter only by hand. The knowledge base's flow 5 step 3 still describes the AI step as if built, while its status line says it is not.
- [2026-11] Emails: `invitationEmail`, `resultReadyEmail` and `teamInviteAlertEmail` are wired; `guardianAccessEmail` is unused because guardian access does not exist yet.
- [2026-11] The Profile page says a changed email takes effect "once you confirm"; the sign-in service finished the change on one link locally although two are set (`docs/SECURITY.md` S-68).
- [2026-11] Sex at birth: the column is `patient_profiles.sex`; nothing in `app/` or `lib/` reads it, so panel choice, the day-21 rule and the "missing value stops the step" check are not built. No screen edits `gender_identity`.
- [2026-11] Knowledge base housekeeping (not re-checked since): the Roles table count, the Pages table count, stray "None" columns, and flow 6 step 4 saying "A message by WhatsApp is planned".
- [2026-11] The profile table in section 5 has no nurse column. `docs/CONTEXT.md` still cites old PRD question numbers in its changelog.
