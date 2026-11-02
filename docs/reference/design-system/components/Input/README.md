# Input

Text fields, selects and text areas with a visible uppercase label above.

**Consumer provides:** the label, the value or placeholder, helper or counter text, and validation messages.

- Height `control-height`, 1px `surface-border` border, `surface-raised` fill, `radius-none`, padding 0 14px. Text in `body`.
- Label in `eyebrow` style, always visible (no floating or placeholder-only labels).
- Focus: border `secondary-border`. Error: border `status-danger` and a `small` message in `status-danger` below that says how to fix it.
- The `surface-border` border is below 3:1 on `surface-raised`; the label is what marks the field, so never drop it.
