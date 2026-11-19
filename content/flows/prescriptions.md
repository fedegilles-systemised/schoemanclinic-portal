## What it does

Repeat prescriptions replace the clinic's Typeform. A patient (or a guardian who can act) asks for up to ten medicines at a time, pays the £30 administration fee, and the team approves, declines or sends the request on. Prescribing itself is done in SignatureRx, where the doctor signs with a PIN. That connection is built and switched off until SignatureRx's questions are answered.

## How it works

1. **Request.** The patient opens **Prescriptions** and starts a request. They choose up to ten medicines: their current medicines, the clinic's list, or one typed in. Each is for one or two months' supply.
2. **Appointment question.** The portal says whether a future appointment is booked. With none, it asks whether they would like to book. It does not block the request.
3. **Weight-loss medicines.** For Mounjaro, Ozempic, Wegovy or semaglutide they say whether they are still losing weight, how much in the last month, and whether they have side effects.
4. **Pay.** They review the request and pay the £30 fee on Stripe's own page. Stripe is told only the amount and the request's reference, never a name or a medicine.
5. **The team is told.** Admins, PAs and the patient's doctors see it in Clinic Hub, the clinic inbox is emailed, and the patient gets a receipt.
6. **Decision.** A doctor or PA approves, declines (with a reason the patient reads in the portal) or marks it sent to the pharmacy after prescribing in SignatureRx. The patient is told at each step, without the note or any medicine named.
7. **Refund.** An admin can refund the whole fee of a declined request, and the patient is told. A refund made in Stripe's dashboard is recorded too.
8. **Running out.** Doctors record each medicine on the patient's record, with the day a supply starts and how long it lasts. Patients are reminded three weeks before it runs out, on the home screen, on the Prescriptions page and by a daily email or WhatsApp, unless a repeat is already on its way.

Admins and doctors keep the clinic's medicine list under **Prescriptions**, then **Medicines**.

## How to try it

Use a fictional patient and the Stripe test keys.

1. As the patient, open **Prescriptions** and make a request for a made-up medicine. Pay with Stripe's test card 4242 4242 4242 4242.
2. As a PA or doctor, open **Prescriptions**. The request is there. Open it and approve it.
3. Make a second request and decline it with a reason. As an admin, refund its fee.
4. As the patient, check that the reason shows in the portal and the email names no medicine.
5. On a patient's record, add a medicine with a supply of a few days to see the reminder appear.

**What you should see:** an unpaid request can be withdrawn, and every message to the patient says nothing about the medicine.

## Not built yet

- Sending a prescription to SignatureRx. It is built and off until SignatureRx's questions are answered (see the Roadmap).

## To confirm

- Should "no future appointment" block a request rather than warn?
- Could an approved repeat go to the pharmacy automatically?
