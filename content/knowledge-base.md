## About this document

This document describes who uses Clinic Hub, what each person can see and do, which screens exist, and how the main journeys work, so that the clinic can confirm each point or correct it before we build further.

**How to read it.** Every screen and flow carries one of two statuses:

- **Built:** the screen exists and reads real data from the database. Action buttons on built screens are switched off for now.
- **Planned:** agreed in scope but not built. It shows in the menu as "Coming soon".

Where a flow uses data from another system (an API, a webhook or a lab feed) or sends an email, the flow says so in a line marked **Data in/out** or **Email**. Each flow ends with the questions we need the clinic to answer. All questions are collected again in the last section.

**What we ask of the clinic:** read the roles and the access table first, because they decide what the database allows; then the flows; then answer the open questions. Anything wrong or missing can be sent to the project team.

## The product in one page

Clinic Hub is a patient portal and a clinic portal built around one journey, the bloods loop. A patient's blood test goes from order to released result in one place, and the patient sees the trend over time.

1. **Order.** A doctor or PA orders a test panel for a patient. The due date is set 14 days before the appointment the bloods are for.
2. **Payment and barcode.** The patient pays through Stripe and receives a barcode for the sample.
3. **Sample.** The sample is taken and sent to a lab partner.
4. **Results arrive** in one of two ways: the lab sends them electronically (a lab feed), or a PDF arrives by patient upload or email.
5. **PA check (PDFs only).** An AI tool suggests the values in the PDF. A PA matches the PDF to a patient and confirms each value. Nothing is saved as a result without that confirmation.
6. **Doctor review and release.** A doctor reviews the report, adds a comment if needed, and releases it.
7. **Patient view.** Only now can the patient see the results, with a trend against their earlier values.

Two other systems stay in charge of what they do today: GoHighLevel keeps messaging, reminders, tasks, calendar, invoices and marketing, and Semble keeps consultation notes and prescribing. Clinic Hub reads from them where a screen needs the information. The section on integrations lists every connection.

**Status today:** the database for every step above exists and is protected, and both home screens are built. Steps 1 to 7 as screens, and every connection to Stripe, the labs, GoHighLevel and Semble, are planned.

## Roles

There are five roles, plus the guardian, who is a link to a patient rather than a role. What each role can reach is enforced in the database, not only on screen, so a missing button never means the data is hidden by accident.

| Role | Who | What they do in Clinic Hub | Home |
| --- | --- | --- | --- |
| Patient | A patient of the clinic | Sees their own record and released results, orders and pays for bloods, uploads results, requests repeat prescriptions, asks the clinic questions, reads shared letters | Patient portal |
| Guardian | A person verified by the clinic as able to see or act for a patient, for example a parent | Sees the patient's portal, and acts for them (pays, requests, asks) only if the clinic ticked "can act" | Patient portal, viewing that patient |
| Doctor | A clinician | Reviews and releases results, comments on values, writes letters, sees safeguarding alerts, orders bloods | Clinic portal |
| PA | A personal assistant or practice administrator | Matches and confirms imported PDFs, manages orders and repeat requests, invites patients and verifies guardians | Clinic portal |
| Health coach | A coaching team member | Sees released results only, and no team-only information | Clinic portal |
| Admin | A clinic or system administrator | Manages the team, roles and settings, reads the activity logs; sees no clinical records | Clinic portal |

**Rules that apply to every role**

- A person can hold more than one role. A doctor who is also a patient has both a clinic view and a patient view, and switches between them from the top bar.
- A staff member only works while their staff profile is active. Switching it off ends their access at once, without deleting anything.
- A suspended account can do nothing, whatever roles it still holds.
- Records are archived, never deleted. People are suspended, never removed.
- Nobody can change their own role.

**How accounts are created.** Today the clinic's technical team creates each account and assigns its role directly in the database, because the invitation screen is planned. In the planned design a PA invites a patient or a team member by email, the invitation expires, and the person chooses their own password.

