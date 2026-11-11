# Clinic Hub: product requirements

Owner: `prd-keeper`. Last updated [2026-11]. Latest change [2026-11]: brought in step with the clinic's decisions of 12 November 2026 (signed notes are final; unmatched lab files are for PAs and admins only) and with what branch `feat/clinic-build-2` builds: guardian removal, photo visibility, GoHighLevel email and WhatsApp, patient booking, and call recording and transcription. Sources: `content/knowledge-base.md` ("Decided by the clinic on 11 November") and migrations `20261113120000` to `20261113120600`.

## 1. Context and problem

The Schoeman Clinic (hormone, longevity and functional medicine, London) needs a patient portal and a clinic portal. Today results, orders and requests are spread across GoHighLevel, Semble, email and PDFs, so staff re-key data and patients cannot see their bloods in one place or follow a trend over time.

## 2. Goals

- Run the bloods loop end to end in one place.
- Give patients a clear, calm view of their results and trends, shown only after a doctor releases them.
- Cut manual import and chasing work for PAs and doctors.
- Keep clinical data private by default, enforced in the database (row-level security), with access set by the patient's care team.
- [2026-11] Replace Semble in stages: clinical notes and appointments move into Clinic Hub (both now built), and what else moves is still open (question 31).

## 3. MVP scope

The MVP is built around the bloods loop: order, Stripe payment and barcode, results by lab feed or PDF import with PA review, doctor review and release, then the patient sees the trend.

**In:** the bloods loop above; sign-in; patient and clinic home dashboards; the screens listed in section 5. [2026-11] The clinic added to the build (question 21): clinical notes, education content and wearables. [2026-11] Built on `feat/clinic-build-2`: patient booking, call recording and transcription, and patient messages through GoHighLevel.

