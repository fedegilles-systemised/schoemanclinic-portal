# Design system

How the Clinic Hub looks and is built. This describes the code as it stands in `app/globals.css`, `components/ui/`, `components/shell/`, `components/auth/` and the screens in `app/`, including the Phase 6 files (committed in `c831ccf`). The source design system is `docs/reference/design-system/` (read only); where the two clash, the tokens win over the shadcn mapping (see Findings).

Last updated: [2026-11]. Owned by the `design-system-keeper` subagent.

**State of the build [2026-11].** Tokens, type utilities and 27 files in `components/ui/` exist, plus the dev gallery at `/dev/ui`. The app shell (`components/shell/`), the sign-in screens (`app/(auth)/`, with `components/auth/`), the portal home (`app/portal/`) and the clinic home (`app/clinic/`) are built. Buttons that lead to unbuilt screens are disabled and wrapped in `ComingSoon`. Results, orders, prescriptions, appointments, messages and settings screens are **not built**. The logo and favicon (`public/brand/`) are in.

## 1. Principles

- **Calm before clever.** Generous space, thin borders, one main action per screen. Nothing shouts except a result that needs attention.
- **Clinical truth first.** Every value shows its unit and reference range. Status is never colour alone: colour, icon and word together.
- **One brand, two portals.** Patients and clinicians share tokens and components; the clinic portal is denser, not different.
- **Borders, not shadows.** Separation comes from `surface-border` hairlines and space. No shadows, no gradients.
- **Tokens only.** The Tailwind palette, radii and shadows are switched off in `globals.css` (`--color-*`, `--radius-*`, `--shadow-*`, `--inset-shadow-*`, `--drop-shadow-*` set to `initial`), so a stray `bg-red-500` or `shadow-md` generates nothing. Restyle inside the component file with CVA variants, never at the call site.
- **Voice.** British English. "You" for patients, "we" for the clinic. No exclamation marks, no emoji, no medical promises. UPPERCASE only through `type-eyebrow`, `type-button-label` and `type-pill-label`. One italic accent word per title, set in `secondary`. Dates 29 Oct 2026, times 10:30, money £295.00.

## 2. Tokens

One light theme (`color-scheme: light`). Values live in `:root` in `app/globals.css` (oklch) and are exposed to Tailwind through `@theme inline`. Pick by role, never by hue.

### Colour (27 tokens)

| Group | Token | Tailwind utilities | Use |
|---|---|---|---|
| Primary | `primary` | `bg-primary`, `border-primary`, `text-primary` | Charcoal. The one main action, count badges |
| | `primary-hover` | `bg-primary-hover` | Primary button hover |
| | `primary-content` | `text-primary-content` | Text on `primary` |
| Secondary | `secondary` | `bg-secondary`, `text-secondary`, `fill-secondary`, `stroke-secondary` | Bronze. Secondary button, bronze text, accent word, chart line |
| | `secondary-border` | `border-secondary-border`, `bg-secondary-border` | Focus ring, hover and active states, selected underline |
| | `secondary-content` | `text-secondary-content` | Text on `secondary` (same value as `primary-content`) |
| Accent | `accent` | `bg-accent` | Champagne. Decoration only. Never text on a light surface (1.9:1) |
| | `accent-subtle` | `bg-accent-subtle` | Reference-range band |
| | `accent-content` | `text-accent-content` | Text on `accent` |
| Status | `status-success` / `-bg` | `text-status-success`, `bg-status-success-bg`, `border-status-success` | In range, completed |
| | `status-warning` / `-bg` | as above | Borderline, attention |
| | `status-danger` / `-bg` | as above | Out of range, errors, destructive |
| | `status-info` / `-bg` | as above | Neutral information, second chart series |
| Content | `content` | `text-content`, `bg-content` | All text and icons |
| | `content-muted` | `text-content-muted` | Meta text, resting icons |
| | `content-inverse` | `text-content-inverse` | On `surface-inverse`, `primary`, `secondary`, `status-danger` fills |
| Surface | `surface` | `bg-surface` | Page ground |
| | `surface-raised` | `bg-surface-raised` | Cards, inputs, menus |
| | `surface-sunken` | `bg-surface-sunken` | Quiet fills, row hover, skeletons |
| | `surface-selected` | `bg-surface-selected` | Selected rows and items |
| | `surface-inverse` | `bg-surface-inverse` | Dark bands, toasts, tooltips, demo banner |
| | `surface-border` | `border-surface-border`, `bg-surface-border` | Hairlines |
| | `surface-overlay` | `bg-surface-overlay` | Scrim behind dialogs and sheets |