**Questions**

- Who should be able to invite team members, the PA, the admin, or both? Should inviting a doctor or an admin need a second approval?
- Is "health coach" the right name, and does the clinic have other roles to add, such as reception, a nurse or a phlebotomist?

## Access by role

This table is what the database enforces today. "Read" means can see; "add" and "change" mean can create or edit. A dash means no access at all. Guardian columns assume a verified link; where a guardian needs "can act", the cell says so.

| Information | Patient | Guardian | Doctor | PA | Health coach | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| Own account and contact details | Read, change | Read, change | Read, change | Read, change | Read, change | Read, change |
| Other people's accounts (name, email, status) | - | - | Read | Read | - | Read, change |
| Roles of every account | Own only | Own only | Own only | Own only | Own only | Read all |
| Team directory (names and job titles) | Read | Read | Read | Read | Read | Read |
| Team staff profiles (work details) | - | - | Read | Read | - | Read, add, change |
| Patient details (name, date of birth, contact) | Own, read | Read | Read | Read, add, change | Read | - |
| Allergies | Read | Read | Read, add, change | Read, add, change | Read | - |
| Diagnoses | Read | Read | Read, add, change | Read | Read | - |
| Medications | Read | Read | Read, add, change | Read | Read | - |
| Consents | Read, add | Read, add if can act | Read | Read | Read | - |
| Care team (who looks after whom) | - | - | Read, add, change | Read, add, change | - | Read |
| Safeguarding alerts | - | - | Read, add, change | - | - | - |
| Appointments | Read | Read | Read | Read | Read | - |
| Lab orders | Read | Read | Read, add, change | Read, add, change | Read | - |
| Lab reports and results | Released only | Released only | Read all, comment, release | Read all | Released only | - |
| Imported PDFs and extracted values | - | - | Read, decide | Read, decide | - | - |
| Letters and documents | What the clinic shared, upload own | Same, upload if can act | Read, add, change | Read, add, change | Read (lab PDFs once released) | - |
| Questions to the clinic | Read, ask | Read, ask if can act | Read, change status | Read, change status | Read | - |
| Repeat prescription requests | Read, request | Read, request if can act | Read, change status | Read, request for a patient, change status | Read | - |
| Own notifications and preferences | Read, change | Read, change | Read, change | Read, change | Read, change | Read, change |
| Reference data (tests, markers, prices, lab partners, locations) | Read | Read | Read | Read | Read | Read, add, change |
| Activity and integration logs | - | - | - | - | - | Read (no screen yet) |

**Points the table does not show**

- Today every doctor, PA and health coach can open every patient. The database is already prepared to narrow this to a patient's own care team, but it is switched to "everyone" until the clinic decides.
- Appointments and payments are never entered by hand: they arrive from the booking system and from Stripe.
- Patients and guardians never reach unreleased results, safeguarding alerts, imports or the care team, however they ask. This is tested.
- Every change to a clinical record is written to a permanent log: who, what and when. The log never stores the clinical values themselves.

**Questions**

1. Should staff see every patient, or only those on their care team? If only the care team, who maintains it?
2. May admins read clinical records, or stay limited to team, settings and logs?
3. May the health coach see more than released results, for example diagnoses and medications, or less?
4. May a PA add allergies, and may a PA read diagnoses and medications, as in the table?
5. May a doctor who is also a patient see their own unreleased results and safeguarding alerts?

## Pages by role

Five screens are built and the rest are planned. Every built screen reads real data. Their action buttons are visible but switched off until the flows behind them exist; menu items for planned screens read "Coming soon".

**Built**

