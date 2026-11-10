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

Two other systems stay in charge of what they do today: GoHighLevel keeps messaging, reminders, tasks, calendar, invoices and marketing, Semble keeps consultation notes, and SignatureRx handles prescribing. Clinic Hub reads from them where a screen needs the information. The section on integrations lists every connection.

**Status today:** the database for every step above exists and is protected, and both home screens are built. Steps 1 to 7 as screens, and every connection to Stripe, the labs, GoHighLevel and Semble, are planned.

## Roles

There are six roles, plus the guardian, who is a link to a patient rather than a role. What each role can reach is enforced in the database, not only on screen, so a missing button never means the data is hidden by accident.

| Role | Who | What they do in Clinic Hub | Home |
| --- | --- | --- | --- |
| Patient | A patient of the clinic | Sees their own record and released results, orders and pays for bloods, uploads results, requests repeat prescriptions, asks the clinic questions, reads shared letters | Patient portal |
| Guardian | A person verified by the clinic as able to see or act for a patient, for example a parent | Sees the patient's portal, and acts for them (pays, requests, asks) only if the clinic ticked "can act" | Patient portal, viewing that patient |
| Doctor | A clinician | Reviews and releases results, comments on values, writes letters, sees safeguarding alerts, orders bloods | Clinic portal |
| PA | A personal assistant or practice administrator | Matches and confirms imported PDFs, manages orders and repeat requests, invites patients and verifies guardians | Clinic portal |
| Health coach | A coaching team member | Sees released results only, and no team-only information | Clinic portal |
| Nurse | A nurse at the clinic | Can sign in and has a profile. Sees no patient records until the clinic decides what a nurse may do (question 7) | Clinic portal |
| Admin | A clinic or system administrator | Manages the team, roles and settings, reads the activity logs; sees no clinical records | Clinic portal |

**Rules that apply to every role**

- A person can hold more than one role. A doctor who is also a patient has both a clinic view and a patient view, and switches between them from the top bar.
- A staff member only works while their staff profile is active. Switching it off ends their access at once, without deleting anything.
- A suspended account can do nothing, whatever roles it still holds.
- Records are archived, never deleted. People are suspended, never removed.
- Nobody can change their own role.

**How accounts are created.** By invitation. A PA invites patients and guardians, and an admin invites anyone, from the Team and settings page. The person gets an email with a link that works for 3 days, chooses a password, and lands on their home page. Someone who already has an account signs in and accepts, and the new access is added to that same account.

**Questions**

- Who should be able to invite team members, the PA, the admin, or both? Should inviting a doctor or an admin need a second approval?
- Is "health coach" the right name, and does the clinic have other roles to add, such as reception, a nurse or a phlebotomist? What may the nurse see and do?

## Access by role

This table is what the database enforces today. "Read" means can see; "add" and "change" mean can create or edit. A dash means no access at all. Guardian columns assume a verified link; where a guardian needs "can act", the cell says so.

| Information | Patient | Guardian | Doctor | PA | Health coach | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| Own account and contact details | Read, change | Read, change | Read, change | Read, change | Read, change | Read, change |
| Profile photo | Own: add, replace, remove. Sees staff photos | Same as patient | Own: change. Sees everyone's | Own: change. Sees everyone's | Own: change. Sees staff photos | Own: change. Sees everyone's |
| Signature for letters | - | - | Own: add, replace | - | - | - |
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
| Invitations | - | - | - | Patient and guardian invitations | - | All invitations |
| Appointments | Read | Read | Read | Read | Read | - |
| Lab orders | Read | Read | Read, add, change | Read, add, change | Read | - |
| Lab reports and results | Released only | Released only | Read all, comment, release | Read all | Released only | - |
| Imported PDFs and extracted values | - | - | Read, decide | Read, decide | - | - |
| Letters and documents | What the clinic shared, upload own | Same, upload if can act | Read, add, change | Read, add, change | Read (lab PDFs once released) | - |
| Questions to the clinic | Read, ask | Read, ask if can act | Read, change status | Read, change status | Read | - |
| Repeat prescription requests | Read, request | Read, request if can act | Read, change status | Read, request for a patient, change status | Read | - |
| Own notifications and preferences | Read, change | Read, change | Read, change | Read, change | Read, change | Read, change |
| Reference data (tests, markers, prices, lab partners, locations) | Read | Read | Read | Read | Read | Read, add, change |
| Activity and integration logs | - | - | - | - | - | Read the activity log on the Activity screen |

**Points the table does not show**

- Today every doctor, PA and health coach can open every patient. The database is already prepared to narrow this to a patient's own care team, but it is switched to "everyone" until the clinic decides.
- Appointments and payments are never entered by hand: they arrive from the booking system and from Stripe.
- Patients and guardians never reach unreleased results, safeguarding alerts, imports or the care team, however they ask. This is tested.
- Every change to a clinical record is written to a permanent log: who, what and when. The log never stores the clinical values themselves.
- Opening a patient's report is written to the same log: who, which record, which patient and when, once every ten minutes at most. Admins read it on the Activity screen. Other record screens will do the same as they are built.
- The nurse role exists, but a nurse has no access to patient information until the clinic decides (question 7).

**Questions**

1. Should staff see every patient, or only those on their care team? If only the care team, who maintains it?
2. May admins read clinical records, or stay limited to team, settings and logs?
3. May the health coach see more than released results, for example diagnoses and medications, or less?
4. May a PA add allergies, and may a PA read diagnoses and medications, as in the table?
5. May a doctor who is also a patient see their own unreleased results and safeguarding alerts?

## Pages by role

Eleven screens are built and the rest are planned. Every built screen reads real data. Their action buttons are visible but switched off until the flows behind them exist; menu items for planned screens read "Coming soon".

**Built**