shadcn aliases exist in `:root` and `@theme inline` so CLI-added components resolve: `background`, `foreground`, `card`, `popover`, `muted`, `muted-foreground`, `primary-foreground`, `secondary-foreground`, `accent-foreground`, `border`, `input`, `ring`, `destructive`. `--secondary` keeps its token meaning (bronze); shadcn's role for `secondary` is held in `--secondary-role` (`surface-selected`) and has no Tailwind utility.

### Shape, size and layout

| Token | Value | Tailwind | Use |
|---|---|---|---|
| `radius-none` | 0 | `rounded-none` | Buttons, inputs, tabs, dialogs, menus, toasts, tooltips, skeletons |
| `radius-pill` | 2px | `rounded-pill` | Status pills, badges |
| `radius-card` | 4px | `rounded-card` | Cards only |
| `radius-full` | 9999px | `rounded-full` | Switch only |
| `radius-round` | 50% | `rounded-round` | Avatars only |
| `control-height` | 44px | `h-control`, `size-control` | Buttons, inputs |
| `control-height-sm` | 36px | `h-control-sm`, `size-control-sm` | Small buttons, icon buttons |
| `pill-height` | 22px | `h-pill` | Status pills |
| `nav-row` | 40px | `h-nav-row` | Sidebar rows (`components/shell/nav.tsx`) |
| `table-row` | 52px | `h-table-row` | Minimum table row (used in `TableCell`) |
| `topbar-height` | 64px | `h-topbar` | Top bar (`app-shell.tsx`) |
| `sidebar-width` | 264px | `w-sidebar` | Desktop sidebar (`app-shell.tsx`, as `var(--spacing-sidebar)`) |
| `content-max` | 1200px | `max-w-content` | Content width (`<main>` in `app-shell.tsx`) |
| `icon-size` | 18px | `size-icon` | Default icon; `.lucide` is set to this in the base layer |
| `stroke-hairline` | 1px | `border` | Cards, tables, inputs, dividers |
| `stroke-control` | 2px | `border-2` | Every button border |
| `stroke-accent` | 3px | `border-l-3` | Left edge of `AlertBar`; also the 2px current-row bar in the sidebar uses `border-l-2` with `secondary-border` |
| `stroke-icon` | 1.5 | automatic | `.lucide` stroke width in the base layer |
| Breakpoints | 900px / 560px | `shell:` / `phone:` | Sidebar to sheet / title size drop |

Spacing uses Tailwind's default 4px scale, which matches `space-1` to `space-12` (`p-6` = 24px, `p-10` = 40px). Cards use `p-6` and `gap-3`; sections sit `space-12` apart; page padding `space-10` desktop, `space-5` phone.

### Motion

150ms ease-out on colour changes (`duration-150 ease-out`), 200ms for the side sheet slide. A reduced-motion rule in the base layer cuts animation and transition durations to near zero.

## 3. Type

Two families, set in `app/layout.tsx` as `--font-cormorant` and `--font-inter` and exposed as `font-display` and `font-sans`. Display (Cormorant Garamond, weight 300) only for the four titles below, never for numbers, tables, buttons or text under 20px. Colour stays with the call site.

| Utility | Family | Size / line | Weight | Notes |
|---|---|---|---|---|
| `type-hero-title` | display | 52 / 56 | 300 | -0.02em, balanced |
| `type-page-title` | display | 40 / 44 (32 / 36 under 560px) | 300 | -0.02em, balanced |
| `type-section-title` | display | 28 / 34 | 300 | -0.015em, balanced |
| `type-card-display` | display | 24 / 28 | 300 | -0.01em |
| `type-card-title` | sans | 16 / 24 | 600 | |
| `type-body` | sans | 15 / 24 | 400 | Body default |
| `type-small` | sans | 13 / 20 | 400 | Meta, descriptions |
| `type-table` | sans | 14 / 20 | 400 | Tables, menus, toasts |
| `type-value` | sans | 14 / 20 | 500 | Tabular numerals |
| `type-big-number` | sans | 32 / 36 | 500 | Stat tiles, tabular numerals |
| `type-eyebrow` | sans | 11 / 16 | 500 | UPPERCASE, 0.18em. Above page titles, form labels, table headers |
| `type-button-label` | sans | 11 / 16 | 500 | UPPERCASE, 0.16em. Buttons, tabs |
| `type-pill-label` | sans | 10.5 / 12 | 500 | UPPERCASE, 0.08em. Pills, badges |

