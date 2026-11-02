# FilterChips

Square chips that filter a list, plus the rounded switch used for on/off settings and consents.

**Consumer provides:** the options (one selected, or several), and for the toggle its label and checked state.

- Chips: 32px tall, `radius-none`, 1px `surface-border`, `small` text. Selected chip: `content` fill, `content-inverse` text. Use `aria-pressed`.
- Switch: 40 × 22, fully rounded (`radius-full`) track with an 18px round thumb. Off: `surface-border` track. On: `secondary` track, thumb slides right. Always beside a text label that says what it controls. The switch is the one rounded control in the system.
- Chips filter; tabs switch views. Don't use chips for navigation.
