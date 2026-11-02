# StatusPill

A small uppercase label that states the status of a result, order or item with colour, icon and word together.

**Consumer provides:** the tone (`success`, `warning`, `danger`, `info`, `dark`, neutral), the label and the icon.

- Results always use the fixed trio: IN RANGE (check, `status-success`), BORDERLINE (minus, `status-warning`), OUT OF RANGE (alert, `status-danger`).
- Order and request states: AWAITING PAYMENT (borderline, clock), PAID (normal, check), RESULTS IN (info), RELEASED and REVIEWED (dark), MATCHED (info), NEEDS MATCH (borderline).
- Height `pill-height` (22px), `radius-pill`, text in `pill-label`, 12px icon. Text sits on the matching matching `-bg` fill.
- Do: keep the icon; the word is what screen readers and colour-blind users rely on. Don't: invent new colours or use a pill as a button.