Set numbers that line up with `tabular-nums`. Running text near 65 characters.

## 4. Shape and states

- **Corners.** Square everywhere except `radius-card` on cards, `radius-pill` on pills and badges, `radius-full` on the switch, `radius-round` on avatars.
- **Borders.** 1px `surface-border` around cards, tables, inputs, menus and dialogs. 2px on every button. 3px status-coloured left edge on `AlertBar` only.
- **Depth.** None. No shadows, no gradients.
- **Hover.** Clickable stat cards: border to `secondary-border`. Table body rows: `surface-sunken`. Primary: `primary-hover`. Outline: fills. Tabs and icon buttons: text to `content`. Menu items: `surface-sunken` (via `data-highlighted`).
- **Focus.** One global rule in the base layer: `:focus-visible { outline: 2px solid secondary-border; outline-offset: 2px }`. Inputs and textareas also take a `secondary-border` border on `focus`.
- **Selected.** `surface-selected` fill (radio menu items); `secondary-border` 2px underline (active tab).
- **Disabled.** 45% opacity, no pointer events, `cursor-not-allowed`.
- **Invalid.** `aria-invalid` turns the input border `status-danger`; the message sits below in `type-small text-status-danger` with `aria-describedby`.
- **Loading.** `Button loading` shows a spinner, disables the button and sets `aria-busy`. `Skeleton` pulses `surface-sunken` and is `aria-hidden`.
- **Empty.** `EmptyState`: dashed `surface-border` box, one line.

## 5. Components

All in `components/ui/`, restyled with CVA and the `data-slot` attribute. Shown in `/dev/ui`, which returns 404 in production.

### Actions

**Button** (`button.tsx`). Square, 2px border, `type-button-label`. Labels say exactly what happens, verb first, in uppercase.

| Variant | When |
|---|---|
| `primary` (default) | The one main action on a screen |
| `secondary` | Bronze fill; a second action of weight |
| `outline` | Charcoal outline, fills on hover; quiet alternatives |
| `outline-bronze` | Bronze outline; quiet alternatives in clinic screens |
| `ghost` | Text only, underline on hover; inline actions |
| `destructive` | Danger outline, fills on hover; reversible-with-care actions |
| `link` | Underlined bronze text |

Sizes: `default` (`h-control`, 44px), `sm` (`h-control-sm`, 36px, inside cards and table rows), `icon` (36px square, muted, needs an accessible name). A button for a screen that is not built is `disabled` and wrapped in `ComingSoon`. Props: `asChild`, `loading`. Ghost and link collapse their height.

### Status and feedback

