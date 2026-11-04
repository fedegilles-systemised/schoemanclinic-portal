/**
 * Email colours and fonts. Email clients do not support CSS variables or oklch, so these are
 * the sRGB equivalents of the design tokens in docs/reference/design-system/tokens.json.
 * They are the only raw colour values outside the stylesheet: change a token, change it here.
 */
export const emailTheme = {
  colour: {
    surface: "#FAF7F3", // surface
    raised: "#FCFAF6", // surface-raised
    sunken: "#EDEBE7", // surface-sunken
    border: "#DBD7D2", // surface-border
    content: "#171310", // content, primary
    muted: "#5A544F", // content-muted
    inverse: "#FAF7F3", // primary-content
    secondary: "#745338", // secondary (bronze)
    warningBg: "#F8E9D2", // status-warning-bg
    warning: "#8A5F28", // status-warning
  },
  font: {
    display: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    sans: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
} as const;
