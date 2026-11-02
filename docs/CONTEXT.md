# Clinic Hub: technical context

Owned by the `context-keeper` subagent. The code is the truth; this document describes it. Last updated [2026-11].

## 1. Product summary

Clinic Hub is the patient and clinic portal pair for The Schoeman Clinic (hormone, longevity and functional medicine, London). The MVP is built around the bloods loop: order, Stripe payment and barcode, results by lab feed or PDF import with PA review, doctor review and release, then the patient sees the trend. GoHighLevel keeps messaging, reminders, tasks, calendar, invoices and marketing. Semble keeps consultation notes and prescribing for now.

## 2. Current status [2026-11]

| Phase | State |
|---|---|
| 1. Scaffold (Next.js and Supabase foundation) | Done |
| 2. Design system (tokens and restyled shadcn components) | Done |
| 3. Documentation (CLAUDE.md, subagents, reference files) | Done |
| 4. Database migrations | In progress elsewhere; not recorded here until committed |
| Sign-in, password reset, dashboards, patient and clinic areas | Not built |

Built so far: the Supabase client helpers (`lib/supabase/`), lazy environment validation, the Resend wrapper, security headers, the design-system components and the dev-only gallery at `app/dev/ui/`. The home page (`app/page.tsx`) renders nothing.

## 3. Stack and versions

Checked against `package.json` and `pnpm-lock.yaml` [2026-11].

| Item | Version |
|---|---|
| Node | >=20.9.0 |
| pnpm | 10.33.0 |
| Next.js (App Router, `proxy.ts`) | 16.4.4 |
| React / React DOM | 19.3.1 |
| TypeScript (strict) | 5.9.3 |
| Tailwind CSS (v4, with `@tailwindcss/postcss`) | 4.3.3 |
| shadcn/ui primitives via `radix-ui` | 1.8.1 |
| `class-variance-authority`, `clsx`, `tailwind-merge` | 0.7.1, 2.1.1, 3.3.x |
| `lucide-react` | 1.66.x |
| `sonner` | 2.0.8 |
| `tw-animate-css` | 1.3.x |
| `@supabase/ssr` | 0.12.7 |
| `@supabase/supabase-js` | 2.118.0 |
| Supabase CLI | 2.122.0 |
| Resend | 6.37.x |
| Zod | 4.6.7 |

## 4. Database

Status: planned. No migrations are committed yet [2026-11]. This section will list columns, relations, enums, helper functions, triggers, storage buckets and the migration list once the migrations land. Until then the reference is `docs/reference/schema-draft.md`.

Planned tables (32, all in `public`; `auth.users` is managed by Supabase Auth):

- Identity and accounts (5): `profiles`, `user_roles`, `invitations`, `notification_preferences`, `notifications`
- Team and sites (4): `locations`, `staff_profiles`, `staff_locations`, `care_team`
- Patient record (7): `patient_profiles`, `patient_guardians`, `patient_allergies`, `consents`, `diagnoses`, `safeguarding_alerts`, `medications`
- Care and requests (4): `repeat_requests`, `appointments`, `documents`, `questions`
- Labs and results (9): `lab_orders`, `lab_reports`, `result_imports`, `results`, `import_items`, `markers`, `lab_partners`, `lab_panels`, `lab_panel_markers`
- Integrations and compliance (3): `webhook_events`, `integration_sync_log`, `audit_log`

Planned access levels: own account, patient record, team only, doctors only, reference, server only.

Planned deviation from the draft: staff lookup is the function `get_staff_directory()`, not a `staff_directory` view (see Findings).

## 5. Architecture and file structure