- **StatusPill** (`status-pill.tsx`). Colour, icon and word together; not a button. Tones: `success`, `warning`, `danger`, `info`, `dark`, `neutral`. `icon` and `label` are required. `ResultStatusPill` is the fixed trio: IN RANGE (check, success), BORDERLINE (minus, warning), OUT OF RANGE (triangle alert, danger).
- **Badge** (`badge.tsx`). Counts and neutral tags only: `count`, `neutral`, `outline`. For a status use StatusPill.
- **AlertBar** (`alert-bar.tsx`). Full-width flag with icon, bold lead, one line and at most one action. Tones `warning`, `danger`, `info`. `role="status"`. No more than two stacked; never for success.
- **Alert** (`alert.tsx`). Form-level message block for errors above a submit button. Variants `danger`, `warning`, `info`, `success`. `role="alert"`. Not in the reference design system (see Findings).
- **DemoBanner** (`demo-banner.tsx`). `surface-inverse` strip reading "Demo environment · fictional data". Shown when `NEXT_PUBLIC_DEMO=true`.
- **Toaster** (`sonner.tsx`). Bottom-centre, `surface-inverse`, lucide icons. Confirms success in the past tense ("Released to Amira Haddad."). Sign-in errors never use toasts.
- **Tooltip** (`tooltip.tsx`). `surface-inverse`, `type-small`. For supporting hints only.
- **Skeleton**, **EmptyState**. See section 4.
- **OrderSteps** (`order-steps.tsx`) [2026-11]. A thin four-part progress line for a lab order, an `<ol>` of `steps` with `doneThrough` (index of the last done step, -1 for none). Done steps fill `secondary`, the current step is half filled and has `aria-current="step"`, steps ahead stay `surface-border`. Labels are `text-xs`; done and current labels are `content`, the rest `content-muted`. Use inside a `Card` for one order only. The status is told by line colour and label weight alone (see Known debt).
- **ComingSoon** (`components/shell/coming-soon.tsx`) [2026-11]. Not a `ui/` primitive: a client wrapper for anything that leads to an unbuilt screen. It renders a focusable `<span tabIndex={0} aria-disabled="true">` as a `Tooltip` trigger reading "Coming soon", because a disabled control cannot take focus or show a tooltip. Pass `className` to change the wrapper from `inline-flex w-fit` (the sidebar uses `block`). Remove the wrapper and the `disabled` when the screen ships. Needs the `TooltipProvider` already in `app/layout.tsx`.

### Layout and data

