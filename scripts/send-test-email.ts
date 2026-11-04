/**
 * Sends one sample email through Resend, to check the domain and the key work:
 *   pnpm email:test <invitation|guardian|result> <to>
 * It reads RESEND_API_KEY, EMAIL_FROM and SITE_URL from .env.local and really sends the
 * email, so use an address you own.
 */
import { Resend } from "resend";

import { guardianAccessEmail, invitationEmail, resultReadyEmail } from "@/lib/email/templates/app";

const [kind, to] = process.argv.slice(2);
const { RESEND_API_KEY, EMAIL_FROM, SITE_URL, EMAIL_REPLY_TO } = process.env;

if (!kind || !to || !RESEND_API_KEY || !EMAIL_FROM || !SITE_URL) {
  console.error("Usage: pnpm email:test <invitation|guardian|result> <to>   (needs RESEND_API_KEY, EMAIL_FROM and SITE_URL in .env.local)");
  process.exit(1);
}

const siteUrl = SITE_URL.replace(/\/$/, "");
// Plain constants, so their types stay narrowed inside the function below.
const apiKey: string = RESEND_API_KEY;
const from: string = EMAIL_FROM;
const recipient: string = to;
const samples = {
  invitation: () => invitationEmail({ siteUrl, firstName: "Test", inviterName: "The clinic team", audience: "patient", acceptUrl: `${siteUrl}/login`, expiresInDays: 7 }),
  guardian: () => guardianAccessEmail({ siteUrl, guardianFirstName: "Test", patientFirstName: "Sample", canAct: false, signInUrl: `${siteUrl}/login` }),
  result: () => resultReadyEmail({ siteUrl, firstName: "Test", portalUrl: `${siteUrl}/portal` }),
} as const;

if (!(kind in samples)) {
  console.error(`Unknown template "${kind}". Choose invitation, guardian or result.`);
  process.exit(1);
}

async function main() {
  const content = samples[kind as keyof typeof samples]();
  const { data, error } = await new Resend(apiKey).emails.send({
    from,
    to: recipient,
    subject: `[Test] ${content.subject}`,
    html: content.html,
    text: content.text,
    replyTo: EMAIL_REPLY_TO || undefined,
  });

  if (error || !data) {
    console.error("Resend refused the email:", error?.message ?? "no response");
    process.exit(1);
  }
  console.log(`Sent ${kind} to ${recipient} (id ${data.id}).`);
}

// Not top-level await: the project's scripts run as CommonJS.
main().catch((cause: unknown) => {
  console.error("The test email could not be sent:", cause instanceof Error ? cause.message : cause);
  process.exit(1);
});
