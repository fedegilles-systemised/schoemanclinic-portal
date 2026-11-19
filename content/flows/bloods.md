## What it does

A doctor or PA orders a blood test panel for a patient, at a TDL collection point or as a TDL home kit. The patient pays through Stripe and then receives a barcode. There is no barcode before payment. The order then follows the sample: taken, results in, reviewed.

Prices are the panel price plus the fee for the route chosen: £45 at a TDL site and £15 for a home kit, both confirmed. Only panels allowed for the patient's sex at birth are offered, and if sex at birth is missing the order stops and a PA is told.

## How it works

1. **Order.** From a patient's record, a doctor or PA chooses the panel, the route and the appointment the bloods are for. The due date is 14 days before it. Notes for the lab can be added; only the team reads them.
2. **Tell the patient.** The patient is told by email, and by WhatsApp if they have it on. The message does not name the panel. The portal shows a "bloods due" banner and the order, with the due date, whether to fast and how to prepare.
3. **Pay.** The patient pays on Stripe's own page. The clinic never holds card details.
4. **Barcode.** Stripe confirms the payment. The order becomes paid, gets its barcode and the patient gets a receipt.
5. **Chase.** An unpaid order gets a reminder after 3 days and another after 7. After 30 days it closes by itself: it is cancelled, kept on the record, and the patient is told.
6. **Sample.** When the sample has been taken, a PA or doctor records it and the order becomes "sample taken".
7. **Refund.** Only an admin refunds, and always the whole payment, while the order is paid or the sample is taken. The patient is told. A refund made in Stripe's own dashboard is recorded here too. A part refund, or a refund once results are in, is decided in Stripe.
8. **Results.** When results arrive the order becomes "results in", then "reviewed" after the doctor's review (see the results guide).

For a patient whose sex at birth is female, a regular cycle means the sample is taken on day 21, and an irregular cycle or none means any day.

## How to try it

Use a fictional patient, and the Stripe test keys.

1. As a PA, open the patient's record and choose **Order bloods**. Pick a panel, the TDL site route and the appointment.
2. Open **Lab orders** in the menu. The new order shows as sent to the patient.
3. Sign in as the patient. Open **Lab orders** and pay with Stripe's test card 4242 4242 4242 4242, any future date and any code.
4. The order shows as paid with its barcode.
5. As a PA, record the sample as taken.
6. As an admin, refund an order from **Lab orders** and see that the order stays on the record as cancelled and refunded.

**What you should see:** no barcode before payment, an email that does not name the panel, and the patient's notes field never showing the team's notes.

## Not built yet

These wait for TDL's answer on how it takes orders (see the Roadmap):

- Sending the electronic order, or the home-kit request, to TDL.
- The request form as a printable PDF with the barcode.
- Matching a lab's results to the order by its barcode, and checking that nothing is missing.
- Ordering for the other labs (GutMap, Nordic, Regenerus). Their results arrive as PDFs today.

## To confirm

- Is the order and payment wording right for your patients?
- Which labs, besides TDL, should be ordered and paid through Clinic Hub rather than arriving as PDFs?