| Page | Who sees it | What it shows |
| --- | --- | --- |
| Sign in | Everyone | Email and password. A short message if the session ended or a link expired. Accounts are by invitation: there is no sign-up |
| Forgot password | Everyone | Asks for an email address and always replies "if that address has an account, we have sent a link", so it never reveals who has an account |
| Choose a new password | Anyone with a valid link or a signed-in session | Sets a new password: at least 12 characters, with a lower-case letter, a capital and a number |
| Patient home | Patient, guardian | A greeting. A banner when bloods are due, with the date. Next appointment. Bloods due, with the panel name and progress (ordered, paid, sample taken, results in). New results, once a doctor has released them. Up to four of the patient's markers at a glance, out-of-range first. The latest letter and shared documents. A guardian sees the same, headed with the patient's name |
| Clinic home | Doctor, PA, health coach, admin | Four figures: today's appointments, results to review, imports waiting, open tasks (shown as a dash until GoHighLevel is connected). A list of results needing attention. Today's diary at the chosen location. Appointments in the next 14 days that are missing bloods |
| App frame | Everyone signed in | Menu, a bell for notifications, a location chooser (clinic only), and an account menu showing name and role, with sign out and, for people with both views, a switch between clinic and patient |

**Planned, patient and guardian**

| Page | What it will do | Uses another system |
| --- | --- | --- |
| Lab orders | List orders, pay, show the barcode, follow progress | Stripe |
| My results | Released results by marker, trends, the doctor's comment | None |
| Upload results | Send a PDF from another lab, for example abroad | AI extraction (provider to be chosen) |
| Prescriptions | Current medicines; request a repeat for a fee | Stripe, GoHighLevel |
| Appointments | Upcoming and past visits | GoHighLevel or Semble |
| Ask the clinic | Send a question and see its status | GoHighLevel |
| Letters and documents | Read what the clinic has shared | None |
| Privacy and consent | See and change consents, notification choices | GoHighLevel reads the choices |

**Planned, clinic**

| Page | What it will do | Proposed roles | Uses another system |
| --- | --- | --- | --- |
| Patient list | Find a patient and open their record | Doctor, PA, health coach | None |
| Results review | Review, comment and release reports | Doctor (PA reads) | None |
| Import queue | Match a PDF to a patient, check the values | Doctor, PA | AI extraction |
| Lab orders | Create and follow orders | Doctor, PA | Stripe, lab partner |
| Safeguarding alerts | Add and review alerts | Doctor only | None |
| Team and settings | Invite people, manage roles, edit tests, prices, partners and locations | Admin, PA (invitations) | Email |

Today every staff member sees the same clinic menu, and the database decides what each can open. The planned design hides the items a role cannot use.

**Questions**

1. Do the proposed roles per clinic page match how the team works?
2. Should a guardian who looks after several patients choose between them? Today they see the first.
3. Which pages matter most for the first release, in order?

## Sign-in, sessions and passwords

Sign-in uses an email address and a password. There is no public sign-up: the clinic creates every account.

| Rule | What people experience |
| --- | --- |
| Password strength | At least 12 characters, with a lower-case letter, a capital and a number |
| Wrong details | One message for every failure, "We could not sign you in", so nobody can tell whether an address has an account |
| Too many attempts | Sign-in pauses for a few minutes after repeated tries. Password reset is limited in the same way |
| Staff sessions | Signed out after 12 hours, or after 30 minutes with no activity |
| Patient and guardian sessions | Signed out after 7 days, or after 2 hours with no activity |
| Being signed out | The person lands on the sign-in page with "You were signed out to protect your account. Please sign in again" |
| While working | An open screen keeps the session alive every few minutes while the person is active, and ends it once they stop |
| Forgot password | An emailed link, valid once, opens a page to choose a new password |

**Email.** The reset link is an email sent by the sign-in service. It works once the clinic's sending domain is set up. Until then the clinic resets passwords by hand.

**Not built yet.** Two-step verification for staff, and a check that a person is not a robot on the sign-in form. Both wait until the clinic has accounts to enrol.

**Questions**

