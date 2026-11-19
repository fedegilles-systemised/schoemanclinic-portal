## At a glance

Updated 19 November 2026. This page says where Clinic Hub stands, what we assumed and need you to confirm, what is holding us back, and exactly what clears each thing. It lists only what needs the clinic. Where something needs an email, a base email is at the end, ready to copy.

| Stage | Where it stands |
| --- | --- |
| The bloods loop: order, payment, barcode, results, review, release, trend | **Built.** Sending orders to TDL and matching its results wait on TDL |
| Patient care and the clinic's daily tools | **Built** |
| Booking and the diary | **Built** |
| Registration of new patients | **Built** (19 November) |
| Repeat prescriptions and SignatureRx | **Built.** SignatureRx is switched off until its questions are answered |
| Wearables and call recording | **Built.** Waiting on approvals in the clinic's name |
| Items from Dr Schoeman's list of 19 November | **Agreed.** Listed below, to build |
| Moving over from Semble | **Agreed scope.** Starts once the clinic is ready to switch |
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
- Calls can be recorded and transcribed. The transcript arrives on the patient's record as a draft note to check and sign. Both are built and waiting on approvals.

### Messages and safety

- Patient messages go by email and, where the patient agrees, WhatsApp, through GoHighLevel.
- Access rules are enforced in the database itself, not only on screen, and every change is security-reviewed.

## What we assumed, and need you to confirm

We made these choices to keep moving. Each is built as described. If one is wrong, tell us and we change it. If you say nothing, we treat it as agreed.

| What we assumed | What is built | Who confirms |
| --- | --- | --- |
| The photo ID in the registration form is kept for good | Stored privately, opened only by PAs and admins, every opening logged | The clinic, in writing: a retention period, or "for good" |
| The registration form is for new patients only | Existing patients, and those who come from Semble, are not asked | The clinic |
| The registration answers stay on the record and are not copied into a note | A permanent copy of the form, and a Registration section | The clinic |
| Children and patients a guardian manages are not asked to register yet | They skip the form | The clinic: who completes it for a child |
| The links and titles for the Privacy Notice and the Terms of Treatment and Fees | The registration form links to the clinic's pages | The clinic: the final links and titles |
| A patient who declines news and insights is not told to GoHighLevel | Kept on the record only | The clinic |
| Only an admin refunds, and always the whole payment | Blood tests while paid or sampled, and the fee of a declined repeat | The clinic |
| An unpaid order is chased after 3 and 7 days and closes after 30 | Built | The clinic |
| The notes on a blood test order are for the team only | Hidden from patients | The clinic |
| Online booking offers the initial consultation only, with no deposit | Built; an admin can change which types are offered | The clinic |
| Only a doctor releases a result, one doctor is enough, and no marker is held back | Built | The clinic |
| Feedback bands: 9 to 10 green, 7 to 8 amber, 0 to 6 red | Built | The clinic |
| What moves over from Semble: contacts, appointments, notes, documents and lists | Not started | The clinic |
| Lab files nobody matched are cleared after 30 days | Built | The clinic |
| The audio and the transcript of a recorded call are kept, with no end date | Kept in the clinic's private store | The clinic: a retention period |
| A patient's opening of a document or a result is not recorded; only the sharing and the release are | Dates and people are kept | The clinic: is that enough as proof of sending? |

## What is still to do

### Agreed on 19 November, to build

| What | What it does | Waiting for |
| --- | --- | --- |
| Conversations | Shows the WhatsApp, text and email conversations from GoHighLevel inside Clinic Hub, so the team works in one place | The phone system added in GoHighLevel (see below) |
| Clinical enquiries into notes | Adds a patient's clinical message to their notes | Conversations |
| Cancellation policy and charging | Shows the 48-hour policy where patients book and are reminded; saves the card in Stripe; lets the team charge a late cancellation or no-show in full from the patient's record after the appointment | The clinic's fee for each appointment type, and the wording of the policy |
| Reminders before an appointment | For patients who need bloods: reminders at 6, 4, 2 and 1 weeks and 3 days before, with the times adjustable by the clinic | Which appointment types need bloods |
| Electronic signature | A form or PDF the patient signs in Clinic Hub, in place of DocuSign | The documents that need signing |
| A record of what was sent | A timeline on each patient of every message and document, when it was sent and delivered | Nothing |
| Outstanding results | A clear indicator on the record of results still awaited | The clinic's choice for the other labs (see below) |

### To build once the blockers are cleared

| What | Waiting for |
| --- | --- |
| Send the electronic order, or the home-kit request, to TDL | TDL's answer on how it takes orders |
| The request form as a printable PDF with the barcode | TDL accepting our barcode and layout |
| Match a lab's results to the order by its barcode, and check nothing is missing | TDL returning results with our barcode |
| Bring over patients already in Semble | The clinic deciding when to switch |
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
- Asking questions of a patient's file with an AI assistant. It is not agreed, and needs a decision on data protection first.

## What is blocking us

Each row says what it holds up, what has to happen, and what you do to clear it. The letters point to the base emails at the end.

