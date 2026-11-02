# Clinic Hub

The patient and clinic portals for The Schoeman Clinic (hormone, longevity and functional medicine, London). The MVP is built around the bloods loop: order, Stripe payment and barcode, results by lab feed or PDF import with PA review, doctor review and release, then the patient sees the trend. GoHighLevel keeps messaging, reminders, tasks, calendar, invoices and marketing. Semble keeps consultation notes and prescribing for now.

**Stack:** Next.js (App Router, `proxy.ts`), React, TypeScript strict, Tailwind v4, shadcn/ui (restyled), Supabase (Postgres, Auth, Storage) through `@supabase/ssr`, Resend, Zod, pnpm.

Work in British English everywhere: code comments, docs, UI copy, commit messages (colour, organise, programme, haematocrit, oestradiol).

## Where things live

| Path | What |
|---|---|
| `app/(auth)/` | Sign-in, forgot password, update password |
| `app/auth/confirm/` | Email link confirmation route |
| `app/portal/` | Patient and guardian area |
| `app/clinic/` | Staff area |
| `app/dev/ui/` | Dev-only component gallery (404 in production) |
| `app/globals.css` | Every design token and type utility |
| `components/ui/` | shadcn primitives (restyled) and design-system components |
| `components/shell/` | App shell: sidebar, top bar, navigation |
| `lib/supabase/` | `client.ts`, `server.ts`, `proxy.ts`, `admin.ts` (service role) |
| `lib/auth/` | Current user and role helpers |
| `lib/data/` | Server-side reads for screens, through the user's session |
| `lib/env.ts` | Lazy environment validation |
| `lib/email/send.ts` | Resend wrapper (server only) |
| `lib/database.types.ts` | Generated; never edit by hand |
| `supabase/migrations/` | Ordered SQL migrations |
| `supabase/tests/` | pgTAP tests |
| `supabase/seed.sql` | Fictional data only |
| `docs/reference/` | Agreed schema draft, design system, prototype. Read only |
| `docs/` | The four living documents, each owned by a subagent |

## Commands

```bash
pnpm dev          # Next.js dev server
pnpm build        # production build
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm db:start     # start the local Supabase stack (needs Docker)
pnpm db:reset     # rebuild the local database from migrations and seed
pnpm db:lint      # lint the database, fail on warnings
pnpm db:test      # run the pgTAP tests
pnpm db:types     # regenerate lib/database.types.ts from the local database
```

## Non-negotiable rules

**Security**
- Row-level security is the real authorisation. The proxy only refreshes the session and redirects; server layouts check the role again.
- Screens read through the signed-in user's session (`lib/supabase/server.ts`), never the service role.
- `lib/supabase/admin.ts` is the only service-role client. It starts with `import "server-only"` and is never imported from a Client Component. No service role in the browser.
- RLS is enabled and forced on every table in `public`. `anon` gets nothing. `authenticated` gets only the commands a policy allows.
- One policy per command, in plain English, never `FOR ALL`. Wrap `auth.uid()` as `(select auth.uid())`.
- Patients see a lab report or result only after release. Safeguarding alerts are for doctors only.
- `audit_log` is append-only. Nobody can change their own role.
- Do not connect to or push to any remote Supabase project. A human links and pushes after review.
- Never commit secrets. `.env*.local` stays ignored. Seed data is fictional, with `@example.test` emails.

**No cascade deletes.** Every foreign key is `ON DELETE RESTRICT` or the default. Never `CASCADE`, never `SET NULL` on clinical data. Clinical records are archived with `archived_at`, not deleted. Accounts are suspended through `profiles.status`, not deleted.

**Tokens only.** No raw colour values in JSX or component classes, no stray radii, no shadows, no gradients. Restyle in the component file with CVA variants, not at the call site. After every shadcn CLI run, check the `cn` import still points to `@/lib/utils` and that no new dependency called `cn` appeared (the CLI has written `from "cn"`). shadcn's generated `bg-secondary` means surface-selected in its docs, but here means the bronze token: fix it in the component file.

**British English**, and the copy rules in `docs/reference/design-system/README.md`: no exclamation marks, no emoji, no medical promises, UPPERCASE only for eyebrow, button and pill labels.

**TypeScript:** strict, no `any`.

## Workflow

After any change that touches the database, auth, a screen or a component, call the relevant subagents before committing:

| Subagent | Owns | Call it after a change to |
|---|---|---|
| `context-keeper` | `docs/CONTEXT.md` | Migrations, routes, server actions, env vars, architecture, stack |
| `prd-keeper` | `docs/PRD.md` | Features, scope, roles, clinic decisions |
| `design-system-keeper` | `docs/DESIGN-SYSTEM.md` | Tokens, components, screens |
| `security-reviewer` | `docs/SECURITY.md` | **Always**, on every change to migrations, policies, auth or server actions |

Subagents edit only their own document and report inconsistencies under "Findings" instead of silently fixing code.

Commits follow Conventional Commits, one per logical change, on a branch.
