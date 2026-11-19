## At a glance

Updated 19 November 2026. This page says where Clinic Hub stands: what is built, what is still to do, and what is holding us back, with what would unblock each thing and who it depends on. It is written for the clinic. It leaves out tasks that are only ours to do.

| Stage | Where it stands |
| --- | --- |
| The bloods loop: order, payment, barcode, results, review, release, trend | **Built.** The parts that talk to the lab wait on TDL |
| Patient care and the clinic's daily tools | **Built** |
| Booking and the diary | **Built** |
| Registration of new patients | **Built** (19 November) |
| Repeat prescriptions and SignatureRx | **Built.** SignatureRx is switched off until its questions are answered |
| Wearables and call recording | **Built.** Waiting on outside approvals |
| Moving over from Semble | **Not started.** Waiting on the clinic's list of what moves |
| Going live | **To plan** once the blockers below are cleared |

## What we have done

### Accounts and access

- Sign-in by invitation only, with roles for patients, guardians, doctors, nurses, health coaches, PAs and admins.
- Access follows each patient's care team: a doctor, nurse or health coach sees the patients they look after; PAs and admins see everyone.
- Profile and sign-in settings for everyone, and the team invitations list.
- A permanent activity log of who opened or changed a patient's record.

### Registration of new patients

- The clinic's own registration form, recreated from Semble. Every patient added from now on completes it once, before they can use the portal.
- It collects their details, next of kin, GP, why they are coming, their health goals, a photo ID and their consent.
- The answers stay on the record and as a permanent copy of the form. Only PAs and admins can open the photo ID, every opening is logged, and a PA or admin marks it as checked.

### Blood tests

- A doctor or PA orders a panel, at a TDL collection point or as a home kit. Only panels allowed for the patient's sex at birth are offered.
- The patient pays through Stripe and then gets a barcode. There is no barcode before payment.
- An unpaid order gets a reminder after 3 days and after 7, and closes by itself after 30.
- An admin can refund a paid order in full. A refund made in Stripe itself is also recorded.
- The panel list and the two route fees are kept in Clinic Hub, and a whole list can be loaded from a spreadsheet.
- Results arrive by hand entry, by a PDF import or by a lab posting a report. A PA checks them, a doctor reviews and releases them with a sign-off, and the patient sees the values and how they have changed over time. A patient never sees a result before release.

### Care of the patient

- Clinical notes, final once signed, with the treatment options discussed.
- Allergies, diagnoses, medicines and safeguarding alerts, with safeguarding for doctors only.
- Letters and documents shared with the patient, and a place for the patient to ask the clinic a question.
- Every form a patient sends is kept on their record as asked and answered.

### Booking and the diary

- Patients book with their care team. New patients book online from a public page.
- The diary shows each person what they should see, and each clinician's Google Calendar receives the bookings.
- A doctor or PA marks a visit as a no-show, and a wrong mark can be put right.
- A new record made by an online booking that looks like someone already on the books is flagged to the team, and nobody is merged automatically.
- A new patient who booked online and has not been checked after two working days is reminded to the team.

### Prescriptions

- Repeat requests replace the clinic's Typeform: up to ten medicines at a time, with the £30 fee through Stripe.
- A doctor or PA approves, declines or sends the request on. An admin can refund the fee of a declined request.
- The connection to SignatureRx for sending a prescription is built and switched off.

### Education, feedback and the CQC

- Courses and lessons for patients, built by the clinic.
- Feedback after each appointment, with green, amber and red routing and a recorded follow-up.
- Every results sign-off is listed for admins, to show an inspector.

### Wearables and call recording

- Oura and WHOOP can be connected by a patient who consents, and their readings show on the record.
- Calls can be recorded and transcribed. Both are built and waiting on outside approvals.

### Messages and safety

- Patient messages go by email and, where the patient agrees, WhatsApp, through GoHighLevel.
- Access rules are enforced in the database itself, not only on screen, and every change is security-reviewed.

## What is still to do

### To build once the blockers are cleared