1. Are the session lengths right? A shorter staff session is safer; a longer one is less disruptive.
2. Should staff sign in with a second step (a code from an authenticator app)? For everyone, or only doctors and admins?
3. Password or emailed sign-in link? The prototype showed a link; the build uses a password.
4. Who may reset a staff member's password: the admin, a PA, or only the person themselves?
5. Should shared computers at the clinic be treated differently, for example a shorter idle limit at reception?

## User flows

Each flow names who acts, the steps, whether it needs data from another system (**Data in/out**) or sends an email (**Email**), its status, and the questions for the clinic. Where the clinic has not yet decided how something works, the step says "proposed".

| # | Flow | Status | Other system | Email |
| --- | --- | --- | --- | --- |
| 1 | Create an account | Planned (done by hand today) | None | Yes |
| 2 | Sign in and reset a password | Built | None | Yes |
| 3 | Order bloods and pay | Planned | Stripe, lab partner | Proposed |
| 4 | Results by lab feed | Planned | Lab partner | Proposed |
| 5 | Results by PDF import | Planned | AI extraction | Yes (inbound) |
| 6 | Doctor reviews and releases | Planned | GoHighLevel | Proposed |
| 7 | Patient reads results and trends | Planned | None | No |
| 8 | Request a repeat prescription | Planned | Stripe, GoHighLevel | Proposed |
| 9 | Ask the clinic | Planned | GoHighLevel | Proposed |
| 10 | Appointments and bloods due date | Read built, sync planned | GoHighLevel, Semble | No |
| 11 | A guardian acts for a patient | Planned | None | Proposed |
| 12 | Safeguarding alert | Planned | None | No |
| 13 | A team member leaves | Planned | None | No |

### 1. Create an account

**Who:** a PA (proposed), then the new patient or team member. **Status:** planned. Today the clinic's technical team creates the account and its role directly.

1. The PA enters the person's email and role. For a patient, the PA links the invitation to the patient's record.
2. The system emails a one-time link that expires after a set time.
3. The person opens the link and chooses a password.
4. The system checks that the invitation is unused, has not expired, that the person who sent it is still active, and that the email matches. It then gives the role.
5. The person lands on their home page.

**Email:** the invitation, sent through Resend from the clinic's domain. It carries no clinical information. **Data in/out:** none from other systems.

**Questions:** how long should an invitation last? Can an invitation be re-sent or cancelled? Do patients get an account at their first visit, or only when the clinic first orders bloods?

### 2. Sign in and reset a password

**Who:** anyone with an account. **Status:** built.

1. The person enters email and password. The system sends them to the clinic portal (staff) or the patient portal (patients and guardians).
2. If the account is suspended or has no role, they see "This account does not have access" and are signed out.
3. If they forgot the password, they ask for a link. The reply is the same whether or not the address has an account.
4. The link opens a page to choose a new password, then signs them in.

**Email:** the reset link, sent by the sign-in service. It needs the clinic's sending domain, so until that exists the clinic resets passwords by hand. **Data in/out:** none.

**Questions:** none beyond those under sign-in.

### 3. Order bloods and pay

**Who:** a doctor or PA creates the order; the patient (or a guardian who can act) pays. **Status:** planned.

1. The doctor or PA picks a test panel and a lab partner. The due date is the appointment date minus 14 days. The order starts as "sent to patient".
2. The patient sees a "bloods due" banner and opens the order.
3. The patient pays. The price comes from the panel's price list.
4. Stripe confirms the payment. The order becomes "paid" and gets a barcode.
5. The patient takes the barcode to the sample point. When the lab or clinic records the sample, the order becomes "sample taken".
6. When results arrive (flows 4 and 5), the order becomes "results in", then "reviewed" after a doctor's review.

**Data in/out:** Stripe, for the payment. The clinic never stores card details. Stripe sends a confirmation message that Clinic Hub records once, so a payment is never counted twice. The lab partner receives the barcode and panel (proposed). **Email:** proposed, a payment receipt and a reminder before the due date, sent through GoHighLevel according to the patient's preferences.

