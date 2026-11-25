# Demo walk-through, inside the same project

How to give the clinic a set of made-up people and activity to try Clinic Hub with, and how to wind it down afterwards. It lives in the same Supabase project as everything else, so it follows the same rules: nothing is deleted. Accounts are suspended and records archived.

Four files in `supabase/demo/`, run by hand in the Supabase SQL editor. They are not migrations and not part of `seed.sql`.

| File | What it does |
|---|---|
| `demo-load.sql` | Creates seven `demo.*@example.test` accounts and their activity |
| `demo-unload.sql` | Locks those accounts at the sign-in service, suspends them, archives the demo patients, medications and staff, and closes what is still open |
| `demo-markers.sql` | Adds a base set of 21 common biomarkers, only when the project's marker list is empty. Catalogue: it cannot be removed afterwards |
| `demo-more.sql` | Adds five more demo patients with five reports each over about a year, and fills in the results for the first demo patients |

Order: `demo-load.sql`, then `demo-markers.sql`, then `demo-more.sql`. The unload at the end covers all of them. The marker ranges are standard adult ranges, not the clinic's own: replace them with the clinic's list when it is loaded.

## What it creates

| Person | Sign-in | What they can show |
|---|---|---|
| Doctor | `demo.doctor@example.test` | Review queue (Thomas's results), diary, patient records, release, orders |
| Health coach | `demo.coach@example.test` | Care-team view of Eleanor |
| Nurse | `demo.nurse@example.test` | Nurse view |
| Patient | `demo.eleanor@example.test` | Three released reports (the trend), medications, an answered and an open question, next booking |
| Patient | `demo.thomas@example.test` | Bloods taken, results waiting for the doctor (the patient sees nothing until release) |
| Patient | `demo.amira@example.test` | A blood order sent, not yet paid |
| Guardian | `demo.mark@example.test` | Acts for Isla Demo, a child |

There is no demo admin and no demo PA. Both see every patient in the project, so a demo account with a shared password would reach real records. The walk-through of the admin and PA screens uses the clinic's own sign-in, with made-up patients only.

Results are added only for markers that exist in the project. If the clinic has not loaded a marker such as HbA1c, the trend will show fewer lines.

## Before you run it

1. **Only while the project holds no real patients.** The script stops if one exists, with no override. Run the unload before the clinic starts entering real patients. A patient added after the load (an online booking, a PA, an import) is not checked, so keep the window short. If real patients are already there, use a separate project.
2. **Set `v_password`** at the top of `demo-load.sql` to a random password of at least 16 characters, used for this demo only. Paste the script into the SQL editor and set it there: do not save it in the file, and do not commit it. The editor keeps a history of what you ran, so delete that entry afterwards. Share the password with the walk-through person only, and not in the same message as the addresses.
3. The project needs one lab partner. The script uses the first location and the first active panel and changes neither. If there is no location it adds one named `Demo (video)`, and if there is no active panel it adds `DEMO-PANEL`. The unload archives the panel. A location cannot be archived, so `Demo (video)` stays in the location lists after the demo: remove it by hand once nothing needs it, or leave it until the clinic's real locations are entered.
4. Emails to `@example.test` go nowhere, so "Forgot password" does not work for these accounts. Give the walk-through person the password.
5. **Messages and money.** The demo rows carry no GoHighLevel ids, but the reminder jobs still treat them as patients: Amira's unpaid order, run-out reminders and feedback requests are sent to `@example.test` addresses until the unload, and bounce. Run the unload within two days. Keep Stripe in test mode, and do not send prescriptions to SignatureRx while the demo is open.

## Winding it down

Run `demo-unload.sql` the day the walk-through ends. Until then the demo accounts are live accounts with a shared password.

It locks the seven accounts at the sign-in service (banned, password replaced, every session ended) and suspends them in Clinic Hub. It archives the demo patients, medications and staff profiles, closes the open question, releases Thomas's waiting report so that it leaves the review queue, cancels bookings still to come and unpaid orders, and ends the guardian's access. Nothing is deleted: the rows, what the walk-through person did, and the audit log stay.

Archived demo patients still appear to PAs and admins in lists that do not filter archived records. They are clearly named `Demo` and carry the reference `DEMO-`.

The accounts are closed for good. A second demo needs new addresses and ids in `demo-load.sql`.

## Not covered

Files (lab PDFs, letters) are not created, because nothing is uploaded to storage. The PDF import and the documents screens therefore show nothing for the demo people.
