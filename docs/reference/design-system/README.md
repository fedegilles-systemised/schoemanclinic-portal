The design system for The Schoeman Clinic's patient and clinic portals. It carries the clinic website's look into a working product: warm stone grounds, charcoal ink, bronze accents, light serif titles and square-cornered controls. Quiet luxury private medicine, calm and precise.

## Principles

- **Calm before clever.** Generous space, thin borders, one main action per screen. Nothing shouts except a result that needs attention.
- **Clinical truth first.** Every value shows its unit and reference range. Status is never colour alone.
- **One brand, two portals.** Patients and clinicians see the same tokens and components; the clinic portal is denser, not different.
- **Borders, not shadows.** Separation comes from `surface-border` hairlines and space. No drop shadows, no gradients.

## Voice and copy

- Write in British English: programme, colour, organise, haematocrit, oestradiol.
- Address patients as "you" and the clinic as "we" ("We reply within 2 working days"). Clinician screens use plain labels, no "we".
- Sentence case for titles and body. UPPERCASE only for `eyebrow`, `button-label` and `pill-label` text.
- Buttons say exactly what happens, verb first: PAY NOW — £295.00, RELEASE TO PATIENT, REQUEST REPEAT. Confirm with a toast in the past tense: "Released to Amira Haddad."
- Titles may carry one italic accent word set in `secondary`: "Your *results*", "Good morning, *Eleanor*". One per title, never in body copy.
- Dates as 29 Oct 2026, long form as Thursday 29 October 2026. Times as 10:30. Money as £295.00.
- Explain results in plain English for patients ("Your average blood sugar over the last two to three months"). Keep clinical terms for clinicians.
- No emoji, no exclamation marks, no medical promises.

## Colour

Six groups, 27 tokens. Pick by role, never by hue.

| Group | Tokens | Use |
| --- | --- | --- |
| Primary | `primary`, `primary-hover`, `primary-content` | Charcoal. The one main action per screen, selected chips, count badges. |
| Secondary | `secondary`, `secondary-border`, `secondary-content` | Bronze. Secondary buttons, bronze text and the accent word, focus ring, hover and active states, the main chart line. |
| Accent | `accent`, `accent-subtle`, `accent-content` | Champagne. Decoration only: highlights on dark imagery, the reference-range band. |
| Status | `status-success`, `status-warning`, `status-danger`, `status-info`, each with `-bg` | Results, order states, alerts, errors. Always with an icon and a word. |
| Content | `content`, `content-muted`, `content-inverse` | All text and icons. |
| Surface | `surface`, `surface-raised`, `surface-sunken`, `surface-selected`, `surface-inverse`, `surface-border`, `surface-overlay` | Grounds, raised panels, quiet fills, selected rows, dark bands, hairlines, scrims. |

- Put `content` and `content-muted` on any surface; both pass AA everywhere. Use `content-inverse` on `surface-inverse`, `primary`, `secondary` and `status-danger` fills.
- Never set text in `accent` on a light surface (1.9:1). Use `secondary` for bronze text.
- Status pairs: `status-*` for text and icons on its `status-*-bg` fill or on `surface`.
- There is no bright brand colour: no orange, purple or blue accents.
- Charts: main series `secondary`, reference range `accent-subtle`, further series `status-info` then `content-muted`, gridlines `surface-border`.

Mapping to the shadcn/ui variables used in code:

| shadcn variable | Token |
| --- | --- |
| `--background` | `surface` |
| `--card`, `--popover` | `surface-raised` |
| `--foreground` | `content` |
| `--muted` | `surface-sunken` |
| `--muted-foreground` | `content-muted` |
| `--primary` / `--primary-foreground` | `primary` / `primary-content` |
| `--secondary` | `surface-selected` |
| `--accent` / `--accent-foreground` | `accent` / `accent-content` |
| `--border`, `--input` | `surface-border` |
| `--ring` | `secondary-border` |
| `--destructive` | `status-danger` |

## Typography

- Two families: `display` (Cormorant Garamond, light) and `sans` (Inter).
- Use `display` only for `hero-title`, `page-title`, `section-title` and `card-display`. Never for numbers, tables, buttons or any text under 20px.
- Everything else is `sans`: `body` for reading, `small` for meta, `table` and `value` for data, `big-number` for stat tiles, `card-title` for card headings.
- Set numbers with `font-variant-numeric: tabular-nums` wherever they line up.
- `eyebrow` sits above every page title and labels form fields and table headers. It is uppercase with wide tracking.
- Headings get `text-wrap: balance`. Keep running text near 65 characters.

