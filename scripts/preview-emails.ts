/**
 * Writes every email, with sample data, to .email-preview/ so it can be opened in a browser.
 * Placeholders from the sign-in service are filled with examples.
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { authTemplates } from "@/lib/email/templates/auth";
import {
  guardianAccessEmail,
  invitationEmail,
  repeatPaidAlertEmail,
  repeatReceivedEmail,
  repeatUpdateEmail,
  resultReadyEmail,
  feedbackAlertEmail,
  onlineBookingEmail,
  feedbackRequestEmail,
  runOutReminderEmail,
} from "@/lib/email/templates/app";

// The previews are served from .email-preview/ itself (for example `python3 -m http.server 8765`),
// which holds a copy of the logo, so the images show without the site running.
const SITE = process.env.PREVIEW_URL ?? "http://localhost:8765";
const folder = path.join(process.cwd(), ".email-preview");
mkdirSync(path.join(folder, "brand"), { recursive: true });
copyFileSync(path.join(process.cwd(), "public", "brand", "schoemanClinic-logo.png"), path.join(folder, "brand", "schoemanClinic-logo.png"));

const samples: Record<string, { subject: string; html: string }> = {};

const placeholders: Record<string, string> = {
  "{{ .SiteURL }}": SITE,
  "{{ .TokenHash }}": "pkce_example_token_hash",
  "{{ .Token }}": "482 913",
  "{{ .Email }}": "alex@example.test",
  "{{ .NewEmail }}": "alex.new@example.test",
};

for (const [name, template] of Object.entries(authTemplates)) {
  let html = template.html();
  for (const [placeholder, value] of Object.entries(placeholders)) html = html.split(placeholder).join(value);
  samples[`auth-${name}`] = { subject: template.subject, html };
}
samples["app-invitation-patient"] = invitationEmail({ siteUrl: SITE, firstName: "Eleanor", inviterName: "Dr Gina Schoeman", audience: "patient", acceptUrl: `${SITE}/invite?token=example`, expiresInDays: 3 });
samples["app-invitation-guardian"] = invitationEmail({ siteUrl: SITE, firstName: "Mark", inviterName: "Priya Shah", audience: "guardian", acceptUrl: `${SITE}/invite?token=example`, expiresInDays: 3 });
samples["app-invitation-team"] = invitationEmail({ siteUrl: SITE, audience: "team", acceptUrl: `${SITE}/invite?token=example`, expiresInDays: 3 });
samples["app-guardian-access"] = guardianAccessEmail({ siteUrl: SITE, guardianFirstName: "Mark", patientFirstName: "Isla", canAct: true, signInUrl: `${SITE}/login` });
samples["app-result-ready"] = resultReadyEmail({ siteUrl: SITE, firstName: "Eleanor", portalUrl: `${SITE}/portal` });
samples["app-repeat-paid-alert"] = repeatPaidAlertEmail({ siteUrl: SITE, requestUrl: `${SITE}/clinic/prescriptions/example`, paid: true });
samples["app-repeat-received"] = repeatReceivedEmail({ siteUrl: SITE, firstName: "Eleanor", portalUrl: `${SITE}/portal/prescriptions/example` });
samples["app-repeat-approved"] = repeatUpdateEmail({ siteUrl: SITE, firstName: "Eleanor", portalUrl: `${SITE}/portal/prescriptions/example`, status: "approved" });
samples["app-repeat-sent"] = repeatUpdateEmail({ siteUrl: SITE, firstName: "Eleanor", portalUrl: `${SITE}/portal/prescriptions/example`, status: "sent_to_pharmacy" });
samples["app-repeat-declined"] = repeatUpdateEmail({ siteUrl: SITE, firstName: "Eleanor", portalUrl: `${SITE}/portal/prescriptions/example`, status: "declined" });
samples["app-feedback-request"] = feedbackRequestEmail({ siteUrl: SITE, firstName: "Eleanor", surveyUrl: `${SITE}/portal/feedback/example`, reminder: false });
samples["app-feedback-reminder"] = feedbackRequestEmail({ siteUrl: SITE, firstName: "Eleanor", surveyUrl: `${SITE}/portal/feedback/example`, reminder: true });
samples["app-feedback-alert"] = feedbackAlertEmail({ siteUrl: SITE, feedbackUrl: `${SITE}/clinic/feedback/example`, urgent: true });
samples["app-online-booking"] = onlineBookingEmail({ siteUrl: SITE, firstName: "Eleanor", when: "Tuesday 1 December at 10:00", clinicianName: "Dr Gina Schoeman" });
samples["app-run-out-reminder"] = runOutReminderEmail({ siteUrl: SITE, firstName: "Eleanor", portalUrl: `${SITE}/portal/prescriptions` });

for (const [name, sample] of Object.entries(samples)) writeFileSync(path.join(folder, `${name}.html`), sample.html);
writeFileSync(
  path.join(folder, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Email previews</title><body style="font-family:sans-serif;max-width:640px;margin:40px auto"><h1>Email previews</h1><ul>${Object.entries(samples)
    .map(([name, sample]) => `<li><a href="${name}.html">${name}</a> · ${sample.subject}</li>`)
    .join("")}</ul>`,
);
console.log(`Wrote ${Object.keys(samples).length} previews to .email-preview/ (open index.html).`);