| Page | Who sees it | What it shows |
| --- | --- | --- |
| Sign in | Everyone | Email and password. A short message if the session ended or a link expired. Accounts are by invitation: there is no sign-up |
| Forgot password | Everyone | Asks for an email address and always replies "if that address has an account, we have sent a link", so it never reveals who has an account |
| Choose a new password | Anyone with a valid link or a signed-in session | Sets a new password: at least 12 characters, with a lower-case letter, a capital and a number |
| Patient home | Patient, guardian | A greeting. A banner when bloods are due, with the date. Next appointment. Bloods due, with the panel name and progress (ordered, paid, sample taken, results in). New results, once a doctor has released them. Up to four of the patient's markers at a glance, out-of-range first. The latest letter and shared documents. A guardian sees the same, headed with the patient's name |
| Clinic home | Doctor, PA, health coach, admin | Four figures: today's appointments, results to review, imports waiting, open tasks (shown as a dash until GoHighLevel is connected). A list of results needing attention. Today's diary at the chosen location. Appointments in the next 14 days that are missing bloods |
| Profile | Everyone signed in | One page for patients and guardians and one for staff, in tabs. Details: photo, name and phone. Security: change password, change sign-in email, sign out other devices. Notifications: email and portal choices by topic. Patients also see the clinic's record of them (read only), guardians see the patients they look after, staff see their work details, and doctors keep their signature for letters |
| Team invitations | PAs and admins | A list of invitations with their status (pending, accepted, expired, cancelled), who sent them and when, and a button to invite someone. PAs see patient and guardian invitations. Admins see all of them. Each pending or expired invitation can be sent again, and a pending one can be cancelled |
| Your invitation | Anyone with an invitation link | A page, with no sign-in needed, where the invited person creates their account, or signs in to add the new access to the account they already have |
| My results | Patient, guardian | Every released marker with its latest value, the range, a status and a small trend. A marker opens a chart of every value over time with the range as a band, a table of the values and the doctor's comments | None |
| Results review | Doctor, PA, health coach | Files waiting for entry, reports to review, and recently released ones. A report shows each value, the value as the lab reported it, the range and a status. A doctor comments on markers and releases. A health coach sees released reports only | None |
| Add results | PA, doctor | Pick the patient, the sample date and optionally the lab's file, then enter each value with its unit. Values in another unit are converted to UK units, and the original is kept | None |
| Activity | Who opened or changed a patient's record, and when: date, person and role, what was done, and the patient's name. No clinical values. Newest first, fifty at a time. Built | Admin | None |
| App frame | Everyone signed in | Menu, a bell for notifications, a location chooser (clinic only), and an account menu showing name and role, with sign out and, for people with both views, a switch between clinic and patient |

**Planned, patient and guardian**

| Page | What it will do | Uses another system |
| --- | --- | --- |
| Lab orders | List orders, pay, show the barcode, follow progress | Stripe |
| Upload results | Send PDFs from another lab, for example abroad: up to 5 files each time, PDF only, in the name the patient registered with | AI extraction (provider to be chosen) |
| Prescriptions | Current medicines; request a repeat for a fee | Stripe, GoHighLevel |
| Appointments | Upcoming and past visits | GoHighLevel or Semble |
| Ask the clinic | Send a question and see its status | GoHighLevel |
| Letters and documents | Read what the clinic has shared | None |
| Privacy and consent | See and change consents, notification choices | GoHighLevel reads the choices |

**Planned, clinic**

| Page | What it will do | Proposed roles | Uses another system |
| --- | --- | --- | --- |
| Patient list | Find a patient and open their record | Doctor, PA, health coach | None |
| Lab orders | Create and follow orders | Doctor, PA | Stripe, lab partner |
| Safeguarding alerts | Add and review alerts | Doctor only | None |
| Team and settings | The list of the team, their roles, and the clinic's tests, prices, partners and locations. Invitations are already built | Admin | None |

Today every staff member sees the same clinic menu, and the database decides what each can open. The planned design hides the items a role cannot use.

**Questions**

1. Do the proposed roles per clinic page match how the team works?
2. Should a guardian who looks after several patients choose between them? Today they see the first.
3. Which pages matter most for the first release, in order?

## Profile and account settings

Every person has a profile page. It is where they look after their own account, and nothing there can change what they are allowed to see.

| Tab | Who | What they can change | What is kept, and where |
| --- | --- | --- | --- |
| Details | Everyone | Photo, full name, phone | Name and phone in the account record. The photo in private storage, one per person |
| Your record | Patients | Nothing: read only | The clinic's own record of the patient. Changes go through the clinic |
| People you look after | Guardians | Nothing: read only | The guardian links the clinic has confirmed |
| Work profile | Staff | Nothing: read only | Job title, role, GMC number (doctors), locations and status, managed by an admin |
| Signature | Doctors | Upload or replace the signature | A separate private storage area that only that doctor can read |
| Notifications | Everyone | Email and portal, for results, payments, appointments and messages | One saved choice per topic and channel |
| Security | Everyone | Password, sign-in email, sign out other devices | The sign-in service, which holds the password safely and never shows it |

**Rules the screen follows**

- A photo is a JPEG, PNG or WebP. A large photo is made smaller in the browser, to 2 MB at most. HEIC from an iPhone has to be saved as JPEG first.
- A name has up to 120 characters. A phone number has up to 30 characters, with digits, spaces, plus, brackets and hyphens only. The database enforces this, not only the screen.
- A signature is 1 MB at most, and it is stored where no one else can read it, including patients, PAs and admins.
- A change of sign-in email is confirmed by a link, and the old address is told, so a stolen session cannot change it quietly. When it is confirmed, the account record is updated by itself.
- Every change to the account record is written to the permanent log, without its values.

**What changed behind the scenes**

- **Account record:** limits on name and phone, and an automatic update of the stored email when the sign-in email changes.
- **Photos:** each person can store one photo, at a fixed place only they can write to. The clinic team can see patients' photos, and anyone signed in can see staff photos.
- **Signatures:** a new private storage area, with its own rules, readable only by the signer.
- **Emails:** five sign-in emails now have the clinic's look, including a notice to the old address when the sign-in email changes.