**Stays elsewhere, or moves later:**
- GoHighLevel keeps reminders, tasks, invoices and marketing, and the clinic's team manage anything GoHighLevel sends. [2026-11] Clinic Hub now sends its patient messages (result ready, booking confirmed or cancelled) through GoHighLevel by email and WhatsApp, once the clinic sets `GHL_PRIVATE_TOKEN` and `GHL_LOCATION_ID`; until then email goes through Resend and no WhatsApp is sent. Sign-in, invitation and team-alert emails still go through Resend. The Christmas prescription email is sent from GoHighLevel.
- [2026-11] Booking: patient booking is in Clinic Hub (built). The clinic's calendar is no longer kept in GoHighLevel for bookings made here; each clinician's own Google Calendar receives an event per booking.
- [2026-11] Semble: consultation notes are written in Clinic Hub (built) and Semble is retired in stages (questions 15 and 32). What moves from Semble, and when, is open (question 31).
- Prescribing goes through SignatureRx, where the doctor signs with a PIN (the clinic's patient flow V8). [2026-11] Not built, and left for now by the owner, as are the repeat prescription payment alerts (question 13).
- [2026-11] Fathom: replaced by call recording and transcription in Clinic Hub (built; needs the AssemblyAI key).

## 4. Roles

[2026-11] Access follows the care team (clinic decision, questions 1 to 3 and 7; migration `20261112120100_access_by_care_team.sql`, function `private.in_scope`). PAs and admins see every patient. Doctors, nurses and health coaches see only the patients whose care team they are on, from the `since` day until the `until` day. Inside that scope they see the whole record, except as stated below.

| Role | Purpose and access |
|---|---|
| Patient | Sees own record, released results, assigned education courses, own wearable readings and own appointments; enters wearable readings; [2026-11] books appointments with the clinicians on their care team, but cannot cancel or move one; sees only their own photo. Will order tests, upload results and ask the clinic (not built). Cannot remove a guardian |
| Guardian | Verified by the clinic; sees a patient's account, and with "can act" acts for them (enters wearable readings, [2026-11] books appointments). Not a role in the database: a verified guardian link. A PA can create a link that lets a guardian act, with no second approver. [2026-11] A PA or an admin removes the link from the patient record. Age and consent rules for under-18s are still to be set |
| Doctor | Care-team patients only. Reads the whole record, enters results, writes and signs notes, [2026-11] records calls, records allergies, diagnoses and prescriptions, sees and writes safeguarding alerts, and is the only role that releases results. Keeps the care team up to date, invites their own patients, sets their own bookable hours, books and cancels for care-team patients, and opens Team and settings |
| Nurse | [2026-11] Care-team patients only. Works like a doctor: reads the record, enters results, records allergies, writes and signs notes, records calls, works the import queue for matched files. Diagnoses, prescribing, safeguarding alerts and release stay with doctors |
| PA | [2026-11] Every patient. Reads the record, enters results, works the import queue including unmatched files, records allergies, manages orders, invites patients and guardians, keeps the care team up to date, links and removes guardians, sets any clinician's hours, books and cancels for any patient. Does not release results, write notes, record calls or see safeguarding alerts |
| Health coach | [2026-11] Care-team patients only. Sees everything about them, including unreleased results, notes, diagnoses and medications, except safeguarding alerts. Writes and signs notes and records calls. Does not enter or release results |
| Admin | [2026-11] Every patient. Reads every clinical record, including locked notes, but writes no clinical data. Manages team, roles and settings; invites anyone; keeps the care team up to date; removes guardians; sets appointment types and any clinician's hours; books and cancels; reads unmatched lab files (database only, see Findings); builds the education library; reads the Activity screen |

A doctor who is also a patient sees, as a patient, only what any patient sees (question 4).

## 5. Features

Status is "done" only where the screen and data path exist in code. Current state [2026-11]: foundations, sign-in, role routing, the app shell, both home screens, profile, invitations, results entry, review and release, the patient's results, the Activity screen, the staff Calendar, access by care team, the Patient list and record, clinical notes, education, manual wearable readings, and on branch `feat/clinic-build-2` guardian removal, photo visibility, GoHighLevel messages, booking and call recording. Nav items for unbuilt screens are disabled and show "Coming soon". The migrations `20261113120000` to `20261113120600` and pgTAP tests `13_ghl_and_booking` and `14_call_recordings` were read for this document, not run by it.

| Area | Feature | Status |
|---|---|---|
| Foundation | Next.js and Supabase scaffold, design tokens, restyled components | done [2026-11] |
| Both | Sign-in (email and password, forgot and update password, no sign-up) | done [2026-11] |
| Both | Role routing (patient and guardian to `/portal`, clinic staff to `/clinic`) | done [2026-11] |
| Both | App shell (navigation, user menu, notifications bell) | done [2026-11]; unbuilt nav items disabled |
| Patient | Home dashboard `/portal` | done [2026-11]; real data, all action buttons disabled |
| Clinic | Dashboard `/clinic` | done [2026-11]; real data, all action buttons disabled |
| Both | Profile `/portal/profile` and `/clinic/profile`: tabs by role (see "What each role can configure" below). Photo, name and phone, notification choices, sign-in security, and the clinic's read-only record or work profile | done [2026-11]; locally verified, tablet widths and dark mode not checked |
| Both | Photo visibility [2026-11] (question 23): everyone sees their own photo. Active staff see the team's photos and the photos of patients they can open (PAs and admins every patient; doctors, nurses and health coaches their care team's). Patients and guardians see no staff photo, and the staff directory gives them no photo path | done [2026-11] in the database (`20261113120100_photo_visibility.sql`) |
| Both | Change password (current password asked; other devices signed out) and change sign-in email (current password asked; confirmation link sent to the new address; the old address is told) | done [2026-11] |
| Doctor | Signature for letters, stored privately; only doctors sign letters (question 24) | done [2026-11] (storing only; nothing uses it yet) |
| Both | Notification choices: topics results, payments, appointments and messages, by email and in the portal. [2026-11] WhatsApp is offered once GoHighLevel is connected, off until the person turns it on (question 25) | done [2026-11]. Release and booking read the email and WhatsApp choices for results and appointments; nothing reads the portal or payments choices yet |
| Clinic | Access by care team [2026-11]: `private.in_scope` gives PAs and admins every patient, and doctors, nurses and health coaches the patients whose care team they are currently on. Health coaches and admins read unreleased results in scope; safeguarding alerts stay with doctors in scope; diagnoses and medications are written by doctors only; release is doctor only | done [2026-11] in the database |
| Clinic | Patient list `/clinic/patients` [2026-11]: the patients this person may see, with date of birth and care team. PAs, admins and doctors add someone to a patient's care team or remove them | done [2026-11] |
| Clinic | Patient record `/clinic/patients/[id]` [2026-11]: clinic reference, name, date of birth and care team; upcoming appointments (book, and cancel for staff); education courses; wearable readings; guardians (PAs and admins); call recordings and clinical notes. Opening it is written to the activity log, and the page is not shown if the log cannot be written | done [2026-11] for those parts. Results, allergies, diagnoses, medications, documents and safeguarding are not on this page yet (prototype `c-record` has more) |
| Clinic | Clinical notes on the patient record [2026-11]: doctors, nurses and health coaches on the care team write a draft, edit or archive their own draft, and sign it. [2026-11] A signed note is final: nobody edits or corrects it, its author included (clinic decision, 12 November; `20261113120000_notes_final_and_unmatched_files.sql`). The correction feature is removed: the database refuses any note that supersedes another, and no screen offers it. Nothing is deleted. Everyone who may open the record reads the notes, admins included. Patients and guardians do not see notes | done [2026-11] |
| Clinic | Call recording and transcription [2026-11] (question 16), replacing Fathom. From a patient's record a doctor, nurse or health coach on the care team records the call, either their microphone and the call's sound (shared from a browser tab) or their microphone only. The browser uploads the audio straight to private storage. The server sends a short-lived link to AssemblyAI (EU region, UK English, speaker labels); the transcript comes back by a signed webhook, or by "Check" on the record, and becomes a draft note in the recorder's name, marked "From a recording", for them to check and sign. Staff who can open the record see the recording's status; patients never see recordings. Nothing is deleted. The clinic already holds consent to record | done [2026-11] (`20261113120600_call_recordings.sql`, `lib/recordings/`, `app/api/transcription/webhook`). Hidden until `ASSEMBLYAI_API_KEY` and `TRANSCRIPTION_WEBHOOK_SECRET` are set; needs a data-processing agreement with AssemblyAI |
| Clinic | Education library `/clinic/education` and course page `/clinic/education/[id]` [2026-11]: admins build courses of sections and modules and publish them; every staff member reads the library. Staff who can open a patient's record add a published course to that patient's portal, or take it away | done [2026-11]; starts empty for the clinic's own content |
| Patient | Education `/portal/education` and `/portal/education/[id]` [2026-11]: the published courses assigned to the patient (or to a patient the guardian looks after) | done [2026-11] |
| Patient | Wearables `/portal/wearables` [2026-11]: the patient, or a guardian who can act, types in daily readings with an optional device name; they archive a reading they entered. Staff in scope read them on the patient record | done [2026-11] for manual entry. Device connections (Oura, Whoop, Garmin and so on) come next: planned |
| Patient | Lab orders. [2026-11] Clinic Hub follows the clinic's four choices for bloods: the clinic's own lab, TDL, a TDL home kit, or the patient's own results. Only TDL and the home kit are paid through Stripe and get a barcode (question 33) | planned |
| Patient | My results `/portal/results` and a marker page `/portal/results/[markerId]`: released results only, each marker with its latest value, range, status and small trend; a marker opens a chart of every released value with the range as a band, a table of values and the doctor's comments | done [2026-11] |
| Patient | Upload results (patient's own PDF from the portal). Agreed shape: PDF only, up to 5 files each time, and the name on the report must match the registered name; a PA checks it is complete. Staff attaching files keep PDF, JPEG or PNG up to 10 MB | planned |
| Patient | Prescriptions. Repeat request at £30 replaces the clinic's Typeform and is requested three weeks before the supply runs out. When the patient has paid, the admins, the PAs and the doctor are told (question 13). The approval goes to SignatureRx, which the doctor signs with a PIN (question 24) | planned; [2026-11] payment alerts and SignatureRx left for now by the owner |
| Patient | Appointments `/portal/appointments` [2026-11] (question 15): the patient's upcoming appointments, and booking. The patient, or a guardian who can act, picks an appointment type that patients may book and a clinician (doctor, nurse or health coach) on their current care team, then a free slot in the next 14 days, between one hour and four months ahead. There is no cancel or move button for patients: the page asks them to contact the clinic at least 48 hours before | done [2026-11] (`20261113120500_booking.sql`, `lib/booking/`) |
| Clinic | Booking for a patient `/clinic/patients/[id]/book` and cancelling [2026-11]: staff who can open a patient book with any active doctor, nurse or health coach, including types marked staff only, and cancel from the patient record. A cancelled appointment is kept, marked cancelled | done [2026-11] |
| Clinic | Booking settings `/clinic/booking` [2026-11]: admins add appointment types (name, length, in clinic or by video, whether patients may book) and take them off offer; admins and PAs set any clinician's weekly hours in London time, optionally tied to a location; a clinician sets their own | done [2026-11] |
| Both | After a booking or a cancellation [2026-11]: a free slot sits inside the clinician's hours and overlaps none of their live bookings, nor, when they have connected it, a timed event in their Google Calendar; the database checks hours and overlaps again and allows one booking at a time per clinician. The booking is added to the clinician's Google Calendar, if connected, titled with the appointment type and the clinic reference only, never the patient's name; a cancellation deletes the event. The patient gets a confirmation or cancellation by email, and by WhatsApp if they turned it on, through GoHighLevel when connected. A calendar or message failure never undoes the booking | done [2026-11] |
| Patient | Ask the clinic. Replies show in the portal with a status; the page says it is not for emergencies; response times are agreed later (question 14). A patient who wants their contact details changed messages the clinic here (question 22) | planned |
| Patient | Letters and documents | planned |
| Patient | Privacy and consent. Follows the clinic's policy at https://theschoemanclinic.com/privacy/; questions go to info@theschoemanclinic.com (question 20). Photo ID and consent at first sign-in are still open (question 29) | planned |
| Clinic | Results review `/clinic/results` and a report page `/clinic/results/[id]`: a doctor checks each value, comments on values and releases (the system records who and when). Who sees reports follows `in_scope` | done [2026-11]. Release needs a doctor. On release the patient gets a notice in the portal bell ("Your results are ready"). [2026-11] The result-ready message now goes through the shared patient messenger (`lib/notify/patient.ts`): an email with a sign-in link and no value or verdict, and a WhatsApp with the same, if the patient turned it on. With GoHighLevel connected both go through it and are logged in `integration_sync_log`; otherwise the email goes through Resend and no WhatsApp is sent. No email if the patient switched results emails off, has no account or address, or is suspended; the doctor is told which on screen. A failed message never undoes the release |
| Clinic | Add results `/clinic/results/new`: a PA, doctor or nurse picks the patient and sample date, optionally attaches the lab's file, and enters each value with its unit. A value in another unit is converted to UK units and the original kept. Status is set automatically; only a doctor sets critical | done [2026-11]. This is the import without AI |
| Clinic | Import queue [2026-11]: "Files waiting for entry" on `/clinic/results` (nav item "Import queue", PAs, doctors and nurses) lists imports needing a match or matched; a matched one opens Add results. Since 12 November files and imports not matched to a patient are for PAs and admins only in the database (documents, result imports, their items and the `unmatched/` storage folder); once matched, the care team sees them | partly done: the list and the access rule are built. No screen matches a file to a patient, nothing in the app creates an import, and AI reading and inbox forwarding are planned |
| Clinic | Results by lab feed | planned |
| Clinic | Lab orders. Cycle guidance follows sex at birth: day 21 for regular periods, any day for irregular or none; a missing value stops the step and tells a PA | planned |
| Clinic | Activity `/clinic/activity`: admins read who opened or changed a patient's record, with no clinical values, newest first, fifty at a time. Opening a lab report or a patient record is logged, at most once every ten minutes per person and record | done [2026-11] |
| Clinic | Safeguarding alerts | planned (database: doctors in scope only) |
| Clinic | Guardian links. A PA links a guardian (through an invitation) and may let them act. [2026-11] A PA or an admin removes a guardian from the patient record's Guardians section: view and act are switched off at once, nothing is deleted, and the audit log keeps who did it (`20261113120200_guardian_removal.sql`, `lib/patients/guardian-actions.ts`). A patient cannot remove a guardian (question 5) | done [2026-11]. No screen changes a link's "can act" without removing it |
| Both | Sex at birth and gender identity. Both are held on the patient record. Sex at birth drives panels and cycle guidance and is never guessed | partly done [2026-11]: the columns exist; no screen edits them and nothing yet uses them |
| Clinic | Team and settings: team invitations (list, filters, resend, cancel, "Invite someone"). The menu item shows to PAs, admins and doctors | done [2026-11]. Managing existing team members (roles, deactivation) and the clinic's tests, prices, partners and locations are planned |
| Both | Invitations: PAs and admins invite patients and guardians; admins invite team members; doctors invite their own patients. A link works once and for 3 days; date of birth is asked when accepting; drgina@theschoemanclinic.com is emailed when a doctor or an admin is invited | done [2026-11]; not tested with a real email |
| Both | Emails and messages. Built: four sign-in service emails and the clinic emails (invitation, guardian access, result ready, team invitation alert, and [2026-11] appointment booked or cancelled), in the clinic's look, with no clinical values. Every email closes with the clinic's phone, email and WhatsApp. [2026-11] Patient messages (result ready, booking) go through GoHighLevel when connected: Clinic Hub finds or creates the patient's GoHighLevel contact and keeps its id on the patient record (`20261113120300_ghl_contact_link.sql`), sends the email in GoHighLevel's conversation, and sends WhatsApp as a GoHighLevel text that the clinic's plug-in diverts to WhatsApp. Without GoHighLevel, these emails go through Resend | done [2026-11]; needs `GHL_PRIVATE_TOKEN` and `GHL_LOCATION_ID`; not tested against the clinic's GoHighLevel. The guardian access email is wired to no flow |
| Clinic | Calendar `/clinic/calendar`: every team member connects their own Google Calendar and sees, adds, edits and deletes their own events, one week at a time in London time. The token is encrypted and server only. No patient or guardian access | done [2026-11] |
| Both | Staff Knowledge base `/knowledge-base`: admins only, unlisted page for the clinic to validate roles, access, flows and open questions | done [2026-11]; not a patient feature |

### What each role can configure on the profile [2026-11]

| | Patient | Guardian | Doctor | PA | Health coach | Admin |
|---|---|---|---|---|---|---|
| Photo, name, phone | Yes | Yes | Yes | Yes | Yes | Yes |
| Sign-in email (confirmed by link), password, sign out other devices | Yes | Yes | Yes | Yes | Yes | Yes |
| Notification choices (email, portal; WhatsApp once GoHighLevel is connected) | Yes | Yes | Yes | Yes | Yes | Yes |
| Their patient record (name, date of birth, reference, contact details, doctor) | Read only; "contact the clinic" | No record unless also a patient | Only if also a patient | No | No | No |
| People they look after | Not shown | Read only | No | No | No | No |
| Work profile (job title, role, GMC number for doctors, locations, status) | No | No | Read only; an admin manages it | Read only | Read only | Read only, if they have a staff profile |
| Signature | No | No | Yes | No | No | No |

A nurse sees the same as a PA in this table; the table has no nurse column yet. A doctor who is also a patient sees the patient tabs under `/portal/profile` and the work tabs under `/clinic/profile`. Bookable hours are set on Booking settings, not on the profile.

## 6. Open questions for the clinic

One list. The knowledge base (`content/knowledge-base.md`, "Open questions for the clinic") is the list the clinic answers, and this section uses its numbers. Each open entry adds what the build assumes today.

8. **Orders and payment.** Barcodes, where samples are taken, fixed prices, unpaid orders and refunds. The four lab choices are decided (question 33); nothing is built yet.
9. **Lab feed.** Which labs send results electronically, in what format, and what happens to an unknown barcode or marker. Nothing built yet.
10. **AI reading of PDFs.** Which provider, which data-processing terms, which inbox, how long originals are kept. Results are entered by hand until this is answered.
11. **Release rules.** Only a doctor releases today, and one doctor is enough. May a PA release normal results? Is a second doctor needed for critical values? Do some markers need a hold-back?
12. **Markers, units and ranges.** Which markers are tested, the clinic's base units and ranges in UK units, which range the patient sees when a lab's differs, and whether "borderline" at within 5% of an edge is right.
29. **Registration, ID and consent.** Which record of photo ID and consent counts (Semble's form or the first portal sign-in), and must a PA check the ID before the patient gets in? Not built.
31. **Moving over from Semble.** What moves (historical PDFs, notes, contacts, appointments), who checks it, and when to train the team. Notes and booking are now in Clinic Hub, so this decides go-live. Nothing moves until we know what Semble's API exports.

Residue of answered questions, still to settle with the clinic but not on the knowledge base's open list:
- Age and consent rules for under-18s and the move to adult access (from question 5).
- Response times for "Ask the clinic" (from question 14).
- [2026-11] Booking details the build assumed: slots every 15 minutes, a 14-day view, bookings between one hour and four months ahead, one clinician per appointment, no reminders sent by Clinic Hub (GoHighLevel keeps reminders), and staff cancelling at any time without a 48-hour check.
- [2026-11] A data-processing agreement with AssemblyAI (EU) before recording is switched on.

**Added by this document, not in the knowledge base's list**

34. **Staff Google Calendar.** (a) *Patient names in Google.* Staff events typed on the Calendar screen may hold anything; the form advises the clinic reference and nothing enforces it. Bookings made in Clinic Hub carry the clinic reference only. Does the clinic's Google account have a data-processing agreement that covers patient data? (b) *Google app verification.* Who owns the Google Cloud project, and should the clinic apply for verification? (c) *GoHighLevel overlap.* If GoHighLevel still syncs its own bookings to staff calendars, they block Clinic Hub slots and can be edited on the Calendar screen without changing GoHighLevel.

**Not for the clinic: the owner's decisions**

- **Who else may read the knowledge base.** It is for admins only, but the clinic's owner is a doctor and doctors cannot open it.
- [2026-11] **Repeat prescription payment alerts and SignatureRx.** Left for now by the owner.

## 7. Decisions

### Decided by the clinic on 12 November 2026 [2026-11]

- **Signed notes are final.** Nobody edits or corrects a signed note, its author included. The correction feature (a new version superseding a signed note) is removed. Built (`20261113120000_notes_final_and_unmatched_files.sql`).
- **Unmatched lab files.** Files and imports not yet matched to a patient are for PAs and admins only; once matched, the patient's care team sees them. Built in the database; see Findings for the screen.

### Decided by the clinic on 11 November 2026 [2026-11]

From `content/knowledge-base.md`. "Built" is checked against this branch's code; where this document's check differs from the knowledge base, see Findings.

- **Access (questions 1 to 3).** PAs and admins see every patient; doctors, nurses and health coaches see only their care-team patients. Admins read every clinical record, including locked notes. A health coach sees everything about their care-team patients except safeguarding alerts. Built.
- **Doctors who are patients (question 4).** As a patient, they see only what any patient sees. Built.
- **Guardians (question 5).** A PA can create a link that lets a guardian act, with no second approver. A patient cannot remove a guardian; a PA or an admin does, from the patient's record. Built [2026-11]. Under-18 rules to be set.
- **Invitations (questions 6 and 28).** Doctors invite their own patients; a new patient a doctor invites joins their care team as primary doctor. Dr Gina Schoeman is emailed when a doctor or an admin is invited. No second approval. Built, except the ID check (question 29).
- **Roles (question 7).** Doctor, nurse, health coach, PA and admin, plus patients and guardians. A nurse works like a doctor on care-team patients; diagnoses, prescribing, safeguarding alerts and release stay with doctors. Built.
- **Repeat prescriptions (question 13).** Requested three weeks before they run out; on payment the admins, the PAs and the doctor are told. Not built; left for now by the owner.
- **Messages (question 14).** Replies show in the portal with a status; not for emergencies. Not built.
- **Source of truth (questions 15 and 32).** Everything moves into Clinic Hub. Clinical notes are written here and are final once signed (12 November): built. Staff connect their own Google Calendar: built. [2026-11] Patients book with the clinicians on their care team and staff book for any patient they can open, inside each clinician's weekly hours; the booking goes into the clinician's Google Calendar with the clinic reference only and the patient gets a confirmation; patients cannot cancel or move a booking, the team does: built.
- **Fathom and accounts (question 16).** [2026-11] Fathom is replaced by call recording and transcription (AssemblyAI, EU) into a draft note in the recorder's name, which they check and sign: built; needs the AssemblyAI key. Every account is in the clinic's name.
- **Emails and WhatsApp (questions 17 and 25).** [2026-11] Messages go by email and WhatsApp through GoHighLevel, connected with a private integration key; WhatsApp is sent as a GoHighLevel text that the clinic's plug-in diverts to WhatsApp. WhatsApp is offered once connected, off until the patient turns it on. Until connected, email goes through Resend. Built; needs `GHL_PRIVATE_TOKEN` and `GHL_LOCATION_ID`.
- **Sign-in (question 18).** Session lengths stay as built; no second sign-in step for staff yet; staff reset their own password. Built.
- **Retention (question 19).** Nothing is deleted: records are archived and accounts suspended. Built.
- **Data protection (question 20).** The clinic's privacy policy applies; questions go to info@theschoemanclinic.com.
- **Priorities (question 21).** Education and wearables are part of the build: built (manual wearable entry).
- **Contact details (question 22).** The clinic keeps them; a patient messages the clinic to change one. Read-only record built; messaging not built.
- **Photos (question 23).** [2026-11] Staff see the team's photos and the photos of patients they can open; patients see only their own photo. Built.
- **Letters (question 24).** Only doctors sign letters; prescribing goes through SignatureRx. Signatures built; SignatureRx not built (left for now).
- **Changing a sign-in email (question 26).** The confirmation link is enough, and the old address is told. Built.
- **Four lab choices (question 33).** The clinic's own lab, TDL, a TDL home kit, or the patient's own results; only TDL and the home kit go through Stripe and get a barcode. Not built.

### Earlier decisions, still standing

- [2026-11] MVP centres on the bloods loop. GoHighLevel keeps reminders, invoices and marketing. Prescribing goes through SignatureRx. (Superseded in part: notes and booking are in Clinic Hub, and Clinic Hub's patient messages go out through GoHighLevel.)
- [2026-11] Patients see results only after doctor release; safeguarding alerts are for doctors on the care team only.
- [2026-11] Every email closes with the clinic's phone, email and WhatsApp, opens "Dear" and signs off "The Schoeman Clinic team"; patients have no reschedule or cancel button and the 48-hour policy is shown; sex at birth drives panels and cycle guidance and a missing value stops the step; a patient's own upload takes PDF only, up to 5 files each time.
- [2026-11] Multi-factor sign-in for staff and a CAPTCHA are deferred until the clinic has accounts to enrol.
- [2026-11] Sessions: staff 12 hours or 30 minutes idle; patients and guardians 7 days or 2 hours idle.
- [2026-11] Every change made by the system rather than a person is attributed in the audit log to the person it acts for or to a named job (`ghl-sync`, `calendar-sync`, `transcription` among them).
- [2026-11] The knowledge base is for admins only.
- [2026-11] Invitations: admins invite every kind; PAs invite patients and guardians; doctors invite their own patients. A link works once and for 3 days. Sign-up is by invitation only.
- [2026-11] A missing notification choice counts as on, except WhatsApp, which counts as off.
- [2026-11] No email or WhatsApp carries a result, a value, a diagnosis or a medicine.
- [2026-11] Staff Google Calendar: each team member connects their own Google account, personal accounts included, staff only. `GOOGLE_WORKSPACE_DOMAIN` stays unset (`docs/SECURITY.md` S-106, accepted).
- [2026-11] Results: entered by hand without AI; converted to UK units with the original kept; only a doctor sets critical and releases; one doctor is enough.

### Superseded [2026-11]

- 12 November: "A correction is a new version that supersedes a signed note." Replaced: a signed note is final; nobody corrects it.
- 12 November: unmatched files readable by any PA, doctor or nurse. Replaced: PAs and admins only.
- 11 November: "Admins and the health coach have no clinical access"; "a nurse has no patient access"; "notes stay in Semble"; "only PAs and admins invite patients"; "staff see all patients". Replaced as set out above.
- [2026-11] "Staff Google Calendar: no patient booking." Replaced: bookings made in Clinic Hub are written to the clinician's Google Calendar.
- [2026-11] "There is no reschedule or cancel button anywhere." Narrowed: patients have none; staff cancel from the patient record.

## Findings

- [2026-11] Branch `feat/clinic-build-2`, checked against the decisions of 11 and 12 November:
  - **Admins cannot reach unmatched files.** The 12 November rule gives unmatched files to PAs and admins, and the database does. But the "Import queue" nav item shows to PAs, doctors and nurses only, and the "Files waiting for entry" list on `/clinic/results` shows only to PAs, doctors and nurses (`canEnter`), so an admin has no screen for them.
  - **Import queue has no way in or out.** Nothing in `app/` or `lib/` creates a `result_imports` row, and no screen matches an unmatched file to a patient; unmatched rows only show "Needs matching to a patient". The knowledge base marks the 12 November file rule "Built", which is true of access only.
  - **Google Calendar check at booking.** The booking migration's comment says "the server also checks the clinician's Google Calendar before it books". Google busy times are read only when free slots are listed (`lib/booking/slots.ts`); `bookAppointment` does not re-check Google, so an event added in Google between listing and booking is not caught. The database does re-check hours and Clinic Hub bookings.
  - **Booking messages and the doctor's screen.** On release, the on-screen message to the doctor reports email outcomes only; a WhatsApp sent or failed is not mentioned. After a booking or cancellation, a calendar or message failure is written only to the server log; staff are told "The patient has been told" regardless.
  - **Address sources differ.** `notifyPatient` emails the sign-in address first and the record's contact email only when there is no account, but texts the record's contact phone first. Whether the clinic wants the record's contact details used for both is not settled.
  - **"WhatsApp alongside an alert to the PAs".** This document earlier recorded that WhatsApp always goes with an alert to the PAs. Nothing sends that alert; either the requirement is dropped or it is not built. To confirm with the clinic.
  - **Staff cancel without the 48-hour policy.** `cancel_appointment` lets staff in scope cancel any open appointment at any time, admins included. The 48-hour policy is shown to patients only.
  - **Stale text in other documents.** `docs/CONTEXT.md` still describes note corrections (`clinical_note_version` row, `createNote` with `supersedesId`, the decision record and the notes test summary). `CLAUDE.md` line 3 and `content/knowledge-base.md` line 26 still say Semble keeps consultation notes and GoHighLevel keeps the calendar; the knowledge base's integrations table still lists Fathom as "To confirm". For their owners.
  - **Dates.** The clinic's decisions are dated 12 November 2026 and the migrations `20261113…`; this document was updated on 11 November 2026 by the system clock. Recorded as given.
  - **Migrations and tests not run by this keeper.** `20261113120000` to `20261113120600`, `13_ghl_and_booking.test.sql` and `14_call_recordings.test.sql` were read, not run. GoHighLevel and AssemblyAI have not been tested against live accounts here.
- [2026-11] Resolved on this branch (were findings): staff photos visible to patients, and patient photos hidden from nurses and health coaches (`20261113120100_photo_visibility.sql`); guardian removal with no screen (now on the patient record for PAs and admins); the "From a recording" badge with no recording (recordings now set `source = 'recording'`); the release screen saying "The patient has been told" when the email was switched off (it now says they have not been emailed).
- [2026-11] Still open from earlier checks, not re-checked on this branch unless stated:
  - **Activity log role for nurses and admins.** `private.log_record_view` (last defined in `20261112120100_access_by_care_team.sql`, unchanged since) logs nurses and admins with an empty role.
  - **Patient record is thin.** Allergies, diagnoses, medications, results, documents and safeguarding have no screen on the record.
  - **Wearables wording.** `/portal/wearables` says the team sees readings "alongside your results"; the record shows no results.
  - **Health coach release gate.** `docs/CONTEXT.md` 4.2 and 4.5 and the policy names on `results` and `lab_reports` still describe the old health coach rule.
  - **Question 29 and question 28 lean on each other.** The ID at first sign-in is counted as a check but is not built.
  - **Prototype gaps.** `docs/reference/portal-prototype.html` has no Education, Wearables, Calendar, Activity, Booking settings or recording screen.
  - **Staff Google Calendar.** Editing an event that runs past midnight fills the end as 23:59; editing a repeating event changes one occurrence silently; event changes leave no audit record; the connect screen teaches staff to pass Google's unverified-app warning; `lib/database.types.ts` was edited by hand.
  - **Bloods loop still partial.** Lab orders, Stripe, barcode, lab feed, patient upload and AI reading are not built; results enter only by hand.
  - **Emails.** `guardianAccessEmail` is unused. The Profile page says a changed email takes effect "once you confirm"; the sign-in service finished the change on one link locally (`docs/SECURITY.md` S-68).
  - **Sex at birth.** Nothing reads `patient_profiles.sex`; no screen edits `gender_identity`.
  - **Profile table** has no nurse column.
