## What you are testing

> **Test with fictional data.** You can try everything here with made-up patients and values. Before the clinic goes live, the test data will be cleared from the database, so that only real patients remain and nothing old is left behind.
>
> Until then, never enter test values against a real patient. Releasing a result emails the patient, and a released report cannot yet be withdrawn or corrected.

The bloods loop from the clinic's side: a PA enters a lab report, a doctor reviews it and releases it, and the patient sees the values and how they have changed over time.

Three people take part, so you need three sign-ins, or three people. The PA enters, the doctor releases, and a patient looks. One person can do all three by signing out between steps.

> **Why a doctor releases.** A patient never sees a value before a doctor has looked at it. This is enforced in the database, not only on screen, so it holds even if the page is changed. Only doctors can release.

## Before you start

- **Use a test patient.** Use a fictional person with an account, never a real patient. An admin or a PA can invite one from Team and settings. The patient accepts the invitation and signs in once.
- **Use an email address you can open.** The patient gets an email when the result is released, so the test patient's address must be one you can read.
- **Know the three roles.** PA: enters results. Doctor: comments and releases. Patient: sees released results only.

## Step 1. A PA enters the results

1. Sign in as a PA and open **Results review** in the menu.
2. Choose **Add results**.
3. Choose the test patient, the sample date (today or earlier) and the lab name.
4. Add rows. For each row choose the marker, type the value and choose the unit shown on the lab's report.
5. For a first check, add **Total testosterone** with **400 ng/dL**. Add one or two more markers, one of them clearly outside its range.
6. Optionally attach the lab's PDF. It is kept with the report.
7. Save.

**What you should see**
- The report appears under **To review** with the status **Awaiting review**.
- Testosterone is shown as **13.868 nmol/L**, the clinic's UK unit. The original 400 ng/dL is kept next to it.
- Each value has a status: low, high, borderline (inside the range but within 5% of an edge) or in range.
- The patient cannot see anything yet.

## Step 2. A doctor reviews and releases

1. Sign in as a doctor and open **Results review**.
2. Open the new report from **To review**.
3. Check the values, the flags and the attached file, if there is one.
4. Write a short comment on any marker that needs one, then choose **Save comments**.
5. Choose **Release to the patient**. You can add a note for the patient first.

**What you should see**
- A message that the report has been released.
- The report moves from **To review** to **Released**.
- If the patient has switched results emails off in their profile, or has no account, the message says so. The release still stands.

## Step 3. The patient sees the results

1. Open the email sent to the test patient. Its subject is "A new result is ready in your portal".
2. Sign in as the patient and open **My results**.

**What you should see**
- The email holds **no values and no verdict**. It only asks the patient to sign in.
- A notice in the bell at the top of the portal: "Your results are ready".
- Each marker with its value, its range and its status.
- The doctor's comments and the note for the patient.
- A trend line for each marker. With a single report it is one point. Enter a second report with an earlier sample date to see a line.

## Checks that must hold

Try each of these. If one does not behave as written, tell us.

| Check | Expected |
|---|---|
| The patient signs in after step 1 but before release | **My results** shows nothing from the new report |
| An admin opens the report | An admin sees patient names but no results |
| A PA opens a report awaiting review | There is no **Release to the patient** button |
| The doctor opens a report that is already released | It is shown as released and cannot be released a second time |
| The patient switches results emails off in their profile, and another report is released | The portal notice appears, and no email arrives |

## Not built yet

- **Corrections.** A released report cannot be withdrawn or corrected.
- **Lab feeds.** A PA types the values. Electronic feeds from the labs come later.
- **Reading a PDF automatically.** Postponed. A person enters the values from the PDF.
- **Patient uploads.** A patient cannot upload a PDF yet.
- **Ordering and paying for bloods.** This test starts at the lab report.
- **Guardians.** A guardian does not see the patient's results yet.
- **Results by message.** Only the portal and the email notice exist. WhatsApp comes later.

## What we would like you to tell us

1. Are the marker names, units and ranges the ones you use? Which are missing?
2. Is the borderline rule right: inside the range but within 5% of an edge?
3. Is the flow of entry, review and release right? What would you change?
4. Is the wording of the email and of the notice right for your patients?
5. Should a patient be able to switch off the "result ready" email, or must they always get it?
6. Is the comment per marker enough, or do you also want a summary for the patient?
7. What would you want to do after releasing: correct, withdraw, add a note?