| Path | State |
|---|---|
| `app/layout.tsx` | Built. `en-GB`, fonts, `TooltipProvider`, `Toaster`, `noindex` |
| `app/globals.css` | Built. Every design token and type utility |
| `app/dev/ui/` | Built. Component gallery |
| `app/fonts/` | Cormorant Garamond and Inter, self-hosted woff2 |
| `app/(auth)/`, `app/auth/confirm/`, `app/portal/`, `app/clinic/` | Planned, not built |
| `components/ui/` | Built. Restyled shadcn primitives and design-system components (alert-bar, status-pill, stat-card, sparkline, page-header, empty-state, demo-banner, wordmark and others) |
| `components/shell/` | Planned |
| `lib/supabase/` | `client.ts`, `server.ts`, `proxy.ts` (session refresh), `admin.ts` (service role, server only) |
| `lib/env.ts` | Lazy Zod validation of public, Supabase server and email variables |
| `lib/email/send.ts` | Resend wrapper |
| `lib/fonts.ts`, `lib/utils.ts` | Fonts; `cn` helper |
| `lib/auth/`, `lib/data/`, `lib/database.types.ts` | Planned |
| `proxy.ts` | Calls `updateSession`; refreshes the session only. Row-level security is the real authorisation |
| `next.config.ts` | Security headers (HSTS, nosniff, referrer policy, frame denial, permissions policy) and a starter Content-Security-Policy |
| `supabase/` | `config.toml` present; migrations, tests and seed are not yet recorded |
| `docs/reference/` | Schema draft, design system, prototype. Read only |

## 6. Routes, server actions and API routes

None built [2026-11]. Existing routes: `/` (empty) and `/dev/ui` (component gallery; to return 404 in production per CLAUDE.md). Planned: sign-in with email and password, forgot and update password, `/auth/confirm`, `/portal`, `/clinic`.

## 7. Environment variables

From `.env.example` and `lib/env.ts`. `.env*.local` is ignored.

| Variable | Scope | Use |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL (local: `http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Publishable (anon) key |
| `NEXT_PUBLIC_DEMO` | Public, optional | `true` shows the demo banner |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Used only from `lib/supabase/admin.ts` |
| `RESEND_API_KEY` | Server only | Used only from `lib/email/send.ts` |
| `EMAIL_FROM` | Server only | Verified sender address |

## 8. Technical decisions

- [2026-11] Tailwind v4 rather than the template's v3, to match the brief.
- [2026-11] Default Tailwind palette, radii and shadows removed with `--color-*: initial` (and equivalents), so stray utilities generate nothing and only tokens exist.
- [2026-11] Utilities are named after tokens. shadcn's `--secondary` role is kept as `--secondary-role`; `secondary` is the bronze token.
- [2026-11] `cacheComponents: true` removed: all portal data is per-user and must not be cached.
- [2026-11] Colima is the local Docker runtime on this machine (Docker was not installed). `pnpm db:start` needs it running.
- [2026-11] Screens read through the signed-in user's session; the service role lives only in `lib/supabase/admin.ts`.
- [2026-11] No cascade deletes; clinical records archived with `archived_at`; accounts suspended through `profiles.status`.
- [2026-11] No remote Supabase project is linked or pushed to by agents.

## 9. Code conventions

- British English in code, comments, docs, UI copy and commits.
- TypeScript strict, no `any`.
- Tokens only: no raw colours, stray radii, shadows or gradients in JSX. Restyle in the component file with CVA variants.
- After every shadcn CLI run, confirm `cn` imports from `@/lib/utils` and no `cn` package appeared.
- One RLS policy per command, never `FOR ALL`; wrap `auth.uid()` as `(select auth.uid())`.
- Conventional Commits, one per logical change, on a branch.

## 10. Out of scope

Messaging, reminders, tasks, calendar, invoices and marketing (GoHighLevel); consultation notes and prescribing (Semble, for now).

## 11. Findings

1. [2026-11] The with-supabase template ships Tailwind v3; the brief expected v4. Upgraded to v4.
2. [2026-11] The shadcn CLI wrote `import { cn } from "cn"` and installed an unrelated npm package `cn`. Fixed to `@/lib/utils`; package removed.
3. [2026-11] The design-system README maps shadcn `--secondary` to surface-selected, but the tokens define `secondary` as bronze and the brief wants utilities named after tokens. Decision: the token wins; shadcn's role is `--secondary-role`.
4. [2026-11] The prototype sign-in uses a magic link; the brief says email and password. Brief wins for security and process.
5. [2026-11] The prototype sign-in panel uses a gradient; the design system and brief forbid gradients. Flat surface-inverse used.
6. [2026-11] The design-system README's generated index calls FilterChips a "square toggle", while the component README and brief say a rounded switch. Rounded switch used.
7. [2026-11] The Button README says six variants; the brief adds `link`, making seven.
8. [2026-11] The schema draft calls for a `staff_directory` view; the brief requires a `get_staff_directory()` function. Brief wins (security).
9. [2026-11] The template's `cacheComponents: true` was removed: all portal data is per-user and must not be cached.
