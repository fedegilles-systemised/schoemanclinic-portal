# SidebarNav

The left navigation of both portals: wordmark, portal label, navigation rows and the signed-in user.

**Consumer provides:** the portal name, the navigation items (icon, label, optional count, optional group eyebrow) and the current user.

- Width `sidebar-width`, `surface` ground, 1px `surface-border` on the right.
- Wordmark: "The" in a tiny tracked uppercase line above "Schoeman Clinic" in `display` at 26px.
- Rows `nav-row` tall, 18px icons, `table` text in `content-muted`. Current page: `surface-selected` fill, `content` text and a 2px `secondary-border` bar on the left.
- Clinic portal groups rows under eyebrows (TODAY, PATIENTS, CLINICAL, CLINIC) and shows counts as small `content` squares.
- Below 900px it slides in from the left behind an `surface-overlay`.
