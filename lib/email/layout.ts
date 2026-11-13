import { clinicContact } from "@/lib/email/contact";
import { emailTheme } from "@/lib/email/theme";

const { colour, font } = emailTheme;

export type EmailContent = { subject: string; html: string; text: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** An address inside an attribute. Template placeholders such as {{ .SiteURL }} pass through. */
function attribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** A paragraph of running text. The argument is HTML: escape anything a person typed. */
export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${font.sans};font-size:15px;line-height:24px;color:${colour.content}">${html}</p>`;
}

/** Small muted text for what is safe to ignore. */
export function fineprint(html: string): string {
  return `<p style="margin:24px 0 0;font-family:${font.sans};font-size:13px;line-height:20px;color:${colour.muted}">${html}</p>`;
}

/** The one main action: a square charcoal button, uppercase label, as in the portal. */
export function button(label: string, href: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:28px 0 8px"><tr><td bgcolor="${colour.content}" style="background-color:${colour.content}"><a href="${attribute(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${font.sans};font-size:11px;line-height:16px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;text-decoration:none;color:${colour.inverse}">${escapeHtml(label)}</a></td></tr></table>`;
}

/** The address under a button, for mail programmes that cannot show it. */
export function linkFallback(href: string): string {
  return `<p style="margin:16px 0 0;font-family:${font.sans};font-size:13px;line-height:20px;color:${colour.muted}">If the button does not work, copy this address into your browser:<br /><a href="${attribute(href)}" target="_blank" style="color:${colour.secondary};word-break:break-all">${escapeHtml(href)}</a></p>`;
}

/** A one-time code, set large with tabular figures. */
export function codeBlock(code: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tr><td bgcolor="${colour.sunken}" style="background-color:${colour.sunken};border:1px solid ${colour.border};padding:16px 28px;font-family:${font.sans};font-size:32px;line-height:36px;font-weight:500;letter-spacing:0.18em;color:${colour.content};font-variant-numeric:tabular-nums">${code}</td></tr></table>`;
}

/** Label and value pairs, for example the old and new address in a change of email. */
export function details(rows: { label: string; value: string }[]): string {
  const cells = rows
    .map(
      (row) =>
        `<tr><td style="padding:10px 16px 10px 0;border-top:1px solid ${colour.border};font-family:${font.sans};font-size:11px;line-height:16px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:${colour.muted};vertical-align:top;white-space:nowrap">${escapeHtml(row.label)}</td><td style="padding:10px 0;border-top:1px solid ${colour.border};font-family:${font.sans};font-size:14px;line-height:20px;color:${colour.content};word-break:break-all">${row.value}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 8px">${cells}</table>`;
}

/** The same closing contact line in every email: phone, email, WhatsApp. */
function contactBlock(): string {
  const link = (label: string, href: string) =>
    `<a href="${attribute(href)}" style="color:${colour.secondary};text-decoration:underline">${escapeHtml(label)}</a>`;
  return `<p style="margin:32px 0 0;padding-top:20px;border-top:1px solid ${colour.border};font-family:${font.sans};font-size:13px;line-height:20px;color:${colour.muted}">We are here if you need us. Phone ${link(clinicContact.phone.label, clinicContact.phone.href)}, email ${link(clinicContact.email.label, clinicContact.email.href)} or WhatsApp ${link(clinicContact.whatsapp.label, clinicContact.whatsapp.href)}.</p>`;
}

type RenderOptions = {
  /** The site's address, or a template placeholder, for the logo. */
  siteUrl: string;
  /** Shown beside the subject in most inboxes. */
  preheader: string;
  /** The small uppercase label above the title. */
  eyebrow: string;
  /** One italic bronze phrase at most, as in the portal's titles. */
  title: { before: string; accent?: string; after?: string };
  /** Built from the helpers above. */
  body: string;
  /** Why this person is receiving the email. */
  reason: string;
};

/** The page around every email, in the design system's type, colours and square corners. */
export function renderEmail({ siteUrl, preheader, eyebrow, title, body, reason }: RenderOptions): string {
  const heading =
    escapeHtml(title.before) +
    (title.accent
      ? `<em style="font-style:italic;color:${colour.secondary}">${escapeHtml(title.accent)}</em>`
      : "") +
    escapeHtml(title.after ?? "");

  return `<!DOCTYPE html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(title.before + (title.accent ?? "") + (title.after ?? ""))}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${colour.surface}">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(preheader)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:${colour.surface}">
      <tr>
        <td align="center" style="padding:32px 12px">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px">
            <tr>
              <td style="background-color:${colour.raised};border:1px solid ${colour.border};border-radius:4px;padding:40px">
                <img src="${attribute(siteUrl)}/brand/schoemanClinic-logo.png" alt="The Schoeman Clinic" width="148" height="63" style="display:block;border:0;outline:none;text-decoration:none;font-family:${font.display};font-size:22px;line-height:24px;color:${colour.content}" />
                <p style="margin:40px 0 0;font-family:${font.sans};font-size:11px;line-height:16px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:${colour.muted}">${escapeHtml(eyebrow)}</p>
                <h1 style="margin:6px 0 24px;font-family:${font.display};font-size:34px;line-height:38px;font-weight:300;letter-spacing:-0.02em;color:${colour.content}">${heading}</h1>
                ${body}
                ${contactBlock()}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 8px 0;font-family:${font.sans};font-size:12px;line-height:18px;color:${colour.muted}">
                <p style="margin:0 0 8px">${reason}</p>
                <p style="margin:0">The Schoeman Clinic · A private Harley Street, Wimbledon and virtual clinic, London.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}
