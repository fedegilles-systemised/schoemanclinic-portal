## What it does

Most labs other than TDL (GutMap, Nordic, Regenerus and others) send a PDF, not a feed. This flow gets that PDF onto the right patient's record and turns it into a report a doctor can review. No value is read from the PDF by a machine: a PA types each value from the lab's report.

## How it works

1. **A lab posts a report.** Each lab has its own address and its own secret. The lab posts the PDF with the patient's name, email and date of birth, once for each report. A wrong secret is refused, and an address with no secret set does not exist.
2. **Matching.** If exactly one patient has that email and date of birth, and the name agrees, the PDF is filed under them. Otherwise it waits in the **Import queue** as "needs matching", with what the lab wrote beside it. The name is only a check, never used to find a patient.
3. **Telling the team.** The PA and the clinic inbox are told that a report has arrived, by a link only, never a name.
4. **A PA matches and enters.** The PA chooses the patient, the sample date and the lab, and types each value with the unit on the report. A value in another unit is converted to the clinic's UK unit, and the original is kept next to it. Each value is marked low, high, borderline (inside the range but within 5% of an edge) or in range.
5. **Review.** The report goes to the doctor (see the results guide). Nothing is visible to the patient until a doctor releases it.
6. **Turning a file away.** A PA or admin can turn a waiting file away with a short reason. It is archived, not deleted. A file matched to the wrong patient, with no values entered yet, can be sent back to the queue with **Wrong patient**.
7. **Retention.** A file nobody matched within 30 days, or that was turned away, has its PDF removed and the lab's personal details cleared. The record that it arrived stays. This runs once a day.
8. A report sent twice is kept once.

A PA or doctor can also attach a PDF, JPEG or PNG (up to 10 MB) when adding results by hand.

## How to try it

A lab posting a report needs a secret for that lab, so you try the team's side.

1. As a PA, open **Import queue** in the menu.
2. Open **Results review**, choose **Add results**, pick a test patient, and attach any small PDF.
3. Type two values and save. The report appears under **To review** with the PDF attached.
4. Open the report to see the original unit kept next to the converted one.

**What you should see:** only PAs and admins can see waiting lab files, and the patient sees nothing before release.

## Not built yet

- A patient uploading their own results. The screen is in the menu and switched off.
- Reading the values from the PDF automatically.
- A lab sending a link for a very large file (over about 4.5 MB).

## To confirm

- Is 30 days the right time to keep a lab file nobody matched?
- Which lab will post first, and does it sign what it sends and retry?
- Who signs the data processing agreement with each lab?
