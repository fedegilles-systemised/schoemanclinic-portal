# AlertBar

A full-width bar that flags something the reader should act on or know before going further.

**Consumer provides:** the tone, an icon, a short bold lead and one line of text, and at most one action button.

- Tones: borderline (low supply, bloods due, overdue review), critical (urgent-care notice, out-of-range on a record), info (results pending release, guidance).
- 1px border and `stroke-accent` left edge in the status colour, filled with its `-bg`. Padding 14px 18px.
- Safeguarding alerts use the lock icon and always end with "Visible to clinicians only".
- Do: place it at the top of the section it concerns. Don't: stack more than two, or use it for success messages (use a toast).
