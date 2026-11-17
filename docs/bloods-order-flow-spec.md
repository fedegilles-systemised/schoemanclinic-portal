# Bloods order flow: specification (draft)

Status: draft, written 17 November 2026 from the clinic's call recording (George and Gina, 17 November), the clinic's current Semble process and the existing schema. Nothing here is built. Items marked **Open** wait for answers from the clinic or from TDL.

This is not one of the four living documents and no subagent keeps it. When a slice is built, record it in `docs/CONTEXT.md` and `content/knowledge-base.md` (flow 3) and trim it here.

## 1. Goal

Replace the Semble bloods process with Clinic Hub, end to end: a doctor or PA orders a panel, the patient pays, the right request form and barcode are released only after payment, the sample is taken, results come back against the same order, and a doctor reviews and releases them (flows 4 to 6 already exist).

## 2. How it works today in Semble (seen in the recording)

- Semble produces a one-page **electronic request** for TDL: order number (10 characters, Code 39 barcode), lab TDL, requesting doctor, source SCHOEMAN, patient title, surname, forename, sex, date of birth, tests (for example GS5), clinical notes, fasting Y/N, sample date, signature and date.
- The panel is a Semble product, for example "GS5 (GS5 by TDL)". The consultation's free notes carry the product, sample date, fasting box and comments (preparation, lab location).
- The invoice has two lines: the **blood-taking fee** (£45 at a TDL site; £15 administration for a home kit) and the panel.
- **Home kit** is different: the team fills in TDL's own editable two-page request form by hand and emails it to TDL, listing the tubes (for GS5: 1 purple, 2 gold, 1 grey).

## 3. Routes and fees

The patient chooses one route (knowledge base decision, 12 November 2026). Only the first two are paid through Stripe and get a barcode.

| Route | Sample taken | Fee besides the panel | Request form |
|---|---|---|---|
| TDL site | At a TDL collection point | £45 blood-taking fee | Electronic request with barcode |
| TDL home kit | By the patient or a visiting nurse, kit posted | £15 administration | TDL's home-kit form, sent by Clinic Hub to TDL |
| Clinic's own lab | At the clinic (not live yet) | None through Stripe; patient pays the lab | None |
| Own results | Elsewhere | None | None; the patient uploads a PDF (flow 5) |

**Open:** whether the £45 and £15 are fixed or vary by site; whether the invoice shows one total or two lines; who pays TDL (clinic invoiced, or the patient direct).

## 4. Order states

Existing `order_status`: `sent_to_patient`, `paid`, `sample_taken`, `results_in`, `reviewed`, `cancelled`.

1. **Ordered** (`sent_to_patient`). Doctor or PA picks patient, panel and route. Due date is the appointment minus 14 days. Price is the panel price plus the route's fee, frozen on the order.
2. **Paid** (`paid`). Stripe confirms. Barcode and request form are released only now. Nothing goes to TDL before this.
3. **Sample taken** (`sample_taken`). Recorded by the lab feed, or by a PA if the patient says it is done.
4. **Results in** (`results_in`). A report arrives (feed or PDF import) and is matched to the order by barcode, otherwise by surname and date of birth, otherwise it goes to a PA.
5. **Reviewed** (`reviewed`). A doctor signs it off.
6. **Cancelled** (`cancelled`). Only by a PA or doctor. A refund is made in Stripe for now.

## 5. What we can build now

**A. Panel catalogue.** `lab_panels` already holds code, name, price, fasting and preparation. Add: collection tubes (colour and count), the route fees, sex restriction (GS5 female, GS10 male, GS11 male), and the preparation text for each panel. Staff edit the catalogue in the clinic portal; the seed holds fictional panels only.

**B. Ordering screen (clinic).** From a patient's record: choose panel and route, see price with fees, confirm. Checks: sex at birth present (else stop and tell a PA); panel allowed for that sex; appointment present for the due date. For a patient with regular periods the cycle-day-21 guidance is shown (flow 3).

**C. Patient screen.** "Bloods due" banner, order page with preparation steps and the fasting rule, pay with Stripe. After payment: barcode and request form; for a home kit, the tube list and the address.

**D. Request form with barcode.** Clinic Hub produces a PDF in the layout TDL accepts, with the order number as a Code 39 barcode. **Open:** TDL must confirm it will accept an order number made by Clinic Hub; until then the form is generated as a draft and not sent.

**E. Home-kit email to TDL.** On payment, an email to TDL with the filled-in form (patient details, tubes, sample date) so nobody types it by hand. **Open:** the address and the format TDL accepts.

**F. Reminders and chasing.** Reminder before the due date and a chase for an unpaid order, through GoHighLevel, following the patient's contact preferences. **Open:** how long an unpaid order stays open.

**G. Results matched to the order.** Barcode first, then surname and date of birth, else a PA. A completeness check compares the markers returned with the panel ordered and tells a PA when something is missing.

## 6. What is blocked on TDL

How TDL receives an electronic order from a third party, and how it returns results. It may be an API, a standard laboratory message format (HL7), a portal or email. Until we know, sections D and E stay as drafts and results keep arriving by PDF import (flow 5) or the existing lab webhook.

## 7. Data changes (proposed)

- `lab_panels`: add `tubes` (jsonb list of colour and count), `sex_restriction`, `route_fee_site_pence`, `route_fee_kit_pence` (or a separate `lab_panel_routes` table; decide when building).
- `lab_orders`: add `route` (enum: `tdl_site`, `tdl_kit`), `fee_pence`, `sample_date`, `fasting`, `clinical_notes`, `request_form_document_id`, `sent_to_lab_at`.
- Barcode written by server code only, after payment, as today (`private.reject_client_changes` already protects it).
- No cascade deletes; orders are cancelled, never deleted.

## 8. Build order

1. Catalogue and migration for the extra fields (A, section 7).
2. Ordering screen and patient order page with Stripe payment (B, C). Stripe code exists for repeat-request fees.
3. Request form PDF and barcode, behind a switch (D).
4. Home-kit email (E).
5. Reminders (F) and results completeness (G).

Each slice goes through the security reviewer, as migrations and server actions are involved.

## 9. Information still needed

1. From the clinic (Gina or Louise): the "Complete TDL Blood Tests" document and the internal spreadsheet: panels, tubes, sex rules, preparation.
2. From TDL (through George): how third parties send electronic orders, whether our order number and barcode scheme are accepted, how results come back, and how the home-kit form should be sent.
3. From the clinic: who creates the order today, who fills the home-kit form, and the fee questions in section 3.
