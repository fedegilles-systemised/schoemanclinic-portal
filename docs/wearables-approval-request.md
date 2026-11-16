# Wearables: approval request for Oura and WHOOP (draft)

A starting text for The Schoeman Clinic to send to Oura and WHOOP when asking to connect more than 10 patients. Everything in `[square brackets]` is for the clinic to complete. The exact form each company uses was not seen when this was written, so adapt the text to the fields they ask for.

This is not one of the four living documents and no subagent keeps it. Update it by hand if the wearable connection changes (see `docs/CONTEXT.md`, section on wearables).

## Before sending

- The privacy policy page named below must cover wearable data. The policy on the clinic's website may not mention it yet. Both companies are likely to ask for it.
- Point 7 must be true. Oura's developer terms are reported to forbid sending its data to AI models. If the clinic plans to use AI on these figures, do not claim this without reading the terms.
- WHOOP asks for a working integration tested with at least one member. Test with real credentials first (connect, wait for the daily read, disconnect), and say so in point 9.
- Point 6 (retention) is still a clinic decision. See `docs/SECURITY.md`, finding S-214.
- Register the apps under a clinic-owned email address, kept in the clinic's password manager. An app cannot easily be moved to another account.
- Each company's callback address to register is `https://<domain>/api/wearables/oura/callback` and `https://<domain>/api/wearables/whoop/callback`. Add the new domain's address when the domain changes.

## Text to send

**Subject:** Approval request for Clinic Hub (The Schoeman Clinic)

**Application name:** Clinic Hub
**Organisation:** The Schoeman Clinic, [registered company name and number]
**Address:** [clinic address], London, UK
**Website:** https://theschoemanclinic.com
**Contact:** [name, role], [email], [phone]
**Data protection contact:** [name or DPO], [email]
**ICO registration number:** [number]
**Privacy policy:** [link to the page that covers wearable data]

### 1. What the application does

Clinic Hub is the patient portal of The Schoeman Clinic, a private clinic in London specialising in hormone, longevity and functional medicine. Patients can connect their own [Oura / WHOOP] account so that their daily figures appear on their clinic record. Their care team uses these figures to understand how they are responding to treatment between appointments.

### 2. Who uses it

Patients of the clinic, or a guardian acting for a patient with the clinic's verification. Only the connected patient's own data is read. Their treating clinicians can see it. It is not offered to the public or to other organisations.

### 3. Data we access, and why

- **Oura:** daily sleep score, sleep duration, readiness, resting heart rate, heart rate variability, steps, active minutes, blood oxygen, temperature deviation and VO2 max. Scopes requested: `daily`, `spo2Daily`.
- **WHOOP:** recovery score, resting heart rate, heart rate variability, blood oxygen, sleep duration and sleep performance. Scopes requested: `offline`, `read:recovery`, `read:sleep`.

We request only what is needed for the figures above, and no personal profile details.

### 4. How the patient agrees

Before connecting, the patient reads what is shared and gives a recorded consent in the portal ("Connecting my wearables"). They then sign in to [Oura / WHOOP] and allow access themselves. They can disconnect at any time in the portal, and withdrawing consent disconnects every wearable.

### 5. How we store and protect the data

Access tokens are encrypted before they are stored. Data is held in [hosting provider and region, for example a UK or EU data centre]. Access is limited to the patient, their guardian where applicable, and clinic staff on the patient's care team. Every change to a record is logged.

### 6. Retention and deletion

[Clinic to confirm: how long readings are kept, and what happens when a patient asks for them to be removed.] When a patient disconnects, the stored access is removed and we stop reading new data.

### 7. What we do not do

We do not sell or license the data. We do not use it for advertising. We do not share it with third parties. We do not use it to train or prompt any AI model. [Clinic to confirm each statement is true.]

### 8. Expected number of users

About [number] patients in the first [period], growing to about [number].

### 9. Testing done

The integration has been tested with [number] real accounts. [Add what was tested: connecting, reading daily figures, disconnecting.]