## Layout and spacing

- 8px grid (`space-1` to `space-12`). Card padding and gaps `space-6`; sections `space-12` apart; page padding `space-10` on desktop, `space-5` on phones.
- App shell: sidebar `sidebar-width` on the left, `topbar-height` top bar, content up to `content-max`. Below 900px the sidebar becomes a slide-in menu.
- Put the summary before the detail: stat cards, then what needs attention, then lists.
- Grids collapse to one column on phones. Wide tables scroll inside their own container.

## Shape, borders and depth

- Square corners: `radius-none` on buttons, inputs, chips, tabs and dialogs. `radius-card` (4px) on cards only. `radius-pill` (2px) on pills. The switch is the only fully rounded control (`radius-full`).
- Hairlines (`stroke-hairline`, `surface-border`) around cards, tables and inputs. `stroke-control` (2px) on every button and the focus ring.
- `stroke-accent` (3px) appears only on the left of alert bars and at-risk order cards, in the status colour.
- No shadows. Raised panels are `surface-raised` on `surface` with a border.

## States and interaction

- Hover: clickable cards turn their border `secondary-border`; table rows fill `surface-sunken`; primary buttons go `primary-hover`; outline buttons fill.
- Focus: a 2px `secondary-border` outline with 2px offset on every interactive element.
- Selected: `surface-selected` fill with a 2px `secondary-border` bar or underline.
- Disabled: 45% opacity, no pointer.
- Empty states are a dashed `surface-border` box with one line saying what will appear and how to add it.
- Motion: 150ms ease-out on hover and focus only; side sheets slide in at 200ms. Respect reduced motion.

## Clinical data

- Every result shows value, unit and reference range (`43 mmol/mol · 20–41`). Use UK units: mmol/mol, mmol/L, nmol/L, µg/L, pmol/L, mIU/L.
- Status is colour, icon and word together: IN RANGE (check, `status-success`), BORDERLINE (minus, `status-warning`), OUT OF RANGE (alert triangle, `status-danger`).
- Show trend with a sparkline in tables and a full chart with the `accent-subtle` band in detail views. Emphasise the latest point and label it.
- Patients only see results a doctor has released. Unreleased results show a neutral note, never the value.
- Safeguarding alerts carry a lock icon and the line "Visible to clinicians only".
- Mark demo or test data with a `surface-inverse` banner: "Demo environment · fictional data".

## Iconography

- Use lucide icons, outline style, 1.5 stroke (`stroke-icon`), at `icon-size` (18px), in `content-muted` unless active. Pills use 12px icons.
- Icons support a label; they never replace one, except the close and menu buttons, which carry an accessible name.
- No emoji, no filled or duotone icons.

## Imagery

- Photography sits behind a dark `surface-inverse` overlay with `content-inverse` text and the accent word in `accent`, as on the sign-in panel.
- No illustrations, mascots or stock icons of doctors.

## Brand assets

- No logo file is in this system yet. Set the name as a wordmark: "The" in `eyebrow` style above "Schoeman Clinic" in `display` at 22–26px. Add the official logo files to an `assets/Logos` group when the clinic supplies them.

## Accessibility

- Text meets 4.5:1 on its surface; large display text 3:1. `accent` and `surface-border` are decorative and never carry meaning alone.
- Input borders (`surface-border`) sit below 3:1, so every field keeps a visible label and gets the `secondary-border` border on focus.
- Status always pairs colour with an icon and a word.
- Tap targets are at least `control-height-sm` (36px); primary controls `control-height` (44px).


---

## Consuming this system (generated — do not edit)

Every path named below is under `project/` in this design system: read `project/api/tokens.md`, not `api/tokens.md`.

13 components are documented without a runnable `components/bundle.js`: read each component’s card, and its README where it has one (`components/<Comp>/README.md`), and build to those guidelines. Tokens: the values are on `api/tokens.md`; a Slides deck or Design canvas also takes `tokens.json` by file path. On a Design canvas, also copy `tokens.css` to `project/ds/<folder>/tokens.css` in the call that installs this system, and link it in each artboard that uses this system, right after the `support.js` line and before the system’s other stylesheets: `<link rel="stylesheet" href="ds/<folder>/tokens.css">` (with one `../` in front for each folder the artboard is in).

