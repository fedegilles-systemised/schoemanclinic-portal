# Button

Square, uppercase action buttons in six variants, matching the clinic website's buttons.

**Consumer provides:** the label (verb first, what will happen), the variant, an optional leading icon, and `sm` inside cards and table rows.

| Variant | Use |
| --- | --- |
| Primary (`primary` fill) | The one main action on a screen: PAY NOW, RELEASE TO PATIENT, SEND TO PATIENT |
| Secondary (`secondary` fill) | A positive secondary action: REQUEST REPEAT, CONFIRM |
| Outline (`content` border) | Secondary actions: DOWNLOAD FORM, VIEW DETAILS, MARK REVIEWED |
| Outline bronze (`secondary-border` border) | Tertiary actions: RESCHEDULE, CREATE FOLLOW-UP TASK |
| Ghost | Inline links and "view all" |
| Destructive (`status-danger` border) | CANCEL APPOINTMENT, REJECT. Always behind a confirmation |

- Height `control-height` (44px), `sm` `control-height-sm` (36px); padding `space-5`; `radius-none`; border `stroke-control`.
- Label in `button-label`: Inter 500, 11px, uppercase, 0.16em tracking. Put the price in the label when paying: "PAY NOW — £295.00".
- Hover: primary darkens to `primary-hover`; outline variants fill. Focus: `secondary-border`. Disabled: 45% opacity.
- Do: one primary per screen. Don't: round the corners, use more than one primary in a card, or write "Submit" or "OK".