| What we need | What it holds up | What has to happen | What you do | Email |
| --- | --- | --- | --- | --- |
| How a third party sends TDL an electronic order: an API, a standard laboratory message, a portal or email | Sending orders to TDL, and the request form | TDL gives its integration documents or a technical contact | Email TDL, because only the clinic's account holder can ask TDL for them | A |
| Whether TDL accepts the barcode Clinic Hub makes (SCH- and a number, Code 39) | The barcode on the request form, matching results | TDL confirms in writing, or says what format it needs | Email TDL | A |
| How results come back, and whether they carry our barcode | Matching results to the order, the completeness check | TDL sends a sample result with an order reference | Email TDL | A |
| How the home-kit request is sent: the address and the format | The home-kit request | TDL gives the address and the format | Email TDL | A |
| SignatureRx: the data processing agreement, each doctor's integration code, whether the PIN is needed for a draft, which events it can notify us about, the cost per prescription and who tops up the balance, and the live credentials | Sending prescriptions from Clinic Hub | SignatureRx answers; the clinic signs the agreement | Email SignatureRx and sign the agreement, because the account and the agreement are the clinic's | B |
| The clinic's panel list: code, name, price, fasting, tubes, who each is for and the preparation | Real ordering | The list reaches us in a spreadsheet | Reply to us with the "Complete TDL Blood Tests" document or the internal spreadsheet | C |
| The clinic's Google review link | The review link offered after positive feedback | The link reaches us | Reply with the link | C |
| The answers to the registration and the assumptions above | Treating them as final | The clinic reads the table above and replies | Reply with a yes, or the changes | C |
| The fee for each appointment type, and the wording of the cancellation policy | Charging a late cancellation | The fee list and the wording reach us | Reply with both. The wording may be worth a legal check, because it is a charge to a patient | C |
| Which appointment types need bloods before the visit | Reminders before an appointment | The list reaches us | Reply with the list | C |
| Which documents need a patient's signature | The electronic signature | The documents reach us | Reply with the documents | C |
| The clinic's choice for GutMap, Nordic and Regenerus: ordered and paid in Clinic Hub, or only recorded as awaited | Showing outstanding results | The clinic chooses | Reply with the choice | C |
| A phone system with a regulatory bundle in GoHighLevel | Conversations, and the text sent back after a missed call | The clinic adds the bundle | In GoHighLevel, open Settings, then Phone system, then Regulatory bundle, and add a bundle. The clinic holds the account | D |
| AssemblyAI: the data processing agreement | Call recording and transcription | The agreement is signed | Ask AssemblyAI for its data processing agreement, sign it as the clinic (the data controller) and tell us it is done | E |
| Oura and WHOOP: an approved developer app for each | Wearables | Each app is approved | Register a developer app with each provider, in the clinic's name, and send us the keys. Only the clinic can, because each provider approves an organisation | F |
| How long the photo ID, call audio and transcripts are kept | Data protection records | A period is decided in writing | Decide and reply | C |
| Login for the platform | Reading and trying everything | A new password | Use "Forgot password" on the sign-in page | G |

## Base emails

Copy each, add the missing details in square brackets, and send it from the clinic's address.

### A. To TDL, about orders and results

**To:** the clinic's account contact at TDL, or their technical contact.

**Why you send it:** the clinic holds the account with TDL, and TDL will only share integration details with its customer.

> Subject: Electronic orders and results for The Schoeman Clinic
>
> Hello [name],
>
> We are setting up a patient portal, Clinic Hub, to order TDL tests and receive results. Could you tell us:
>
> 1. How a system sends you an order electronically: an API, a standard laboratory message, a portal or email? Please send the integration documents or put us in touch with your technical contact.
> 2. Whether you accept our barcode. Each order carries a code such as SCH-000123, printed as Code 39. If you need another format, tell us which.
> 3. How results come back, and whether they carry that barcode or another order reference. A sample result would help.
> 4. For home kits: the address and format for the request.
>
> Please reply to me, with [builder's email] in copy.
>
> Thank you,
> [Name], The Schoeman Clinic

### B. To SignatureRx

**To:** your SignatureRx account manager, or their support address.

**Why you send it:** the account, the agreement and each doctor's code belong to the clinic.

> Subject: Connecting Clinic Hub to SignatureRx
>
> Hello [name],
>
> We are connecting our portal to SignatureRx so that a doctor can create a prescription from an approved repeat request. Please could you tell us:
>
> 1. Do you have a data processing agreement for us to sign? Please send it.
> 2. How does each doctor get their integration code?
> 3. Can a prescription be saved as a draft without the doctor's signing PIN?
> 4. Which events can you notify us about when a prescription changes?
> 5. What does each prescription cost, and who tops up the balance?
> 6. Please send the live credentials once the agreement is signed.
>
> Thank you,
> [Name], The Schoeman Clinic

### C. Reply to us, with the clinic's answers

**To:** the person building Clinic Hub (we will give you the address).

**Why you send it:** the answers are the clinic's own decisions, and no one else can give them.

> Subject: Clinic Hub: our answers
>
> Hello,
>
> Here are our answers.
>
> 1. Panels: attached is [the "Complete TDL Blood Tests" document or spreadsheet].
> 2. Google review link: [link].
> 3. Photo ID, call audio and transcripts are kept for [period / for good].
> 4. Registration: for a child or a managed patient, [who completes it]. The final links are [Privacy Notice link] and [Terms link].
> 5. Cancellation: the fee is [£] for [appointment type]. The policy wording is [text].
> 6. Appointment types that need bloods before the visit: [list].
> 7. Documents that need a signature: [list].
> 8. For GutMap, Nordic and Regenerus: [ordered and paid in Clinic Hub / recorded as awaited].
> 9. The assumptions table: we agree with all of them, except [list].
>
> [Name]

### D. In GoHighLevel, not an email

Open **Settings**, then **Phone system**, then **Regulatory bundle**, and add a bundle for the clinic. It is needed for the phone system, for texts sent back after a missed call and for Conversations in Clinic Hub. Tell us when it is done.

### E. AssemblyAI's data processing agreement

Ask AssemblyAI, through its support or your account, for its data processing agreement. Read it, sign it as the clinic, and tell us it is done. Recording is switched on after that.

### F. Oura and WHOOP

Each provider asks an organisation to register an application. Register one in the clinic's name with each, and send us the keys they give you. We then connect them.

### G. Your login

Open the sign-in page and choose **Forgot password**. A link arrives at your address.