**Questions**

1. May a patient change their own phone and contact email?
2. Who may see a patient's photo, and should patients see staff photos?
3. Who besides doctors signs letters?

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
| Change password | In the profile. The person enters the current password first. Every other device is signed out, and an email tells them the password changed |
| Change sign-in email | In the profile, with the current password. A link goes to the new address to confirm, and the old address is told when the change is made |
| Other devices | A button in the profile signs the account out everywhere else, for a lost device or a shared computer |

**Email.** The sign-in emails (reset link, change of email, security code, and the notices that the password or email changed) are sent by the sign-in service through Resend, from an address on a test domain for now. They move to the clinic's own domain once it is verified.

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
| 1 | Create an account | Built | None | Yes |
| 2 | Sign in and reset a password | Built | None | Yes |
| 3 | Order bloods and pay | Planned | Stripe, lab partner | Proposed |
| 4 | Results by lab feed | Planned | Lab partner | Proposed |
| 5 | Results by PDF import | Built without AI: values entered by hand | None | Yes (inbound) |
| 6 | Doctor reviews and releases | Built | GoHighLevel | Proposed |
| 7 | Patient reads results and trends | Built | None | No |
| 8 | Request a repeat prescription | Planned | Stripe, GoHighLevel | Proposed |
| 9 | Ask the clinic | Planned | GoHighLevel | Proposed |
| 10 | Appointments and bloods due date | Read built, sync planned | GoHighLevel, Semble | No |
| 11 | A guardian acts for a patient | Planned | None | Proposed |
| 12 | Safeguarding alert | Planned | None | No |
| 13 | A team member leaves | Planned | None | No |
| 14 | Update your profile and sign-in details | Built | None | Yes |

### 1. Create an account

**Who:** a PA or an admin invites; the new person accepts. **Status:** built.

1. On Team and settings, the PA or admin chooses what kind of invitation to send. PAs can invite patients and guardians. Admins can invite anyone: patients, guardians and team members (doctor, PA, health coach, nurse or admin).
2. For a patient or guardian, they choose a patient already in the clinic's records, or add a new patient with a name and date of birth. A guardian invitation also says how the guardian is related and whether they can act for the patient. A team invitation says the role and job title.
3. For a patient invitation, the address should be the one in the patient's record. If it is different, the sender sees a warning and has to switch on "Send to this address anyway" before the invitation goes. A new patient takes the address from the invitation.
4. The system emails a one-time link, valid for 3 days. The email never says who the patient is or anything clinical. When a doctor or an admin is invited, the other admins get a notice in the portal bell. When a guardian who can act for a patient is invited, the other PAs get one.
5. The person opens the link. For a patient or guardian, they are asked for a date of birth: their own for a patient, the patient's for a guardian. After five wrong dates the link is cancelled and the sender is told. If they have no account, they enter their name and choose a password. If they already have an account, they sign in and press one button to add the new access to it, for example a doctor who is also a patient.
6. The system checks that the link is unused and has not expired, that the person who sent it can still invite, that the address matches, that the date of birth matches (patient and guardian), and that the patient record has no account yet. It then adds the role or link, activates the account and tells the person who invited.
7. The person lands on their home page.

A PA or admin can send an invitation again, which cancels the old link, or cancel it. Nobody else can invite. There is no second approval for doctors or admins, but every invitation and every access it grants is in the permanent log under the inviter's name.

**What each invitation needs.** Use this table whenever you ask about an invitation: it says what the sender must give, and what the invited person must give.