- **Card** (`card.tsx`). Raised container for one thing; never nested. Parts: `CardHeader`, `CardEyebrow`, `CardTitle`, `CardDisplayTitle` (a product of care), `CardDescription`, `CardContent`, `CardMeta` (small row with icons), `CardActions` (bottom, left aligned, `sm` buttons).
- **StatCard** (`stat-card.tsx`). Eyebrow label, `big-number` value, optional unit and context, optional pill or sparkline as children. `urgent` colours the number `status-danger` and only for counts needing action. With `href` it becomes a link card with a `secondary-border` hover.
- **Table** (`table.tsx`). Container scrolls horizontally on its own. Eyebrow headers, hairline row borders, `h-table-row` cells, `surface-sunken` hover on body rows. Parts: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`.
- **Sparkline** (`sparkline.tsx`). 96 by 28, 1.5px `secondary` line, last point in the tone colour (`default`, `warning`, `danger`). Decorative (`aria-hidden`): the value and status must sit beside it.
- **Avatar** (`avatar.tsx`). 36px round; fallback initials in `secondary` on `surface-selected`.
- **Separator** (`separator.tsx`). 1px `surface-border` line.
- **PageHeader / SectionHeader / AccentTitle** (`page-header.tsx`). `PageHeader` is an eyebrow plus the screen's one `type-page-title`, optional description (max `62ch`) and right-hand actions. `SectionHeader` is a `type-section-title` with right-hand content. `AccentTitle` splits a title into text, one italic `secondary` accent word and a suffix.
- **Wordmark** (`wordmark.tsx`) [2026-11]. The clinic-supplied logo (`public/brand/schoemanClinic-logo.png`, 869 by 371, transparent) at a fixed 148px width. It takes no size prop. The default is a `next/image` that keeps the logo's own colours, for light grounds. `inverse`, for dark grounds, is a `role="img"` block with an `aria-label` that uses the logo as a CSS mask over `bg-content-inverse`, so its colour comes from a token. The favicon and Apple icon are a separate supplied file, `public/brand/favicon.png` (192 by 192), set in the metadata in `app/layout.tsx`; `app/favicon.ico` is gone.

### Forms and overlays

- **Input**, **Textarea**. `h-control` / `min-h-30`, `surface-raised`, hairline border, `secondary-border` on focus. Always with a visible **Label** (`type-eyebrow`, muted).
- **Switch** (`switch.tsx`). 40 by 22 track, 18px thumb, the only fully rounded control. Always beside a text label.
- **Tabs** (`tabs.tsx`). Underlined row of `type-button-label` triggers; active gets a 2px `secondary-border` underline. Tabs switch views; chips filter. FilterChips is **not built yet**.
- **Dialog** (`dialog.tsx`). Centred, up to 480px, `surface` with hairline border, `type-section-title` title, footer actions bottom left with the primary first, close button with accessible name.
- **Sheet** (`sheet.tsx`). Side panel on `surface`: `right` up to 520px with padding (forms and detail), `left` 280px (mobile navigation, no padding). Slides in at 200ms.
- **DropdownMenu** (`dropdown-menu.tsx`). `surface-raised`, hairline border, items in `type-table`, eyebrow labels, radio items selected on `surface-selected`.

### Documented in the reference system, not built

`FilterChips`, `ResultChart`, `ResultsTable` (as a composed pattern; `Table` and `Sparkline` exist), `Cover`. `SidebarNav` exists as `components/shell/nav.tsx` and `sidebar-content.tsx`, not as a `ui/` component.

## 6. Screen patterns

Built [2026-11]: app shell, three sign-in screens, portal home, clinic home, with `loading.tsx` and `error.tsx` for each area. The results screen is not built.

- **App shell** (`components/shell/app-shell.tsx`). Desktop: sticky `sidebar-width` aside with a right hairline, and a content column with `px-10` (`px-5` below 900px). Top bar is `h-topbar` with a bottom hairline and holds, left to right: the mobile menu button, the crumb in `type-eyebrow`, an optional ghost link to the other area (from `phone:`), the clinic's location switcher, the notifications bell and the account menu. `<main>` is `max-w-content`. `DemoBanner` is sticky above everything when `NEXT_PUBLIC_DEMO=true`. Below 900px the sidebar moves into a left `Sheet` (`mobile-nav.tsx`, button hidden from `shell:`).
- **Sidebar** (`sidebar-content.tsx`, `nav.tsx`). `Wordmark` (the logo in its own colours), portal label in eyebrow ("Patient portal" or "Clinic portal"), then `nav` rows, then the signed-in person (avatar, name, role) under a hairline. Rows are `h-nav-row`, `type-table`, muted. The current row is a link with `aria-current="page"`, `surface-selected` fill and a 2px `secondary-border` left bar. Rows without an `href` are `ComingSoon`, 45% opacity. The patient menu is one ungrouped list; the clinic menu is grouped under eyebrows (Today, Patients, Clinical, Clinic) with `Badge` counts for results to review and imports.
- **Account menu, bell, location switcher.** `DropdownMenu` throughout. The bell is an `icon` button with a count `Badge` and an `aria-label` that includes the unread count. The location switcher is an `outline` `sm` button (name hidden below `phone:`) that writes `?location=` into the URL; the check marks the chosen item. The account menu is an avatar trigger with the person's name, a disabled Profile item, the other-area link and Sign out (a form action).
- **Sign-in** (`app/(auth)/layout.tsx`, `login`, `forgot-password`, `update-password`). Two columns from 900px (55 / 45): a flat `surface-inverse` panel with the logo in its `inverse` form (`content-inverse`), an eyebrow and a `type-hero-title` with one `accent` italic phrase; and a single `Card` (max 420px) holding the form. On phones the panel collapses to a band with the logo only. No photography and no gradient. Each form is an `AuthHeading` (`type-page-title`), `Field`s (visible `Label` above each control), `PasswordInput` (show and hide button with `aria-pressed`), then `FormError` (an `Alert` above the button, never a toast), then one primary `Button` with `loading`, then a bronze underlined text link. The reset confirmation is an `info` `Alert` with a check icon and does not say whether the address has an account. Its copy is "If that address has an account, we have sent a link to it. The link works once. If nothing arrives in a few minutes, try again later or contact the clinic." [2026-11, uncommitted]; it always shows, even when Supabase limits the email. `/login?error=expired` shows "You were signed out to protect your account. Please sign in again." in the same `FormError` alert [2026-11, uncommitted].
- **Page header.** Every screen opens with `PageHeader`: eyebrow of the long date (and the location on the clinic home, or "Viewing" a named person for a guardian), then `Good morning, *Name*` with the first name as the accent word.
- **Portal home** (`app/portal/page.tsx`). Page header; an optional warning `AlertBar` when bloods are due; a three-up `Card` row (next appointment, bloods order with `OrderSteps`, new results); "Your markers *at a glance*" as a 1, 2 or 4 column grid of marker cards (eyebrow, big number with unit, `Sparkline`, range, `ResultStatusPill`); "From your *clinic*" with the latest letter and a running-low prescription. Each slot falls back to an `EmptyState` sentence. Card actions are disabled `ComingSoon` buttons. A guardian reads about the person they look after ("Results need to reach us two weeks before Amira's appointment").
- **Clinic home** (`app/clinic/page.tsx`). Page header; four `StatCard`s (today's appointments, results to review with `urgent` when anything is out of range, imports waiting, open tasks shown as "—"); "Needs your *attention*" as a `Table` of out-of-range results (value, range, change with arrow, `ResultStatusPill`, date, disabled Review button); "Today's *diary*" as a header-less `Table` with time, patient, type pill, duration, location icon and flag pills; "Bloods *at risk*" as `Card`s with a due `StatusPill`, a `dl` and two disabled actions. Empty slots use `EmptyState`.
- **Loading and error.** `loading.tsx` is a `Skeleton` outline of the page header, three cards and a section (`aria-busy`, `aria-label="Loading"`), identical for both areas. `error.tsx` is a `danger` `AlertBar` with a triangle icon, "This page did not load.", one line and a "Try again" outline button.
- **Results.** Not built. Intent from the reference: table of marker, latest value, unit, range, status pill, sparkline and date; a detail view with a full chart and an `accent-subtle` range band. Patients see only released results. Safeguarding alerts carry a lock icon and "Visible to clinicians only".

## 7. Known debt

Audit of `components/ui/` [2026-11], and of the Phase 6 screens (`components/shell/`, `components/auth/`, `app/(auth)/`, `app/portal/`, `app/clinic/`, `components/ui/order-steps.tsx`) [2026-11], against raw colours, stray radii, shadows, gradients, focus, colour-only status and voice.

**Clean.** No raw colour values, hex, rgb or hsl, no Tailwind palette classes, no shadows, no gradients and no radius outside the token set, in `components/ui/` and in the Phase 6 files. Every `rounded-*` is `none`, `pill`, `card`, `round` or `full`, and `full` appears only on the switch (`rounded-round` on the account-menu trigger is an avatar). No exclamation marks, emoji, American spellings or medical promises in the components, gallery or screens. Copy is verb-first on buttons, past tense where it confirms, and "we" and "you" in the right places. Focus relies on the global `:focus-visible` rule and every interactive element in the new screens is reachable by it. Dialog and Sheet close buttons are now `size-control-sm` (36px) [2026-11]; that debt is removed.

**Findings**

1. `components/ui/page-header.tsx:41`. Description is capped at `62ch`; the design system says near 65 characters.
2. `components/ui/button.tsx:22`. The ghost variant sets `tracking-[0.12em]`, which differs from the `button-label` 0.16em. Not in the reference README.
3. `components/ui/alert.tsx:7`. `Alert` has no icon requirement, so its status relies on colour plus text only; the reference says status carries an icon and a word. It is also not in the reference system.
4. `components/ui/stat-card.tsx:40`. The link variant repeats the `Card` class string instead of reusing it, so a change to `Card` will not reach linked stat cards.
5. `components/ui/avatar.tsx:29`. `text-xs` is Tailwind's size, not a type utility, and `font-semibold` is a raw weight. No avatar initials style exists in the type scale.
6. `components/ui/order-steps.tsx:21`. Labels use raw `text-xs` instead of a type utility. Step state now has a screen-reader word per step ("done", "current step", "not started") [2026-11]; sighted users still see state by colour alone.
7. `components/shell/user-menu.tsx:31`. "Profile (coming soon)" is a disabled menu item with the status in its label, not `ComingSoon`, because a menu item cannot host the tooltip. Accepted; it differs from every other unbuilt control.
8. `app/clinic/page.tsx:120-124`. On the "Results to review" stat card the `urgent` red number is the only cue, but the context line "N with out-of-range values" is beside it, so status is not colour alone. Listed so it is not changed to rely on the number.
9. `components/shell/sidebar-content.tsx:35`, `components/shell/notifications-bell.tsx:41`. Raw `font-semibold` on the user name and on unread notification titles instead of a type utility. Sidebar sub-lines and the clinic page now use `type-small`; unread items now also carry a screen-reader "(unread)" [2026-11].

**Arbitrary pixel values not backed by a design-system value**

Backed and therefore not listed: switch 40 by 22 and 18px thumb (FilterChips README), 15px card meta icons (Card README), 520px sheet (Dialog README), sparkline 96 by 28 and 1.5 stroke, 36px avatar (`control-height-sm`).

| Where | Value | Note |
|---|---|---|
| `dialog.tsx:49` | `max-w-[min(480px,…)]`, `p-7` (28px) | Dialog width not in the reference; 28px is off the listed `space-*` steps |
| `sheet.tsx:38`, `sheet.tsx:40` | left sheet `w-[280px]` | Mobile nav width not in the reference |
| `wordmark.tsx:14,29` | `aspect-[869/371]`, `w-[148px]` | Both follow the supplied logo, not a token. The ratio is the file's own 869 by 371 and keeps the mask from distorting; 148px is the display width chosen for it. The reference has no logo size [2026-11] |
| `button.tsx:79` | spinner `size-3.5` (14px) | No icon token |
| `alert.tsx:7`, `dropdown-menu.tsx:45`, `sonner.tsx:13-17` | icons `size-4` (16px) | `icon-size` is 18px, pills 12px; 16px is a third size |
| `alert-bar.tsx:8` | `gap-3.5`, `px-4.5`, `py-3.5`, `min-w-50` | 14px and 18px steps are off the listed `space-*` scale |
| `alert.tsx:7`, `input.tsx:11`, `textarea.tsx:10` | `px-3.5`, `py-3`, `min-h-30` | Same: off-scale padding; textarea minimum height 120px not specified |
| `sparkline.tsx` | dot `r="3"`, inset 2px and 3px | Not specified beyond "last point emphasised" |
| `components/shell/notifications-bell.tsx:29`, `app/(auth)/layout.tsx:24` | bell `size-5` (20px); auth card `max-w-[420px]`, `p-8` | Icon is a fourth size; 420px and 32px padding not in the reference |
| `components/shell/sidebar-content.tsx:22,25`, `nav.tsx:81`, `app-shell.tsx:42` | `pt-7`, `pb-5`, `mt-2.5`, `pt-4.5`, `mb-9` | Off the listed `space-*` steps |
| `components/shell/location-switcher.tsx:29,31,36,41`, `app/portal/page.tsx:180`, `app/clinic/page.tsx:133,230,232` | icons `size-3.5` (14px); spacer `size-4` | Fifth icon size; spacer width matches the 16px menu icons |
| `app/(auth)/layout.tsx:14,18` | `p-7`, `shell:p-12`, `max-w-[12ch]` | 28px and 48px padding; 12ch hero width not specified |
| `app/clinic/page.tsx:214` | `w-18` | Fixed time column, 72px |

## Findings (inconsistencies between code and reference)

- `docs/CONTEXT.md` Findings 3 and 5 settle two points: the token wins over the shadcn mapping (`--secondary` stays bronze, shadcn's role is `--secondary-role`), and the prototype's sign-in gradient is replaced by a flat `surface-inverse` panel. This document follows both. [2026-11]
- `docs/reference/design-system/README.md:110` says no logo file exists and sets a typeset wordmark at "22–26px"; `components/SidebarNav/README.md:8` specifies the same wordmark at 26px. Both are read only and are superseded by the clinic-supplied `public/brand/schoemanClinic-logo.png`, which `Wordmark` now renders at 148px wide. The README's `assets/Logos` location was not used; the files live in `public/brand/`. [2026-11]
- The default `Wordmark` shows the logo's own charcoal from the image file, so that colour does not follow the `content` or `primary` tokens. Accepted as a supplied brand asset; `inverse` does follow its token. [2026-11]
- Reference `radius-full` and `radius-none` are Tailwind's built-in static utilities; they work because only the `--radius-*` theme values are cleared.
- `--spacing-*` entries for `control`, `pill`, `nav-row`, `table-row`, `topbar`, `sidebar` and `icon` are exposed as spacing so that `h-`, `w-` and `size-` utilities work; this also generates `p-control` and similar, which should not be used.
- Sidebar, top bar, `content-max` and `nav-row` tokens are now used by the shell. [2026-11]
- The reference describes sign-in as photography behind an overlay; the built screen is a flat `surface-inverse` panel with no image. [2026-11]
- Every unbuilt destination is a disabled control inside `ComingSoon`; nothing links to a page that does not exist.
