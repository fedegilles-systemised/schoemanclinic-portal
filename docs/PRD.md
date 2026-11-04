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
- Semble keeps consultation notes and prescribing for now.

## 4. Roles

| Role | Purpose |
|---|---|
| Patient | Sees own record, released results, orders tests, uploads results, asks the clinic |
| Guardian | Verified by the clinic; sees or manages a patient's account (for example a parent of an under-18) |
| Doctor | Reviews and releases results; sees safeguarding alerts (doctors only) |
| PA | Reviews imports, manages orders and invitations |
| Health coach | Sees released results only; no team-only tables (current position) |
| Admin | Manages team, roles and settings; no clinical record access (current position) |

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
| Patient | My results | planned |
| Patient | Upload results | planned |
| Patient | Prescriptions | planned |
| Patient | Appointments | planned |
| Patient | Ask the clinic | planned |
| Patient | Letters and documents | planned |
| Patient | Privacy and consent | planned |
| Clinic | Patient list | planned |
| Clinic | Results review | planned |
| Clinic | Import queue | planned |
| Clinic | Lab orders | planned |
| Clinic | Safeguarding alerts | planned |
| Clinic | Team and settings | planned |
| Both | Emails. Built [2026-11], uncommitted: four sign-in service emails (password reset, email change, confirmation code, password changed) and three clinic emails (invitation, guardian access, result ready), in the clinic's look, with no clinical values in any of them. Sent by the sign-in service for the first four (hosted set-up is manual and not done); the three clinic emails are written but wired to no flow | partly done; invitation sending, guardian access and result release flows unbuilt |
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

A doctor who is also a patient sees the patient tabs under `/portal/profile` and the work tabs under `/clinic/profile`. The roles shown are set by the clinic and cannot be changed here. Session lengths are shown, not editable.

## 6. Open questions for the clinic

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

## 7. Decisions

- [2026-11] MVP centres on the bloods loop; messaging, reminders, calendar, invoices and marketing stay in GoHighLevel, notes and prescribing in Semble.
- [2026-11] Least privilege by default: admins and the health coach have no clinical access until the clinic decides otherwise.
- [2026-11] Patients see results only after doctor release; safeguarding alerts are doctors only.
- [2026-11] Owner decision: multi-factor sign-in for staff and a CAPTCHA on sign-in are deferred until the clinic has accounts to enrol. Neither is built, and neither is in the MVP scope above.
- [2026-11] Sessions end on their own: staff after 12 hours or 30 minutes idle, patients and guardians after 7 days or 2 hours idle. A signed-out person sees "You were signed out to protect your account. Please sign in again." An open screen asks the server to check every few minutes while the person is active, so an abandoned screen does not stay readable.
- [2026-11] Every change to records made by the system rather than a person is attributed to the person it acts for or to a named background job in the audit log.
- [2026-11] The knowledge base is for admins only (the owner first chose signed-in staff, then narrowed it to the admin role; answers open question 11). Doctors, PAs, the health coach, patients and guardians are sent to their own area; signed-out visitors go to sign in and an admin returns to the page. Open question 12 asks whether doctors should get access.
- [2026-11] The knowledge base (`content/knowledge-base.md`, shown at `/knowledge-base`) is a stakeholder deliverable: the owner shares it with the clinic so they can confirm the roles, access, flows and the 21 open questions (it overlaps with section 6, which stays the shorter list). Its access table is derived from the row-level security policies, so it must be re-checked whenever policies change.

- [2026-11] Profile decisions. Patient contact details on the record are read-only in the app: a patient who wants one changed contacts the clinic (open question 17 asks whether that should change). Notification choices offer email and the portal only for now; WhatsApp and SMS join when GoHighLevel is connected (question 18). Anyone may change their own sign-in email, confirmed by a link sent to the new address and by asking for their current password (question 20). Signatures are for doctors only, stored privately, and used only when letters are built. Photos are for everyone. Roles, work profile and guardian links are managed by the clinic, not by the person.
- [2026-11] A missing notification choice counts as on, so a new person hears about everything until they turn something off.
- [2026-11] No email carries a result, a value, a diagnosis or a medicine. It says that something is ready, or that an account is offered, and links to the portal.

## Findings

- [2026-11] Earlier finding that sign-in and dashboard routes do not exist no longer holds: `/login`, `/forgot-password`, `/update-password`, `/auth/confirm`, `/portal` and `/clinic` exist (committed in `c831ccf`).
- [2026-11] Sign-in method differs between prototype (magic link) and brief (email and password); `CLAUDE.md` lists forgot and update password routes, which implies passwords. The code implements email and password, so the question is effectively settled unless the clinic wants magic link.
- [2026-11] Sign-in hardening (attempt limits, session limits, signed session cookies, content security policy, scoped audit actor) is built but uncommitted and not yet on the hosted project. It adds no screen and changes no scope.
- [2026-11] The knowledge base lists 21 open questions and this document 10 (plus question 11 above). They are not reconciled yet; after the clinic answers, update both. It adds no scope and no role.
- [2026-11] Emails are built but not wired: invitation sending, guardian access and result release do not exist yet, so `invitationEmail`, `guardianAccessEmail` and `resultReadyEmail` are unused. The knowledge base's email table was updated by the main session; its open-question count and this document's are still not reconciled.
- [2026-11] The Profile screens are built and uncommitted. They add five open questions (17 to 21) and no new role. The notification choices are stored but nothing reads them yet, and the three clinic emails are still wired to no flow, so for now they change nothing a person receives. The knowledge base (`content/knowledge-base.md`) was edited in the same working tree; its open-question count is still not reconciled with this document.
- [2026-11] The Profile page says a changed email takes effect "once you confirm". The sign-in service finished the change on one link locally although two are set, so that wording is stronger than what was seen (`docs/SECURITY.md` S-68).
