# Clinic Hub: product requirements

Owner: `prd-keeper`. Last updated [2026-11].

## 1. Context and problem

The Schoeman Clinic (hormone, longevity and functional medicine, London) needs a patient portal and a clinic portal. Today results, orders and requests are spread across GoHighLevel, Semble, email and PDFs, so staff re-key data and patients cannot see their bloods in one place or follow a trend over time.

## 2. Goals

- Run the bloods loop end to end in one place.
- Give patients a clear, calm view of their results and trends, shown only after a doctor releases them.
- Cut manual import and chasing work for PAs and doctors.
- Keep clinical data private by default, enforced in the database (row-level security).

## 3. MVP scope

The MVP is built around the bloods loop: order, Stripe payment and barcode, results by lab feed or PDF import with PA review, doctor review and release, then the patient sees the trend.

**In:** the bloods loop above; sign-in; patient and clinic home dashboards; the screens listed in section 5.

**Out (stays elsewhere):**
- GoHighLevel keeps messaging, reminders, tasks, calendar, invoices and marketing.
- Semble keeps consultation notes and prescribing for now.

## 4. Roles

| Role | Purpose |
|---|---|
| Patient | Sees own record, released results, orders tests, uploads results, asks the clinic |
| Guardian | Verified by the clinic; sees or manages a patient's account (for example a parent of an under-18) |
| Doctor | Reviews and releases results; sees safeguarding alerts (doctors only) |
| PA | Reviews imports, manages orders and invitations |
| Health coach | Sees released results only; no team-only tables (current position) |
| Admin | Manages team, roles and settings; no clinical record access (current position) |

## 5. Features

Status is "done" only where the screen and data path exist in code. Current state: foundations only (scaffold, design system, Supabase config). No routes beyond the landing page and dev gallery exist yet; there are no migrations.

| Area | Feature | Status |
|---|---|---|
| Foundation | Next.js and Supabase scaffold, design tokens, restyled components | done [2026-11] |
| Both | Sign-in | in progress |
| Patient | Home dashboard | in progress |
| Clinic | Dashboard | in progress |
| Patient | Lab orders | planned |
| Patient | My results | planned |
| Patient | Upload results | planned |
| Patient | Prescriptions | planned |
| Patient | Appointments | planned |
| Patient | Ask the clinic | planned |
| Patient | Letters and documents | planned |
| Patient | Privacy and consent | planned |
| Clinic | Patient list | planned |
| Clinic | Results review | planned |
| Clinic | Import queue | planned |
| Clinic | Lab orders | planned |
| Clinic | Safeguarding alerts | planned |
| Clinic | Team and settings | planned |

## 6. Open questions for the clinic

1. **Access scope.** Do staff see all patients, or only those on their care team? `in_scope` currently returns true for any clinical staff member.
2. **Admins and clinical records.** May admins read clinical records? Currently no (least privilege); the draft distinguishes "clinical team" from "team".
3. **Health coach.** May the health coach read team-only tables? Currently no.
4. **Guardians.** What age and consent rules apply (for example under-18s, transition to adult access)?
5. **Retention.** What retention periods apply to clinical records, uploads and audit logs?
6. **Sign-in method.** The prototype shows magic link; the brief says email and password. Which one?
7. **AI extraction provider** for PDF imports: which provider, and what data-processing terms?

## 7. Decisions

- [2026-11] MVP centres on the bloods loop; messaging, reminders, calendar, invoices and marketing stay in GoHighLevel, notes and prescribing in Semble.
- [2026-11] Least privilege by default: admins and the health coach have no clinical access until the clinic decides otherwise.
- [2026-11] Patients see results only after doctor release; safeguarding alerts are doctors only.

## Findings

- [2026-11] No `supabase/migrations/` yet, so every data path is unbuilt; `in_scope` and role rules exist only in the schema draft.
- [2026-11] `docs/CONTEXT.md` does not exist yet, so status could not be cross-checked against it.
- [2026-11] No sign-in or dashboard routes are present in `app/` despite "in progress" status; that status reflects intent, not code.
- [2026-11] Sign-in method differs between prototype (magic link) and brief (email and password); `CLAUDE.md` lists forgot and update password routes, which implies passwords.
