# ResultsTable

The table pattern for results, orders, patients and any list people scan and open.

**Consumer provides:** the columns, rows, an optional group heading row, and what opening a row does.

- No outer box. Header row in `eyebrow` style with a 1px `surface-border` bottom rule; rows at least `table-row` tall with hairline separators; hover fills `surface-sunken`.
- Results columns, in order: Marker, Latest (right aligned, `value`), Unit, Range, Status (`StatusPill`), Trend (sparkline), Date.
- Colour the latest value `status-danger` or `status-warning` when out of range, as well as the pill.
- Sparklines: 96 × 28, 1.5px `secondary` line, last point emphasised in the status colour.
- Wide tables scroll inside their own container. Group rows by panel with an eyebrow row.
