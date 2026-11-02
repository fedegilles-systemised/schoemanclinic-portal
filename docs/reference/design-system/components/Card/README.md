# Card

The raised container for one thing: an appointment, an order, a medication, a summary.

**Consumer provides:** an eyebrow, a title, the body (meta row, text, status pill) and actions at the bottom.

- `surface-raised` fill, 1px `surface-border`, `radius-card`, padding `space-6`, internal gap `space-3`, no shadow.
- Title in `card-title`, or `card-display` when the card names a product of care (an order, a medication).
- A meta row in `small` with 15px icons; a preparation or notes box in `surface-sunken`.
- Actions sit at the bottom, left aligned, `sm` buttons.
- Clickable cards turn their border `secondary-border` on hover and are a single link or button.
- Cards in a row share height and edges; let content set height. Don't nest cards or add a coloured left border.
