# Dialog

A centred panel for a short confirmation or a small form, over the `surface-overlay` scrim. Side sheets use the same parts, 520px wide on the right.

**Consumer provides:** an eyebrow, a title (with an optional accent word), the body, a primary action and a cancel action.

- `surface` fill, 1px `surface-border`, `radius-none`, padding 28px, no shadow. Close button top right with an accessible name; Escape closes.
- Title in `section-title`. Actions bottom left, primary first.
- Destructive confirmations state the consequence ("Cancellations within 48 hours may be charged in full") and use the destructive button.
- Side sheets hold detail views: a marker's chart and history, a letter, checkout.
