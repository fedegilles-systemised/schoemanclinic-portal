# Design system

How the Clinic Hub looks and is built. This describes the code as it stands in `app/globals.css`, `components/ui/` and `app/dev/ui/`. The source design system is `docs/reference/design-system/` (read only); where the two clash, the tokens win over the shadcn mapping (see Findings).

Last updated: [2026-11]. Owned by the `design-system-keeper` subagent.

**State of the build [2026-11].** Tokens, type utilities and 26 files in `components/ui/` exist, plus the dev gallery at `/dev/ui`. The app shell, sign-in and dashboards are **not built yet** (`components/shell/` does not exist; `app/` holds only the root layout, a placeholder page and `dev/ui`). Section 6 describes those screens as they appear in the prototype and the reference design system. None of it is implemented.

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
| `nav-row` | 40px | `h-nav-row` | Sidebar rows (not yet used) |
| `table-row` | 52px | `h-table-row` | Minimum table row (used in `TableCell`) |
| `topbar-height` | 64px | `h-topbar` | Top bar (not yet used) |
| `sidebar-width` | 264px | `w-sidebar` | Desktop sidebar (not yet used) |
| `content-max` | 1200px | `max-w-content` | Content width (not yet used) |
| `icon-size` | 18px | `size-icon` | Default icon; `.lucide` is set to this in the base layer |
| `stroke-hairline` | 1px | `border` | Cards, tables, inputs, dividers |
| `stroke-control` | 2px | `border-2` | Every button border |
| `stroke-accent` | 3px | `border-l-3` | Left edge of `AlertBar` (and at-risk order cards, not built) |
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

Sizes: `default` (`h-control`, 44px), `sm` (`h-control-sm`, 36px, inside cards and table rows), `icon` (36px square, muted, needs an accessible name). Props: `asChild`, `loading`. Ghost and link collapse their height.

### Status and feedback

- **StatusPill** (`status-pill.tsx`). Colour, icon and word together; not a button. Tones: `success`, `warning`, `danger`, `info`, `dark`, `neutral`. `icon` and `label` are required. `ResultStatusPill` is the fixed trio: IN RANGE (check, success), BORDERLINE (minus, warning), OUT OF RANGE (triangle alert, danger).
- **Badge** (`badge.tsx`). Counts and neutral tags only: `count`, `neutral`, `outline`. For a status use StatusPill.
- **AlertBar** (`alert-bar.tsx`). Full-width flag with icon, bold lead, one line and at most one action. Tones `warning`, `danger`, `info`. `role="status"`. No more than two stacked; never for success.
- **Alert** (`alert.tsx`). Form-level message block for errors above a submit button. Variants `danger`, `warning`, `info`, `success`. `role="alert"`. Not in the reference design system (see Findings).
- **DemoBanner** (`demo-banner.tsx`). `surface-inverse` strip reading "Demo environment · fictional data". Shown when `NEXT_PUBLIC_DEMO=true`.
- **Toaster** (`sonner.tsx`). Bottom-centre, `surface-inverse`, lucide icons. Confirms success in the past tense ("Released to Amira Haddad."). Sign-in errors never use toasts.
- **Tooltip** (`tooltip.tsx`). `surface-inverse`, `type-small`. For supporting hints only.
- **Skeleton**, **EmptyState**. See section 4.

### Layout and data