**Questions:** how are barcodes created, by Clinic Hub or by the lab? Where are samples taken (clinic, partner site, home visit)? Are panel prices fixed or set per order? What happens to an unpaid order after the due date? Can the clinic refund, and through which system? Who sends chasing reminders?

### 4. Results by lab feed

**Who:** the lab partner (automatic), then the PA or doctor. **Status:** planned.

1. The lab partner sends results electronically. TDL is named in the data model as a source.
2. Clinic Hub stores the message first, then processes it. The unique event number stops a result being processed twice.
3. The system matches the barcode to an order and creates a report with one line per marker, using the clinic's shared marker list so trends work across labs.
4. The report waits for review. The patient cannot see it.

**Data in/out:** inbound from the lab partner. Every exchange is logged: what moved, when, and whether it worked. **Email:** none.

**Questions:** which labs will send a feed, and in what format? What happens to a result with an unknown barcode or marker? Who is alerted when a feed fails?

### 5. Results by PDF import

**Who:** the patient uploads, or a PDF arrives by email; a PA checks. **Status:** planned.

1. A PDF arrives: the patient uploads it, or the clinic's inbox forwards it to Clinic Hub.
2. The file is stored privately and appears in the import queue as "needs match".
3. An AI tool reads it and proposes each value with a confidence level (high, medium or low).
4. A PA matches the PDF to a patient, then confirms or rejects every value. Nothing becomes a result without this confirmation.
5. On confirm, a report is created and waits for the doctor (flow 6).

**Data in/out:** a document reader sends the PDF's text to an AI provider and receives the values back. The provider is not chosen yet, and the file contains health information. **Email:** inbound only, the clinic's results inbox.

**Questions:** which AI provider, and what data-processing terms does the clinic accept? Which email address receives PDFs, and who owns it? May a patient's own upload, with no check by the clinic, ever count as a result? How long are the original PDFs kept?

### 6. Doctor reviews and releases

**Who:** a doctor. **Status:** planned.

1. The report appears under "Results to review", with out-of-range values first.
2. The doctor checks each value against the lab's range and earlier results, and may add a comment to a value or a note to the whole report.
3. The doctor releases the report. The system records who released it and when.
4. The patient is told a result is ready, through the bell in the portal and, according to their preferences, a message.
5. The order is marked reviewed.

**Data in/out:** a message through GoHighLevel to the patient (proposed), because that system owns reminders and messaging. **Email:** proposed, "You have a new result in your portal". It must never contain a value or a verdict, only a prompt to sign in.

**Questions:** may a PA release normal results, or only doctors? Is a second doctor needed for critical values? How soon must a doctor review a report, and who is alerted if one waits too long? Should the doctor see a draft of the patient's view before release?

### 7. Patient reads results and trends

**Who:** a patient, or a guardian. **Status:** planned (the home page already shows a short version).

1. The patient opens "My results" and sees released reports, newest first.
2. Each marker shows its value, the lab's range, a flag (normal, borderline, low, high, critical) and the doctor's comment.
3. A marker opens a chart of every released value over time, across labs.

**Data in/out:** none. **Email:** none.

**Questions:** should patients see the lab's range or the clinic's own optimal range? Do some markers need a hold-back, for example HIV or fertility? How do we show a critical value without a comment?

### 8. Request a repeat prescription

**Who:** a patient or a guardian who can act, or a PA for a patient. **Status:** planned.

1. The patient picks a current medicine and adds a note.
2. The patient pays the repeat fee, set at £30 in the data model, through Stripe.
3. A task is created in GoHighLevel for the team, and the request shows as "requested".
4. A doctor or PA approves or declines. An approval is passed to the prescriber's system and the pharmacy. The request moves to "sent to pharmacy".
5. The patient sees the status at each step.