| Invitation | Who sends it | The sender gives | The invited person gives | Notice to others |
| --- | --- | --- | --- | --- |
| Patient | PA or admin | Email address (it should match the patient's record). Either a patient already in the records, or a new patient: first name, last name and date of birth | Their own date of birth, their name and a password (or their password, if they have an account) | None |
| Guardian | PA or admin | Email address. The patient. How the guardian is related (parent, carer or power of attorney). Whether they can act for the patient. The guardian's name is optional | The patient's date of birth, their own name and a password (or their password, if they have an account) | If the guardian can act, the other PAs |
| Doctor, PA, health coach or admin | Admin only | Email address. The role. Job title and name are optional | Their name and a password (or their password, if they have an account). No date of birth | If a doctor or an admin, the other admins |

For a new patient the clinic reference (SC- and six digits) is made automatically. Every invitation is logged under the sender's name.

**Email:** the invitation, sent through Resend. It carries no clinical information. **Data in/out:** none from other systems.

**Questions:** are the notices in the portal bell enough when a doctor, an admin or a guardian who can act is invited, or should they go by email, or need a second person to approve? Should a doctor be able to invite their own patients? Should a patient get an account at their first visit, or only when the clinic first orders bloods?

### 2. Sign in and reset a password

**Who:** anyone with an account. **Status:** built.

1. The person enters email and password. The system sends them to the clinic portal (staff) or the patient portal (patients and guardians).
2. If the account is suspended or has no role, they see "This account does not have access" and are signed out.
3. If they forgot the password, they ask for a link. The reply is the same whether or not the address has an account.
4. The link opens a page to choose a new password, then signs them in.

**Email:** the reset link, sent by the sign-in service through Resend. It works from a test domain today and moves to the clinic's domain later. **Data in/out:** none.

**Questions:** none beyond those under sign-in.

### 3. Order bloods and pay

**Who:** a doctor or PA creates the order; the patient (or a guardian who can act) pays. **Status:** planned.

1. The doctor or PA picks a test panel and a lab partner. The due date is the appointment date minus 14 days. The order starts as "sent to patient".
2. The patient sees a "bloods due" banner and opens the order.
3. The patient pays. The price comes from the panel's price list.
4. Stripe confirms the payment. The order becomes "paid" and gets a barcode.
5. The patient takes the barcode to the sample point. When the lab or clinic records the sample, the order becomes "sample taken".
6. When results arrive (flows 4 and 5), the order becomes "results in", then "reviewed" after a doctor's review.

**Cycle guidance.** For a patient whose sex at birth is female: with regular periods, the sample is taken on day 21 of the cycle; with irregular periods or none, any day. If sex at birth is missing, the order stops and a PA is told. It is never guessed.

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

**Who:** the patient uploads, or a PDF arrives by email; a PA checks. **Status:** built without the AI step. A PA enters each value by hand from the lab's report. The AI reading is planned for later. A patient's own upload from the portal is planned too: PDF only, up to 5 files each time (a patient can upload again later), and the name on the report must match the name the patient registered with. A PA checks it is complete. Staff can add PDF, JPEG or PNG files up to 10 MB.

1. A PDF arrives: a PA or doctor attaches it when adding results, or (planned) the patient uploads it or the clinic's inbox forwards it.
2. The file is stored privately and appears in the import queue as "needs match".
3. Planned for later: an AI tool reads the file and proposes each value with a confidence level (high, medium or low). Today this step is done by hand.
4. A PA picks the patient, the sample date and the lab, and enters each value with the unit on the report. A value in another unit is converted to the clinic's UK unit, and the original value and unit are kept next to it. Each value gets a status: low or high against the range, borderline when it is inside the range but within 5% of an edge, otherwise in range. A doctor sets critical.
5. On sending, a report is created and waits for the doctor (flow 6). Nothing is visible to the patient yet.

**Data in/out:** a document reader sends the PDF's text to an AI provider and receives the values back. The provider is not chosen yet, and the file contains health information. **Email:** inbound only, the clinic's results inbox.

**Questions:** which AI provider, and what data-processing terms does the clinic accept? Which email address receives PDFs, and who owns it? May a patient's own upload, with no check by the clinic, ever count as a result? How long are the original PDFs kept?

### 6. Doctor reviews and releases

**Who:** a doctor. **Status:** built, except the message through GoHighLevel.

1. The report appears under "To review" on the Results review page.
2. The doctor checks each value against the lab's range and earlier results, and may add a comment to a value or a note to the whole report.
3. The doctor releases the report. The system records who released it and when.
4. The patient is told a result is ready, through the bell in the portal and by email ("A new result is ready in your portal"). The email holds no value or verdict, only a sign-in link, and it is not sent if the patient has switched results emails off in their profile. A message by WhatsApp is planned.
5. The order is marked reviewed.

**Data in/out:** the email is sent by Clinic Hub through Resend, as one of the portal's own messages. GoHighLevel keeps the clinic's reminders and WhatsApp, so nothing here goes through it. **Email:** "A new result is ready in your portal". It never contains a value or a verdict, only a prompt to sign in.

**Questions:** may a PA release normal results, or only doctors? Is a second doctor needed for critical values? How soon must a doctor review a report, and who is alerted if one waits too long? Should the doctor see a draft of the patient's view before release?

### 7. Patient reads results and trends

**Who:** a patient, or a guardian. **Status:** built.

1. The patient opens "My results" and sees released reports, newest first.
2. Each marker shows its latest value, the range, a status and a small trend.
3. A marker opens a chart of every released value over time, with the range as a band, a table of the values and the doctor's comments.

**Data in/out:** none. **Email:** none.

**Questions:** should patients see the lab's range or the clinic's own optimal range? Do some markers need a hold-back, for example HIV or fertility? How do we show a critical value without a comment?

### 8. Request a repeat prescription

**Who:** a patient or a guardian who can act, or a PA for a patient. **Status:** planned.

1. The patient picks a current medicine and adds a note.
2. The patient pays the repeat fee, set at £30 in the data model, through Stripe.
3. A task is created in GoHighLevel for the team, and the request shows as "requested".
4. A doctor or PA approves or declines. An approval is passed to SignatureRx, where the doctor signs with a PIN, and to the pharmacy. The request moves to "sent to pharmacy".
5. The patient sees the status at each step.

**Data in/out:** Stripe for the fee; GoHighLevel for the task. Prescribing itself is done in SignatureRx, so Clinic Hub only tracks the request (proposed). **Email:** proposed, a receipt and a status update.

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

### 14. Update your profile and sign-in details

**Who:** anyone signed in. **Status:** built.

1. The person opens Profile from the account menu (top right).
2. In **Details** they change their photo, name and phone. A large photo is made smaller in the browser before it is sent. A photo in HEIC format has to be saved as JPEG first.
3. In **Notifications** they choose, per topic and for email and for the portal, what they want to hear about. A choice that has never been saved counts as on.
4. In **Security** they can change the password (the current one is asked for, and every other device is signed out), ask to change the sign-in email (a link goes to the new address, and the old address is told when it changes), or sign out other devices.
5. Patients also see the clinic's record of them, read only. Guardians see the patients they look after. Staff see their work details, and doctors can store a signature for letters that only they can read.

**Data in/out:** none from other systems. **Email:** the password changed notice, the email change confirmation, and the email changed notice, all sent by the sign-in service.

**Questions:** may patients change their own phone and contact email, or only the clinic? Who signs letters besides doctors?

## Integrations

Clinic Hub connects to nine systems. Supabase and Resend are in place (Resend on a test domain); the others are agreed in the data model and wait to be built. Every exchange with an outside system will be logged: what moved, in which direction, when, and whether it worked.

| System | Used for | Data direction | What is exchanged | Status |
| --- | --- | --- | --- | --- |
| Supabase | The database, sign-in and private file storage | Both | Everything Clinic Hub stores | Built. Region and data processing agreement to be confirmed |
| Vercel | Hosting, page-speed measures, visit counts | Out | Page address (without query), device and performance data. No cookies | Set-up in progress |
| Stripe | Payments for bloods and repeat-request fees | Both | Payment amounts and a reference. The clinic never holds card details | Planned |
| Lab partners (TDL is named) | Results by electronic feed; barcodes | In (and out, proposed) | Results per marker, with the barcode that links them to an order | Planned |
| GoHighLevel | Messaging, reminders, tasks, calendar, invoices, marketing | Both | Tasks and conversations out; bookings and replies in; reads each person's notification choices | Planned |
| Semble | Consultation notes, bookings and invoices | In | Bookings | Planned |
| SignatureRx | Prescribing, signed by the doctor with a PIN | Out | Repeat prescriptions (proposed) | Planned |
| Resend | Email from Clinic Hub and the sign-in emails (invitations, password reset, security notices) | Out | Only links and neutral wording. No clinical values | In place on a test domain. It moves to the clinic's own domain later |
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

Every message has a template in the clinic's look. The sign-in emails (reset, change of email, security code and the two notices) are live through Resend on a test domain; the rest wait for their flows. The sender moves to the clinic's own domain once it is verified. Each message still needs the clinic's approval of its wording.

| Message | Sent when | To | Sent through | Status |
| --- | --- | --- | --- | --- |
| Password reset link | The person asks for a reset | The person | Sign-in service, sent through Resend | Live on a test domain |
| Email address change | The person changes their sign-in email | The old and the new address | Sign-in service, sent through Resend | Live on a test domain |
| Email changed notice | The sign-in email on an account changes | The address the account had before | Sign-in service, sent through Resend | Live on a test domain |
| Security code | A sensitive action asks the person to confirm it is them | The person | Sign-in service, sent through Resend | Template built; used when a sensitive action asks for it |
| Password changed notice | The password on an account changes | The person | Sign-in service, sent through Resend | Live on a test domain |
| Invitation | A PA or admin invites someone | The new person | Resend | Built. Sent from the invitations page |
| Bloods ordered, and a reminder before the due date | An order is created; the due date nears | The patient | GoHighLevel (proposed) | Planned |
| Payment receipt | Stripe confirms a payment | The payer | Stripe or GoHighLevel (proposed) | Planned |
| A result is ready | A doctor releases a report | The patient | Resend, from Clinic Hub, following the patient's choice for results emails | Built. A guardian is not emailed yet |
| Repeat request update | The request is approved, declined or sent | The patient | GoHighLevel (proposed) | Planned |
| Question answered | The team replies | The patient | GoHighLevel | Planned |
| Guardian link created | A PA verifies a guardian | The guardian | Resend (proposed) | Template built; the flow is planned |
| Results PDF received | A PDF is emailed to the clinic's inbox | The import queue, not a person | The clinic's mailbox | Planned (inbound) |

**Who sends what.** Clinic Hub sends the emails that belong to the portal (sign-in, invitations, a result being ready) through Resend. GoHighLevel sends the clinic's own reminders, follow-ups and WhatsApp messages, and the clinic's team manage those there.

**In the portal.** The bell in the top bar shows notifications on four topics: results, payments, appointments and messages. Each person chooses, per topic, whether they also want email, and the portal. WhatsApp and SMS join when the clinic's messaging system is connected. A choice that has never been saved counts as on. GoHighLevel reads those choices before it sends anything. Emails about sign-in security are always sent.

**Rules for every message**

- It never contains a result, a value, a diagnosis or a medicine. It says that something is ready and links to the portal.
- It closes with the same line: the clinic's phone, email and WhatsApp. Emails from Clinic Hub are signed "The Schoeman Clinic team" and open with "Dear" and the first name.
- It uses a neutral subject line, for example "You have a new message from The Schoeman Clinic".
- It is in British English, with no exclamation marks and no medical promises.
- Links lead to the sign-in page. Nobody is signed in by clicking a link in a message, except a password reset or an invitation, which work once.

**Questions**

1. Which domain and sender name should emails use, and who owns that domain's settings?
2. Do patients want WhatsApp and SMS as well as email? Does the clinic already have a provider and consent for them?
3. Who approves the wording of each message? The closing line with phone, email and WhatsApp is agreed.
4. Should some messages ignore a patient's choices, for example a critical result?
5. Is there a reply-to address, and who monitors it?

## Open questions for the clinic

Thirty-three questions, grouped by topic and ordered within each topic by how much they block. Under each one is what we heard on the call on 6 November, if anything, and what we assume until the clinic answers. If an assumption is wrong, please tell the project team.

**1. Access.** Do staff see every patient, or only those on their care team? Who maintains the care team?

*What it decides: Who can open which record.*

> **What we assume.** We follow the Access by role table in this document. The care team is recorded for later, but it does not limit access yet.

**2. Access.** May admins read clinical records?

*What it decides: The admin's menu and data.*

> **What we assume.** No. Admins see the team, settings, invitations, the activity log and the names of patients for the invitation form.

**3. Access.** What may the health coach see beyond released results?

*What it decides: The coach's menu and data.*

> **What we assume.** Released results only.

**4. Access.** May a doctor who is also a patient see their own unreleased results and safeguarding alerts?

*What it decides: Conflict-of-interest rule.*

> **What we assume.** No. As a patient they see what any patient sees.

**5. Guardians.** What age and consent rules apply? Can one PA create a link that lets a guardian act, or is a second approver needed? Can a patient see and remove a guardian?

*What it decides: Guardian screens and checks.*

> **Seen in the clinic's current plan.** The clinic sees patients under 18. Its plan has a guardian route at registration, and its own retention rules for under 18s.
>
> **What we assume.** One PA creates the link, as in flow 11. No age rule yet. A patient cannot remove a guardian; the clinic does.

**6. Accounts.** Should inviting a doctor or an admin need a second approval, or an email to the other admins? Should a doctor be able to invite their own patients?

*What it decides: The invitation flow.*

> **Heard on the call, 6 November.** The admin adds team members with a role and a location. Nothing was said about approvals.
>
> **What we assume.** No second approval. Other admins get a notice in the portal bell. Doctors invite nobody. See also question 28.

**7. Accounts.** Which roles are missing, such as reception, nurse or phlebotomist?

*What it decides: The role list.*

> **Heard on the call, 6 November.** Doctor, health coach and PA were named. No new role came up.
>
> **Seen in the clinic's current plan.** The team includes a nurse.
>
> **What we assume.** The roles are doctor, PA, health coach, nurse, admin, patient and guardian. A nurse signs in but sees no patient records until the clinic says what a nurse may do.

**8. Bloods.** How are barcodes made, where are samples taken, are prices fixed, and what happens to an unpaid order or a refund?

*What it decides: The ordering flow.*

> **Heard on the call, 6 November.** The TDL barcode is "quite complicated". We will ask TDL for the details we need.
>
> **What we assume.** Prices come from the clinic's price list (flow 3). We hold the barcode design until TDL's requirements arrive. An unpaid order is not sent to the lab.

**9. Bloods.** Which labs send results electronically, in what format, and what happens to an unknown barcode or marker?

*What it decides: The lab feed.*

> **Heard on the call, 6 November.** Labs named: TDL, Nordic Health, Regenerus and GutMap. Today they email when results are ready and staff download the PDF into the patient record. We will ask each lab whether it has an API. Adding new labs and pharmacies must be easy.
>
> **Seen in the clinic's current plan (patient flow V8 and the emails since).** The options a patient chooses from are the clinic's own lab (not yet live; the patient pays the lab directly), TDL, a TDL home kit and "I have my own results". Randox, GutMapDx, Genova and Nordic also appear. Results are matched by barcode, then by surname and date of birth, and anything unsure goes to a PA.
>
> **What we assume.** Every lab goes through PDF import (flow 5) until a lab confirms an electronic feed. An unknown barcode or marker goes to a PA to match.

**10. Bloods.** Which AI provider reads PDFs, which terms does the clinic accept, which inbox receives them, and how long are originals kept?

*What it decides: PDF imports.*

> **Heard on the call, 6 November.** Patients abroad would upload their own results. The clinic converts units today with a general AI assistant.
>
> **Seen in the clinic's current plan (patient flow V8 and the emails since).** Own results are uploaded as PDF only, up to 5 files, in the name the patient registered with, and a PA checks they are complete.
>
> **What we assume.** A patient's own upload takes PDF only, up to 5 files each time. For now a PA enters every value by hand, and a doctor reviews before release. The AI reading comes later, and it will only suggest values that a PA confirms. Provider, inbox and retention are still to be decided (see question 19).

**11. Bloods.** Who may release results, is a second doctor needed for critical values, and do some markers need a hold-back?

*What it decides: The release rules.*

> **What we assume.** Only a doctor releases. One doctor is enough. No hold-backs yet.

**12. Bloods.** Which markers do you test, and what are your base units and ranges in UK units? When a lab's range differs from the clinic's, which one does the patient see? Is it right to call a value borderline when it is inside the range but within 5% of an edge?

*What it decides: How results are shown.*

> **Heard on the call, 6 November.** Results from US, Middle East and UK labs use different units, so they must be converted to UK units to compare like for like. The clinic will send its base units. We also need the list of markers with their ranges. Reworded after the call.
>
> **Seen in the clinic's current plan (patient flow V8 and the emails since).** Results are due two weeks before the appointment (about three weeks for Randox). The doctor's own limits for an abnormal result are still to come and may differ from the lab's range. HbA1c is held in mmol/mol, so "HbA1c above 6%" means above 42. Panels in use include GS5 (female hormone and metabolic, fasting), GS10 (male hormone, no fasting) and GS11 (comprehensive male health, fasting).
>
> **What we assume.** All values are converted to UK units when entered, and the original value and unit are kept. The conversions in use are the standard factors, and they are replaced by the clinic's list when it arrives. The patient sees the range held for each marker, with a status: low or high against the range, borderline within 5% of an edge, and critical only when a doctor sets it.

**13. Requests.** For repeat prescriptions: the fee, refunds, which medicines and how often. How does an approval reach SignatureRx and the pharmacy? Is a prescription alert three weeks before it runs out right for every medicine?

*What it decides: The repeat flow.*

> **Heard on the call, 6 November.** A prescription usually covers one month more than the follow-up, for example four months for a three-month follow-up. After that the patient pays for a new one. Three weeks is the alert time, because compounded medicines take time to make and ship, for example to Qatar. We will show a banner and send an email. Reworded after the call.
>
> **Seen in the clinic's current plan (patient flow V8 and the emails since).** The £30 repeat request replaces the Typeform form. Prescribing goes through SignatureRx, and the doctor signs with a PIN as now.
>
> **What we assume.** The fee is £30, as in the data model. An approval is passed on by the team by hand at first.

**14. Messages.** Do replies to questions show in the portal? What do patients do in an emergency, and how fast is "important" answered?

*What it decides: Ask the clinic.*

> **Heard on the call, 6 November.** Questions go to info@theschoemanclinic.com, and staff triage them because a doctor may be away. Patients can mark a question urgent or not urgent.
>
> **What we assume.** Replies show in the portal with a status (flow 9). The page says it is not for emergencies. Wording and response times are to be agreed.

**15. Systems.** Until we can show how notes, prescriptions and rescheduling would work in GoHighLevel, which system holds the truth for bookings, contact details and notes? How often do we copy bookings? Which appointment types need bloods?

*What it decides: The sync.*

> **Heard on the call, 6 November.** Notes are written in Semble, and that needs an appointment in the Semble calendar, so going fully to GoHighLevel is hard to picture. The clinic wants to see what it would look like first. GoHighLevel is quicker to connect. Reworded after the call.
>
> **What we assume.** Semble keeps notes, prescribing and bookings for now. The portal shows a copy of the bookings (flow 10). There is no reschedule or cancel button. The page asks the patient to contact the team and shows the 48-hour policy, as in the clinic's patient flow.

**16. Systems.** What is Fathom used for? Which accounts will the clinic own: GitHub, Supabase, Resend, Vercel and its domain?

*What it decides: The connections.*

> **Heard on the call, 6 November.** Stripe, GoHighLevel and Semble are the clinic's. The clinic is asked to open or share GitHub, Supabase, Resend, Vercel, GoDaddy and Semble. Vercel already exists. Patient data is stored in London. Nothing was said about Fathom.
>
> **Seen in the clinic's current plan (patient flow V8 and the emails since).** Fathom turns a consultation transcript and the doctor's notes into a letter in the clinic's style, which the doctor approves before it is sent. It replaces a custom letter tool.
>
> **What we assume.** Every account is in the clinic's name. Reworded after the call.

**17. Emails.** Which sender address should patients see? Do they want WhatsApp as well as email? Who approves each message? May a critical result override a patient's choices?

*What it decides: Resend and the message list.*

> **Heard on the call, 6 November.** Reminders go by email and WhatsApp through GoHighLevel, whose automatic WhatsApp replaces SMS. Staff can answer from GoHighLevel, so many people can handle messages while fewer share the WhatsApp phone. Nothing was said about the sender address or who approves wording.
>
> **Seen in the clinic's current plan (patient flow V8 and the emails since).** Every email ends with phone, email and WhatsApp. WhatsApp goes only to patients who agreed to it, and always alongside an alert to the PAs. Mary Anne rewrites the wording and Gina approves it.
>
> **What we assume.** Emails come from The Schoeman Clinic on the subdomain already set up, until the clinic chooses another. The clinic approves each message. Emails from Clinic Hub close with the clinic's phone, email and WhatsApp. A critical result does not override a patient's choices.

**18. Sign-in.** Are the session lengths right? Do staff need a second step at sign-in? Who resets a staff password? Is reception a shared computer?

*What it decides: Sign-in rules.*

> **What we assume.** Staff sessions: 12 hours, or 30 minutes idle. Patients: 7 days, or 2 hours idle. No second step yet. Staff reset their own password.

**19. Compliance.** What retention periods apply to records, uploads and the activity log?

*What it decides: Archive and purge rules.*

> **Heard on the call, 6 November.** Not discussed. We confirmed that patient data is stored in London.
>
> **Seen in the clinic's current plan (patient flow V8 and the emails since).** The clinic needs retention rules for CQC, including its own rules for patients under 18.
>
> **What we assume.** Nothing is deleted. Records are archived and accounts suspended until the clinic sets periods.

**20. Compliance.** Who is the clinic's data protection lead? How are patient requests to see or erase data handled, given records are archived and not deleted? Does the privacy notice mention page-speed and visit counts?

*What it decides: Legal readiness.*

> **Heard on the call, 6 November.** The privacy and consent page was shown, with a switch for using data in research. No comment was made.
>
> **What we assume.** The clinic writes the privacy notice. Requests are handled by hand until a process is agreed.

**21. Priorities.** Which planned pages matter most for the first release, in order? New requests from the call are listed in questions 29 to 31.

*What it decides: The build order.*

> **Heard on the call, 6 November.** New wishes: ID and consent at first sign-in, education content, wearables, structured notes, and a Christmas prescription email. Reworded after the call.
>
> **What we assume.** The bloods loop comes first, then the rest of the planned pages in the order of this document. Questions 29 to 31 come after.

**22. Profile.** May a patient change their own phone number and contact email, or must the clinic do it? Those details also feed the clinic's messaging and notes systems

*What it decides: The patient's profile.*

> **What we assume.** The clinic keeps a patient's contact details, as in the decisions below.

**23. Profile.** Who should see a patient's photo: the whole clinic team, or only the care team? Should patients see the photos of staff?

*What it decides: Photos.*

> **What we assume.** Staff see patients' photos. Patients do not see staff photos.

**24. Profile.** Who signs letters: doctors only, or also PAs or the clinic as a whole?

*What it decides: Signatures.*

> **What we assume.** Doctors only. A signature is private to that doctor.

**25. Profile.** When should WhatsApp be offered in the notification choices, and what should be on by default for a new account?

*What it decides: Notification choices.*

> **Heard on the call, 6 November.** The clinic wants WhatsApp, through GoHighLevel's automatic WhatsApp, in place of SMS.
>
> **What we assume.** Email and the portal for now. WhatsApp is offered once the GoHighLevel connection is built, and starts off until the patient turns it on.

**26. Accounts.** Should a change of sign-in email by a staff member need a check by the clinic, or is the confirmation by email enough?

*What it decides: Account security.*

> **What we assume.** The email confirmation is enough, and the old address is told.

**27. Access.** Should the admin be able to see everything in the platform, clinical records included, so one person can solve problems across the whole system? Today an admin sees no clinical records: only the team, settings, invitations and logs. Giving full access is a separate change to many rules, so it needs the clinic's decision

*What it decides: The admin's reach.*

> **What we assume.** No, as in question 2.

**28. Accounts.** When a doctor, an admin or a guardian who can act is invited, other admins or PAs get a notice in the portal bell. Is that enough, or should the notice also go by email, or should a second person approve before the invitation is sent? Is the patient's date of birth enough proof that the right person opened the link, or is the ID upload at first sign-in (question 29) the check the clinic wants?

*What it decides: How much checking an invitation gets.*

> **Heard on the call, 6 November.** Not discussed. The ID upload at first sign-in was agreed for patients, which adds a stronger check. Reworded after the call.
>
> **What we assume.** Notices only, and the date of birth. No second approval.

**29. Identity.** Please share the registration and consent forms. Must a PA check the ID before the patient gets in, or does uploading it open the portal? Where should the ID be kept? What happens if a patient cannot upload it? The clinic's registration form in Semble already asks for ID and consent too. Which of the two is the record that counts, and can one of them be dropped? New after the call.

*What it decides: First sign-in.*

> **Heard on the call, 6 November.** Photo ID and a signed consent are a legal requirement, because the clinic prescribes controlled drugs and does not always follow NICE guidelines. Today the patient receives a link in Semble. It was agreed to ask for both at the first sign-in only, so nobody enters the portal without them. The clinic will share the form.
>
> **Seen in the clinic's current plan (patient flow V8 and the emails since).** The registration form in Semble already asks for photo ID, which is mandatory there, and for three consents.
>
> **What we assume.** Uploading the ID and signing the consent open the portal. A PA sees a list of IDs to check. Until the clinic decides, the portal's first sign-in is the check Clinic Hub relies on.

**30. Content.** Which education videos, blogs and newsletters go in the portal first, and who adds them? Which wearables should we list, and does the clinic hold affiliate links? New after the call.

*What it decides: Education and wearables.*

> **Heard on the call, 6 November.** The clinic has a video bank on nutrition, fertility and endometriosis. The wish is a library, plus a personal folder of PDFs and videos a practitioner chooses for each patient. A wearables section would list Oura, Whoop and Garmin, with affiliate links. Wearable data could come in through their APIs.
>
> **What we assume.** This follows the bloods loop and is not in the first release.

**31. Moving over.** What must move from Semble: historical PDFs, notes, contacts? Who in the clinic checks they are accurate? Which weekend suits for training the doctors and admin team? New after the call.

*What it decides: Migration and go-live.*

> **Heard on the call, 6 November.** We need a Semble login to see what its API can export. The change would be best done over a quiet weekend with training in advance, starting from clean data. A Christmas email about prescriptions should go to patients only, so the list needs to come from Semble, not the 1,400 contacts in GoHighLevel.
>
> **What we assume.** Nothing moves until we know what Semble can export.

**32. Notes.** The clinic needs clinical notes locked and versioned once a doctor signs them off, for CQC. Which system holds them, Semble or Clinic Hub? Who may reopen a signed note, and what is kept of each version? New after reading the clinic's plan.

*What it decides: Whether Clinic Hub takes on notes.*

> **What we assume.** Semble keeps the notes, as today. Clinic Hub does not hold them until the clinic decides.

**33. Bloods.** The clinic's current flow gives a patient four choices: the clinic's own lab, TDL, a TDL home kit, or their own results. Only TDL and the home kit are paid through an invoice and get a barcode. Should Clinic Hub follow the same four choices instead of a doctor creating an order? New after reading the clinic's plan.

*What it decides: The ordering flow (flow 3).*

> **What we assume.** Flow 3 stays as written until the clinic confirms. It covers TDL and the home kit, with payment through Stripe.

## Decisions already taken

- Agreed on the call, 6 November: a banner and an email three weeks before a prescription runs out.
- Agreed on the call, 6 November: results from other countries are converted to UK units, from a list of base units the clinic will send.
- Agreed on the call, 6 November: at the first sign-in a patient uploads photo ID and signs the consent form. The clinic will share the form (question 29).
- Agreed on the call, 6 November: questions from patients go to info@theschoemanclinic.com, where staff triage them.
- Agreed on the call, 6 November: reminders go by email and by WhatsApp through GoHighLevel's automatic WhatsApp, in place of SMS.
- The first release is the bloods loop. Messaging, reminders, calendar, invoices and marketing stay in GoHighLevel. Consultation notes stay in Semble. Prescribing goes through SignatureRx.
- Least privilege: admins and health coaches have no clinical access until the clinic decides otherwise.
- A patient sees a result only after a doctor releases it. Safeguarding alerts are for doctors only.
- Sign-in is by email and password. There is no public sign-up.
- Staff sessions end after 12 hours, or 30 minutes idle. Patient sessions end after 7 days, or 2 hours idle.
- Records are archived, never deleted. Accounts are suspended, never removed.
- From the clinic's patient flow: rescheduling and cancelling are done by the team. There is no cancel or reschedule button anywhere. Messages ask the patient to contact the team and refer to the 48-hour policy.
- Every email closes with the clinic's phone, email and WhatsApp. WhatsApp only goes to patients who agreed to it.
- Clinic Hub sends the portal's own emails through Resend. Anything GoHighLevel sends, the clinic's team manage there.
- Sex at birth and gender identity are both kept. Sex at birth decides blood panels and cycle guidance. If it is missing, those steps stop and a PA is told. It is never guessed.
- A nurse role exists. A nurse has no access to patient records until the clinic decides what a nurse may do.
- Opening a patient's report is written to the activity log, and admins read it on the Activity screen.
- Until go-live, the clinic can try the platform with fictional patients and results. Before the clinic goes live, the test data will be cleared once, so the live system holds only real patients and nothing from testing. This is a one-off clean-up, not a way to delete records once the clinic is live.
- Every change to a clinical record is logged with who made it, and the log cannot be edited.
- Two-step sign-in for staff and a robot check are deferred until the clinic has accounts to enrol.
- Page-speed and visit counts use no cookies, and each address is cut to its path before it is sent.

- Everyone can change their own photo, name, phone, notification choices, password and sign-in email. The clinic keeps roles, account status, the clinical record and a patient's contact details.
- Changing a password needs the current one and signs out other devices. Changing the sign-in email needs the password and a confirmation link, and the old address is told.
- For now, notification choices cover email and the portal only. WhatsApp and SMS wait for the messaging connection.
- A doctor's signature is private to that doctor. Letters read it on the server.
- Invitations: PAs invite patients and guardians, admins invite anyone, and nobody else invites. A link works for 3 days. Doctors and admins can be invited without a second approval, and everything is logged.
- Patient and guardian invitations ask for the patient's date of birth when accepted. Five wrong dates cancel the link and tell the sender.
- A patient invitation should go to the address in the patient's record. If it is different, the sender sees a warning and has to confirm.
- Other admins are told when a doctor or admin is invited, and other PAs when a guardian who can act is invited. These are notices only, not approvals (see question 28).
- Someone who already has an account accepts an invitation by signing in. The new access is added to that account, and the person always has to press accept.
- Admins see every invitation and the names of patients for the invitation form, but still no clinical records. Giving admins full access is a question for the clinic.