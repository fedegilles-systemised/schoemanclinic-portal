import type { Metadata } from "next";
import { connection } from "next/server";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fontDisplay, fontSans } from "@/lib/fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: "Clinic Hub · The Schoeman Clinic",
  description: "Patient and clinic portals for The Schoeman Clinic.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/favicon.png", apple: "/brand/favicon.png" },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Every page is rendered per request, so each one can carry its own CSP nonce.
  await connection();

  return (
    <html lang="en-GB" className={`${fontDisplay.variable} ${fontSans.variable}`}>
      <body>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