**Data in/out:** Stripe for the fee; GoHighLevel for the task. Prescribing itself stays in Semble, so Clinic Hub only tracks the request (proposed). **Email:** proposed, a receipt and a status update.

**Questions:** is the fee refunded if a request is declined? Who pays for a guardian's request? How does an approved request reach Semble and the pharmacy? Which medicines may be requested, and how often?

### 9. Ask the clinic

**Who:** a patient, or a guardian who can act. **Status:** planned.

1. The patient writes a subject and message, and marks it routine or important.
2. The question opens a conversation in GoHighLevel, where the team replies.
3. The portal shows the question's status: awaiting reply, answered or closed.

**Data in/out:** outbound to GoHighLevel when the question is sent; inbound status updates when the team replies. **Email:** none from Clinic Hub. Replies reach the patient through GoHighLevel's own channels.

**Questions:** do replies show inside the portal, or only in the patient's usual channel? Is "important" a promise of a faster reply, and how fast? What should patients do in an emergency, and where is that stated?

### 10. Appointments and the bloods due date

**Who:** the system. **Status:** reading is built; the link to booking systems is planned.

1. Bookings live in GoHighLevel or Semble. A background job copies them into Clinic Hub at intervals.
2. The portals show the copy: the patient's next appointment, and the clinic's diary.
3. When an appointment needs bloods, the due date is 14 days before it. The clinic home lists appointments in that window that are missing results.

**Data in/out:** inbound from GoHighLevel and Semble, one way. Nothing is booked, moved or cancelled from Clinic Hub. **Email:** none.

**Questions:** which system is the source of truth for bookings, and how often should we copy them? Which appointment types need bloods, and is 14 days right for all? Should a patient be able to book or move a visit from the portal?

### 11. A guardian acts for a patient

**Who:** a PA verifies; the guardian then uses the patient portal. **Status:** database ready, screens planned.

1. The guardian has an account.
2. A PA checks the relationship, for example parent or carer, and creates a verified link. The PA decides whether the guardian can only view, or can also act (pay, request, ask).
3. The guardian signs in and sees the patient's portal, with the patient's name at the top.
4. A guardian who can only view sees no action buttons.

**Data in/out:** none. **Email:** proposed, a message to the patient (or the guardian) when a link is created.

**Questions:** what age and consent rules apply, for example under-18s and the move to adult access? Can one PA create a link alone, or is a second approver needed before "can act"? Does a guardian of several patients need a switcher? Can a patient see and remove a guardian?

### 12. Safeguarding alert

**Who:** a doctor. **Status:** planned.

1. A doctor adds an alert to a patient's file with a type, severity (low, moderate, high), a note and a review date.
2. Only doctors can see alerts. Patients, guardians, PAs, health coaches and admins cannot.
3. The alert is reviewed on its date and then closed.

**Data in/out:** none. **Email:** none.

**Questions:** should a PA see that an alert exists, without its content? Who is reminded when a review date arrives?

### 13. A team member leaves

**Who:** an admin. **Status:** planned (a switch in the database today).

1. The admin marks the staff profile as inactive.
2. Access to every clinic screen and record ends at once, even if the person stays signed in. Their history and audit trail remain.
3. The account is suspended. Nothing is deleted.

**Data in/out:** none. **Email:** none.

**Questions:** should the admin also remove the person from GoHighLevel and Semble from here, or is that a separate step? Should a leaver's tasks be reassigned automatically?

## Integrations

Clinic Hub connects to nine systems. Only the first two are in place; the rest are agreed in the data model and wait to be built. Every exchange with an outside system will be logged: what moved, in which direction, when, and whether it worked.