- **Card** (`card.tsx`). Raised container for one thing; never nested. Parts: `CardHeader`, `CardEyebrow`, `CardTitle`, `CardDisplayTitle` (a product of care), `CardDescription`, `CardContent`, `CardMeta` (small row with icons), `CardActions` (bottom, left aligned, `sm` buttons).
- **StatCard** (`stat-card.tsx`). Eyebrow label, `big-number` value, optional unit and context, optional pill or sparkline as children. `urgent` colours the number `status-danger` and only for counts needing action. With `href` it becomes a link card with a `secondary-border` hover.
- **Table** (`table.tsx`). Container scrolls horizontally on its own. Eyebrow headers, hairline row borders, `h-table-row` cells, `surface-sunken` hover on body rows. Parts: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`.
- **Sparkline** (`sparkline.tsx`). 96 by 28, 1.5px `secondary` line, last point in the tone colour (`default`, `warning`, `danger`). Decorative (`aria-hidden`): the value and status must sit beside it.
- **Avatar** (`avatar.tsx`). 36px round; fallback initials in `secondary` on `surface-selected`.
- **Separator** (`separator.tsx`). 1px `surface-border` line.
- **PageHeader / SectionHeader / AccentTitle** (`page-header.tsx`). `PageHeader` is an eyebrow plus the screen's one `type-page-title`, optional description (max `62ch`) and right-hand actions. `SectionHeader` is a `type-section-title` with right-hand content. `AccentTitle` splits a title into text, one italic `secondary` accent word and a suffix.
- **Wordmark** (`wordmark.tsx`). "The" in eyebrow style above "Schoeman Clinic" in display. `inverse` for dark grounds. Placeholder until the clinic supplies logo files.

### Forms and overlays

- **Input**, **Textarea**. `h-control` / `min-h-30`, `surface-raised`, hairline border, `secondary-border` on focus. Always with a visible **Label** (`type-eyebrow`, muted).
- **Switch** (`switch.tsx`). 40 by 22 track, 18px thumb, the only fully rounded control. Always beside a text label.
- **Tabs** (`tabs.tsx`). Underlined row of `type-button-label` triggers; active gets a 2px `secondary-border` underline. Tabs switch views; chips filter. FilterChips is **not built yet**.
- **Dialog** (`dialog.tsx`). Centred, up to 480px, `surface` with hairline border, `type-section-title` title, footer actions bottom left with the primary first, close button with accessible name.
- **Sheet** (`sheet.tsx`). Side panel on `surface`: `right` up to 520px with padding (forms and detail), `left` 280px (mobile navigation, no padding). Slides in at 200ms.
- **DropdownMenu** (`dropdown-menu.tsx`). `surface-raised`, hairline border, items in `type-table`, eyebrow labels, radio items selected on `surface-selected`.

### Documented in the reference system, not built

`FilterChips`, `OrderSteps`, `ResultChart`, `ResultsTable` (as a composed pattern; `Table` and `Sparkline` exist), `SidebarNav`, `Cover`.

## 6. Screen patterns

**None of these screens are built.** The patterns below come from `docs/reference/portal-prototype.html` and the reference component READMEs, and are the intent, not the code.

- **App shell.** Sidebar (`sidebar-width`, 264px) on the left with wordmark, portal label, rows of `nav-row` height and the signed-in user; `topbar-height` (64px) top bar; content to `content-max`. The current row has `surface-selected` and a 2px `secondary-border` bar. The clinic portal groups rows under eyebrows and shows counts. Below 900px the sidebar becomes a left `Sheet`. Not built; `components/shell/` does not exist.
- **Sign-in.** Photography behind a `surface-inverse` overlay with the accent word in `accent`, form beside it. Errors in an `Alert` above the button, never a toast. Not built.
- **Patient dashboard.** Page header with an accent word ("Good morning, *Eleanor*"), stat cards, then what needs attention (`AlertBar`), then lists. Not built.
- **Clinic dashboard.** Same shape, denser, with counts that link to lists. Not built.
- **Results.** Table of marker, latest value, unit, range, status pill, sparkline and date; a detail view with a full chart and an `accent-subtle` range band. Patients see only released results. Safeguarding alerts carry a lock icon and "Visible to clinicians only". Not built.

## 7. Known debt

Audit of `components/ui/` [2026-11], against raw colours, stray radii, shadows, gradients, focus and voice.

**Clean.** No raw colour values, hex, rgb or hsl, no Tailwind palette classes, no shadows, no gradients and no radius outside the token set. Every `rounded-*` is `none`, `pill`, `card`, `round` or `full`, and `full` appears only on the switch. No exclamation marks or emoji in the components or the gallery.

**Findings**

1. `components/ui/dialog.tsx:57` and `components/ui/sheet.tsx:48`. The close button is `size-8` (32px), under the 36px minimum tap target (`control-height-sm`). Use `size-control-sm`.
2. `components/ui/dropdown-menu.tsx:45`. Items use `outline-none` and rely on `data-highlighted` background. The design system asks for a focus ring on every interactive element; the background change is the only visible state.
3. `components/ui/page-header.tsx:41`. Description is capped at `62ch`; the design system says near 65 characters.
4. `components/ui/button.tsx:22`. The ghost variant sets `tracking-[0.12em]`, which differs from the `button-label` 0.16em. Not in the reference README.
5. `components/ui/alert.tsx:7`. `Alert` has no icon requirement, so its status relies on colour plus text only; the reference says status carries an icon and a word. It is also not in the reference system.
6. `components/ui/stat-card.tsx:40`. The link variant repeats the `Card` class string instead of reusing it, so a change to `Card` will not reach linked stat cards.
7. `components/ui/avatar.tsx:29`. `text-xs` is Tailwind's size, not a type utility, and `font-semibold` is a raw weight. No avatar initials style exists in the type scale.

**Arbitrary pixel values not backed by a design-system value**

Backed and therefore not listed: switch 40 by 22 and 18px thumb (FilterChips README), 15px card meta icons (Card README), 26px wordmark (SidebarNav README), 520px sheet (Dialog README), sparkline 96 by 28 and 1.5 stroke, 36px avatar (`control-height-sm`).

| Where | Value | Note |
|---|---|---|
| `dialog.tsx:49` | `max-w-[min(480px,…)]`, `p-7` (28px) | Dialog width not in the reference; 28px is off the listed `space-*` steps |
| `sheet.tsx:38`, `sheet.tsx:40` | left sheet `w-[280px]` | Mobile nav width not in the reference |
| `wordmark.tsx:8` | `leading-[1.05]`, `tracking-[-0.01em]` | Only the 26px size is specified |
| `button.tsx:79` | spinner `size-3.5` (14px) | No icon token |
| `alert.tsx:7`, `dropdown-menu.tsx:45`, `sonner.tsx:13-17` | icons `size-4` (16px) | `icon-size` is 18px, pills 12px; 16px is a third size |
| `alert-bar.tsx:8` | `gap-3.5`, `px-4.5`, `py-3.5`, `min-w-50` | 14px and 18px steps are off the listed `space-*` scale |
| `alert.tsx:7`, `input.tsx:11`, `textarea.tsx:10` | `px-3.5`, `py-3`, `min-h-30` | Same: off-scale padding; textarea minimum height 120px not specified |
| `sparkline.tsx` | dot `r="3"`, inset 2px and 3px | Not specified beyond "last point emphasised" |

## Findings (inconsistencies between code and reference)

- `docs/CONTEXT.md` is not present yet, so the token-over-shadcn rule cited by the design-system-keeper brief could not be read. This document follows the comment in `app/globals.css` (lines 50 to 53): `--secondary` stays bronze and shadcn's role is `--secondary-role`.
- The reference README lists a wordmark at "22–26px"; `Wordmark` fixes it at 26px.
- Reference `radius-full` and `radius-none` are Tailwind's built-in static utilities; they work because only the `--radius-*` theme values are cleared.
- `--spacing-*` entries for `control`, `pill`, `nav-row`, `table-row`, `topbar`, `sidebar` and `icon` are exposed as spacing so that `h-`, `w-` and `size-` utilities work; this also generates `p-control` and similar, which should not be used.
- Sidebar, top bar, `content-max` and `nav-row` tokens are defined but unused until the shell is built.