Fonts: `tokens.css` loads each font from its file, by path.

- **Design canvas:** copy `fonts/cormorant-garamond-latin-300-normal.woff2`, `fonts/cormorant-garamond-latin-300-italic.woff2`, `fonts/cormorant-garamond-latin-500-normal.woff2`, `fonts/inter-latin-400-normal.woff2`, `fonts/inter-latin-500-normal.woff2` and `fonts/inter-latin-600-normal.woff2` to the same paths under the canvas’s `project/ds/<folder>/` (`<folder>` is the folder you install this system under; `fonts/cormorant-garamond-latin-300-normal.woff2` lands on `project/ds/<folder>/fonts/cormorant-garamond-latin-300-normal.woff2`), in the same call that installs this system; the copy of `tokens.css` that each artboard links loads them from there. If the install’s reply leaves a font out, bring that font in as for any other page.
- **Slides deck:** for each family you use in the deck (`faces` holds at most the number of typefaces Slides’ `deck-files.md` gives), install its file with the system and name the path it lands on as that family’s `src` in `project/deck.json` `faces`, under the key in the Slides column. A deck takes a font as a file only under the rule in Slides’ `fonts.md` (no space or leading underscore in its path, for two): any other font, or one kept by id, is uploaded as `fonts.md` says.
- **Any other page:** one file per family is enough (below: the upright face nearest regular weight; bold and italic synthesize). Fetch it as the fetch column says (Artifact tool `read`, that id or path as `path`), upload it as an asset (`publish`, `file_path`, `asset:true`) and declare it with an `@font-face { font-family: "<family>"; src: url(<uploaded>) }` rule.

| family | file | fetch | CSS | Slides `faces` key |
| --- | --- | --- | --- | --- |
| Cormorant Garamond | `fonts/cormorant-garamond-latin-300-normal.woff2` (weight 300) | `read` the file with `project/` in front | `var(--font-display)` | `cormorant-garamond` |
| Inter | `fonts/inter-latin-400-normal.woff2` (weight 400) | `read` the file with `project/` in front | `var(--font-sans)` | `inter` |

**Read, per thing:** a component’s props, parts and examples: `api/components/<Comp>.md`; token values: `api/tokens.md`. After this README, fetch the cards and fonts you need in ONE message as parallel calls — none depends on another.

**Two rules.** Before you use a thing — a component, a token group, an icon, an asset — read its card from the index below; a value you did not read from a card is a guess. `tokens.json`, `manifest.json` and `design-system.json` are sources for tools: hand them over. `components/<Comp>/README.md` is the long-form second read a card links to; `SKILL.md` and `artifact-type/` beside them are authoring guidance, not needed to consume the system.

## Index (generated — do not edit)

**Tokens**

- `api/tokens.md` — Every token: surface, fill, palette, type, spacing, radius, size, stroke. (13.7k)

**Components** (`api/components/<Comp>.md`, 13)

- **Status**: `AlertBar` — A full-width bar that flags something the reader should act on or know before going further · `StatusPill` — A small uppercase label that states the status of a result, order or item with colour, icon and word together
- **Actions**: `Button` — Square, uppercase action buttons in six variants, matching the clinic website's buttons
- **Layout**: `Card` — The raised container for one thing: an appointment, an order, a medication, a summary
- **Overlays**: `Dialog` — A centred panel for a short confirmation or a small form, over the surface-overlay scrim
- **Forms**: `FilterChips` — Square chips that filter a list, plus the square toggle used for on/off settings and consents · `Input` — Text fields, selects and text areas with a visible uppercase label above
- **Data**: `OrderSteps` — A thin progress line that shows where a lab order is: Ordered, Paid, Sample taken, Results in · `ResultChart` — A line chart of one marker over time with its reference range behind it · `ResultsTable` — The table pattern for results, orders, patients and any list people scan and open · `StatCard` — A compact card with one headline number, used at the top of dashboards and for a marker at a glance
- **Navigation**: `SidebarNav` — The left navigation of both portals: wordmark, portal label, navigation rows and the signed-in user · `Tabs` — An underlined row of uppercase labels that switches between views of the same thing