| System | Used for | Data direction | What is exchanged | Status |
| --- | --- | --- | --- | --- |
| Supabase | The database, sign-in and private file storage | Both | Everything Clinic Hub stores | Built. Region and data processing agreement to be confirmed |
| Vercel | Hosting, page-speed measures, visit counts | Out | Page address (without query), device and performance data. No cookies | Set-up in progress |
| Stripe | Payments for bloods and repeat-request fees | Both | Payment amounts and a reference. The clinic never holds card details | Planned |
| Lab partners (TDL is named) | Results by electronic feed; barcodes | In (and out, proposed) | Results per marker, with the barcode that links them to an order | Planned |
| GoHighLevel | Messaging, reminders, tasks, calendar, invoices, marketing | Both | Tasks and conversations out; bookings and replies in; reads each person's notification choices | Planned |
| Semble | Consultation notes and prescribing | In | Bookings, and prescriptions (proposed) | Planned |
| Resend | Email from Clinic Hub (invitations, password reset) | Out | Only links and neutral wording. No clinical values | Planned, waiting for the clinic's domain |
| AI document reader | Reads values from imported PDFs | Both | The PDF's content out; proposed values back | Planned. Provider not chosen |
| Fathom | Named as a source in the data model | To confirm | To confirm | Purpose to be confirmed |

**How incoming messages are handled.** Stripe, the labs and GoHighLevel push messages to Clinic Hub. Each message is stored first, then processed, and its unique number stops it being applied twice. A failed message can be retried.

**Questions**

1. Which lab partners will send results, and in which format? Is TDL the first?
2. What is Fathom used for, and should it connect to Clinic Hub?
3. Which system is the source of truth for bookings, and for patient contact details, GoHighLevel, Semble or Clinic Hub?
4. Which AI provider, where is it hosted, and does the clinic accept its data terms?
5. Does the clinic have an existing Stripe account, and is the lab fee passed through or invoiced separately?
6. Who in the clinic is the owner of each connection, for example whoever holds the GoHighLevel and Stripe logins?

## Emails and notifications

Only one message is built today, the password reset link. The rest are proposed, and each needs the clinic's approval of its wording and sender.

| Message | Sent when | To | Sent through | Status |
| --- | --- | --- | --- | --- |
| Password reset link | The person asks for a reset | The person | Sign-in service, then Resend | Built; needs the sending domain |
| Invitation | A PA or admin invites someone | The new person | Resend | Planned |
| Bloods ordered, and a reminder before the due date | An order is created; the due date nears | The patient | GoHighLevel (proposed) | Planned |
| Payment receipt | Stripe confirms a payment | The payer | Stripe or GoHighLevel (proposed) | Planned |
| A result is ready | A doctor releases a report | The patient, and a guardian who can view | GoHighLevel, by the person's choices | Planned |
| Repeat request update | The request is approved, declined or sent | The patient | GoHighLevel (proposed) | Planned |
| Question answered | The team replies | The patient | GoHighLevel | Planned |
| Guardian link created | A PA verifies a guardian | The patient and the guardian | Resend (proposed) | Planned |
| Results PDF received | A PDF is emailed to the clinic's inbox | The import queue, not a person | The clinic's mailbox | Planned (inbound) |

**In the portal.** The bell in the top bar shows notifications on four topics: results, payments, appointments and messages. Each person chooses, per topic, whether they also want email, WhatsApp, SMS or the portal only. GoHighLevel reads those choices before it sends anything.

**Rules for every message**

- It never contains a result, a value, a diagnosis or a medicine. It says that something is ready and links to the portal.
- It uses a neutral subject line, for example "You have a new message from The Schoeman Clinic".
- It is in British English, with no exclamation marks and no medical promises.
- Links lead to the sign-in page. Nobody is signed in by clicking a link in a message, except a password reset or an invitation, which work once.

**Questions**

1. Which domain and sender name should emails use, and who owns that domain's settings?
2. Do patients want WhatsApp and SMS as well as email? Does the clinic already have a provider and consent for them?
3. Who approves the wording of each message, and is a footer or disclaimer required?
4. Should some messages ignore a patient's choices, for example a critical result?
5. Is there a reply-to address, and who monitors it?

