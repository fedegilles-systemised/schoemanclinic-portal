import localFont from "next/font/local";

export const fontDisplay = localFont({
  src: [
    { path: "../app/fonts/cormorant-garamond-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "../app/fonts/cormorant-garamond-latin-300-italic.woff2", weight: "300", style: "italic" },
    { path: "../app/fonts/cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-cormorant",
  display: "swap",
});

export const fontSans = localFont({
  src: [
    { path: "../app/fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../app/fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../app/fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});