| What | Waiting for |
| --- | --- |
| Send the electronic order, or the home-kit request, to TDL | TDL's answer on how it takes orders |
| The request form as a printable PDF with the barcode | TDL accepting our barcode and layout |
| Match a lab's results to the order by its barcode, and check nothing is missing | TDL returning results with our barcode |
| Bring over patients already in Semble, with their details | The clinic's list of what moves, and a check of what Semble can export |
| Send a prescription from Clinic Hub to SignatureRx | SignatureRx's answers and live credentials |

### To do before going live

- Load the clinic's real list of panels, prices, tubes and preparation.
- Run the whole bloods loop with test payments, from order to released result, with the clinic's own team.
- Clear the test data, so that only real patients remain.
- Train the doctors and the administration team, and agree a quiet weekend for the switch.
- Make the final security check before real patients use it.

### Left for later, on purpose

- Letting a patient upload their own lab results as PDFs for a PA to check. The screen is in the menu and switched off.
- Registration for children and for patients a guardian manages.
- A screen to merge duplicate records (today the team decides and archives the extra one).
- A dark theme. Clinic Hub is light only.
- Refunds of part of a payment, or of a blood test once results are in, inside Clinic Hub. These are decided in Stripe.
- Telling GoHighLevel when a patient asks not to receive news from the doctors.

## What is blocking us

Each row says what it holds up, how to clear it and who it depends on.

### Waiting on TDL

| What we need | What it holds up | How to clear it | Who it depends on |
| --- | --- | --- | --- |
| How a third party sends TDL an electronic order: an API, a standard laboratory message, a portal or email | Sending orders to TDL, the request-form PDF | Ask TDL for its integration documents or a technical contact | TDL, through George |
| Whether TDL accepts the barcode Clinic Hub makes (SCH- and a number, Code 39) | The barcode on the request form, matching results | Send TDL the format and ask for confirmation in writing, or for the format it requires | TDL, through George |
| How results come back, and whether they carry our barcode | Matching results to the order, the completeness check | Ask TDL for a sample result with an order reference | TDL, through George |
| How the home-kit request is sent: the address and the format | The home-kit request | Ask TDL for the address and the format it accepts | TDL, through George |
| Whether the £45 site fee and the £15 kit fee are fixed, and who pays TDL | Confirmed prices and the invoice | Ask TDL for its price list and how it bills | TDL, through George |

### Waiting on the clinic

| What we need | What it holds up | How to clear it | Who it depends on |
| --- | --- | --- | --- |
| The real list of panels: code, name, price, fasting, tubes, who each is for and the preparation | Real ordering | Send the "Complete TDL Blood Tests" document or the internal spreadsheet; it loads in minutes | Gina or Louise |
| The markers the clinic tests, their base units and ranges in UK units | How results are converted and shown | Send the clinic's list of markers, units and ranges | Gina or Louise |
| What moves over from Semble, and when | The Semble move, the go-live date | List what moves: historical PDFs, notes, contacts, appointments; then check what Semble can export | The clinic, with Semble |
| The clinic's answers on the registration form: who completes it for a child, how existing patients are handled, whether the answers should also become a note, and the final links and titles | Registration for children and for imported patients | Review question 35 in "How it works" and answer it | The clinic |
| How long the photo ID is kept | Data protection records | Decide a period in writing, or confirm it is kept for good | The clinic |
| The clinic's Google review link | The review link offered after positive feedback | Share the link | The clinic, through George |
| The clinic's agreement to the decisions of 18 and 19 November | Treating them as final | Read the lists in "How it works", under Decisions already taken, and say what to change | The clinic, through George |

### Waiting on others

| What we need | What it holds up | How to clear it | Who it depends on |
| --- | --- | --- | --- |
| SignatureRx: the data processing agreement, each doctor's integration code, whether the PIN is needed for a draft, which events it can notify us about, the cost per prescription and who tops up the balance, and the live credentials | Sending prescriptions from Clinic Hub | Ask SignatureRx for each answer; the clinic signs the agreement | SignatureRx and the clinic's owner |
| AssemblyAI: the data processing agreement | Call recording and transcription | Sign the agreement before recording is switched on | George, for the clinic |
| Oura and WHOOP: an approved developer app for each | Wearables | Register an app with each and wait for approval | George, for the clinic |
