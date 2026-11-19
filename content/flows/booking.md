## What it does

Clinic Hub holds the clinic's diary. Patients book with the clinicians on their care team, the team books for any patient they can open, and new patients book online from a public page. Each clinician's Google Calendar receives their bookings, with the clinic reference only.

- **No cancel or move button for patients.** The team moves or cancels a booking from the diary, and the patient is told. Messages ask the patient to contact the team and refer to the 48-hour policy.
- **No-shows.** A doctor marks a visit as a no-show on their own diary; a PA or an admin can mark any. A wrong mark can be undone by a PA or an admin.
- **Online booking for new patients** offers the initial consultation only, takes no deposit, and needs a time at least a day ahead.

## How it works

1. Each clinician sets their weekly hours, and an admin sets which appointment types are offered online, under **Booking settings**. A clinician connects their own Google Calendar under **My calendar**.
2. A patient opens **Appointments** in the portal, chooses an appointment type and a clinician, and picks a free time inside that clinician's hours. They are sent a confirmation, which mentions the 48-hour policy.
3. The team books from the **Diary** or from a patient's record. The diary shows every clinician's bookings by day, week or month, with a colour per clinician and filters by clinician and location. Admins and PAs see everyone. A doctor, a nurse or a health coach sees their own.
4. A new patient opens the clinic's booking page, chooses the appointment type, a clinician or the first available, and a time, then gives their name, date of birth, email and mobile. Anyone already on the books, matched by email and date of birth, is booked on their own record and nothing they type changes it. Anyone else gets a new record.
5. If the new record looks like someone already on the books, the team sees a warning with the likely record. Nobody is merged automatically. If it is a duplicate, the team archives the extra record.
6. A new patient who booked online and has not been checked or invited two working days later is reminded to admins and PAs, once.
7. The due date for bloods is 14 days before the appointment they are for.

## How to try it

Use fictional patients.

1. As an admin, open **Booking settings**. Set a clinician's hours and tick the initial consultation as bookable online.
2. In a private browser window, open the booking page and book as a new patient with made-up details and an email you can read.
3. As a PA, open the **Diary**. The booking is there. Open it to see the duplicate warning if the details match someone.
4. Try **Mark as did not attend** on a booking, then **Remove no-show** to put it right.
5. From the **Diary** book a second appointment for a test patient, then cancel it. The patient is told.

**What you should see:** a confirmation to the booker, the booking in the clinician's Google Calendar (when they have connected it), and every change in the activity log.

## Not built yet

- A charge for a late cancellation or a no-show, with the card saved in Stripe. It is agreed and listed in the Roadmap.
- The cancellation policy shown on every booking message, with the wording "charged in full". It is agreed and listed in the Roadmap.

## To confirm

- Is the initial consultation the only appointment type to offer online?
- Which appointment types need bloods, and is 14 days before the right due date for all of them?