## Open questions for the clinic

Twenty-one questions, grouped by topic and ordered within each topic by how much they block. Please send your answers to the project team.

| # | Topic | Question | What it decides |
| --- | --- | --- | --- |
| 1 | Access | Do staff see every patient, or only those on their care team? Who maintains the care team? | Who can open which record |
| 2 | Access | May admins read clinical records? | The admin's menu and data |
| 3 | Access | What may the health coach see beyond released results? | The coach's menu and data |
| 4 | Access | May a doctor who is also a patient see their own unreleased results and safeguarding alerts? | Conflict-of-interest rule |
| 5 | Guardians | What age and consent rules apply? Can one PA create a link that lets a guardian act, or is a second approver needed? Can a patient see and remove a guardian? | Guardian screens and checks |
| 6 | Accounts | Who may invite staff, the PA, the admin or both? Is a second approval needed for doctors and admins? How long does an invitation last? | The invitation flow |
| 7 | Accounts | Which roles are missing, such as reception, nurse or phlebotomist? | The role list |
| 8 | Bloods | How are barcodes made, where are samples taken, are prices fixed, and what happens to an unpaid order or a refund? | The ordering flow |
| 9 | Bloods | Which labs send results electronically, in what format, and what happens to an unknown barcode or marker? | The lab feed |
| 10 | Bloods | Which AI provider reads PDFs, which terms does the clinic accept, which inbox receives them, and how long are originals kept? | PDF imports |
| 11 | Bloods | Who may release results, is a second doctor needed for critical values, and do some markers need a hold-back? | The release rules |
| 12 | Bloods | Does the patient see the lab's range or the clinic's own range? | How results are shown |
| 13 | Requests | For repeat prescriptions: the fee, refunds, which medicines, how often, and how an approval reaches Semble and the pharmacy | The repeat flow |
| 14 | Messages | Do replies to questions show in the portal? What do patients do in an emergency, and how fast is "important" answered? | Ask the clinic |
| 15 | Systems | Which system holds the truth for bookings and contact details? How often do we copy bookings? Which appointment types need bloods? | The sync |
| 16 | Systems | What is Fathom used for? Who owns the Stripe, GoHighLevel and Semble accounts? | The connections |
| 17 | Emails | Which domain and sender name? Do patients want WhatsApp and SMS? Who approves each message? May a critical result override a patient's choices? | Resend and the message list |
| 18 | Sign-in | Are the session lengths right? Do staff need a second step at sign-in? Who resets a staff password? Is reception a shared computer? | Sign-in rules |
| 19 | Compliance | What retention periods apply to records, uploads and the activity log? | Archive and purge rules |
| 20 | Compliance | Who is the clinic's data protection lead? How are patient requests to see or erase data handled, given records are archived and not deleted? Does the privacy notice mention page-speed and visit counts? | Legal readiness |
| 21 | Priorities | Which planned pages matter most for the first release, in order? | The build order |

## Decisions already taken

- The first release is the bloods loop. Messaging, reminders, calendar, invoices and marketing stay in GoHighLevel. Consultation notes and prescribing stay in Semble.
- Least privilege: admins and health coaches have no clinical access until the clinic decides otherwise.
- A patient sees a result only after a doctor releases it. Safeguarding alerts are for doctors only.
- Sign-in is by email and password. There is no public sign-up.
- Staff sessions end after 12 hours, or 30 minutes idle. Patient sessions end after 7 days, or 2 hours idle.
- Records are archived, never deleted. Accounts are suspended, never removed.
- Every change to a clinical record is logged with who made it, and the log cannot be edited.
- Two-step sign-in for staff and a robot check are deferred until the clinic has accounts to enrol.
- Page-speed and visit counts use no cookies, and each address is cut to its path before it is sent.
