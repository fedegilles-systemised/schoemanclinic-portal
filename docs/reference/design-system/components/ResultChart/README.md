# ResultChart

A line chart of one marker over time with its reference range behind it.

**Consumer provides:** the marker name, unit, reference range (low, high or both) and dated values.

- Line 2px in `secondary`, points 3.5px with `surface-raised` fill; the latest point 5px in the status colour and labelled with value and unit.
- Reference range: a `accent-subtle` band with a `small` label inside its bottom edge. Ranges that vary by cycle get no band and say so.
- Faint horizontal grid in `surface-border`, axis text 11px `content-muted`, four to five ticks at round numbers. No legend for one series.
- Show it in the marker detail sheet with a table of previous values below and the doctor's comment.
