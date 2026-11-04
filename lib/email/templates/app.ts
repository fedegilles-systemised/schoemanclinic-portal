import {
  button,
  escapeHtml,
  fineprint,
  linkFallback,
  paragraph,
  renderEmail,
  type EmailContent,
} from "@/lib/email/layout";

/**
 * The emails Clinic Hub sends itself, through Resend (lib/email/send.ts). Rules for every
 * one: never a result, a value, a diagnosis or a medicine. Say that something is ready and
 * link to the portal. Addresses come from the site's own address (SITE_URL), never from a
 * request, so a forged header cannot change where a link goes.
 */

type Base = { siteUrl: string };

function textFooter(reason: string): string {
  return `${reason}\n\nThe Schoeman Clinic · A private Harley Street and Wimbledon clinic, London.\n`;
}

/** A person is invited to create an account. */
export function invitationEmail({
  siteUrl,
  firstName,
  inviterName,
  audience,
  acceptUrl,
  expiresInDays,
}: Base & {
  firstName?: string;
  inviterName?: string;
  audience: "patient" | "guardian" | "team";
  acceptUrl: string;
  expiresInDays: number;
}): EmailContent {
  const hello = firstName ? `Hello ${firstName},` : "Hello,";
  const who = inviterName ? `${inviterName} at The Schoeman Clinic` : "The Schoeman Clinic";
  const what =
    audience === "patient"
      ? "set up your account on the clinic's patient portal, where you can follow your appointments, tests and letters"
      : audience === "guardian"
        ? "set up your account on the clinic's patient portal, where you can see and manage the account of someone you look after"
        : "set up your account on the clinic's team portal";
  const dobNote =
    audience === "patient"
      ? " You will be asked for your date of birth."
      : audience === "guardian"
        ? " You will be asked for the patient's date of birth."
        : "";
  const expiry = `This link works once and expires in ${expiresInDays} ${expiresInDays === 1 ? "day" : "days"}.${dobNote}`;
  const reason = "You are receiving this email because the clinic invited this address to create an account.";

  return {
    subject: "Your invitation to The Schoeman Clinic",
    html: renderEmail({
      siteUrl,
      preheader: "Set up your account at The Schoeman Clinic.",
      eyebrow: "Invitation",
      title: { before: "Welcome to ", accent: "The Schoeman Clinic" },
      body:
        paragraph(escapeHtml(hello)) +
        paragraph(`${escapeHtml(who)} has invited you to ${what}. You will choose your own password.`) +
        button("Set up your account", acceptUrl) +
        linkFallback(acceptUrl) +
        fineprint(`${escapeHtml(expiry)} If you were not expecting this, you can ignore this email.`),
      reason,
    }),
    text: `${hello}\n\n${who} has invited you to ${what}. You will choose your own password.\n\nSet up your account: ${acceptUrl}\n\n${expiry} If you were not expecting this, you can ignore this email.\n\n${textFooter(reason)}`,
  };
}

/** A guardian is told that the clinic has confirmed their access to a patient's account. */
export function guardianAccessEmail({
  siteUrl,
  guardianFirstName,
  patientFirstName,
  canAct,
  signInUrl,
}: Base & {
  guardianFirstName?: string;
  patientFirstName: string;
  canAct: boolean;
  signInUrl: string;
}): EmailContent {
  const hello = guardianFirstName ? `Hello ${guardianFirstName},` : "Hello,";
  const scope = canAct
    ? "view their portal, and ask the clinic questions, request repeat prescriptions and pay on their behalf"
    : "view their portal";
  const reason = "You are receiving this email because the clinic confirmed your access to a patient's account.";

  return {
    subject: `Your access to ${patientFirstName}'s account at The Schoeman Clinic`,
    html: renderEmail({
      siteUrl,
      preheader: `The clinic has confirmed your access to ${patientFirstName}'s account.`,
      eyebrow: "Guardian access",
      title: { before: "Your access is ", accent: "confirmed" },
      body:
        paragraph(escapeHtml(hello)) +
        paragraph(`The Schoeman Clinic has confirmed you as a guardian for ${escapeHtml(patientFirstName)}. You can ${scope}.`) +
        button("Sign in", signInUrl) +
        fineprint("If you did not expect this, please contact the clinic."),
      reason,
    }),
    text: `${hello}\n\nThe Schoeman Clinic has confirmed you as a guardian for ${patientFirstName}. You can ${scope}.\n\nSign in: ${signInUrl}\n\nIf you did not expect this, please contact the clinic.\n\n${textFooter(reason)}`,
  };
}

/** A patient is told that a result has been shared. It carries no value or verdict. */
export function resultReadyEmail({
  siteUrl,
  firstName,
  portalUrl,
}: Base & { firstName?: string; portalUrl: string }): EmailContent {
  const hello = firstName ? `Hello ${firstName},` : "Hello,";
  const reason = "You are receiving this email because you have an account at The Schoeman Clinic.";

  return {
    subject: "A new result is ready in your portal",
    html: renderEmail({
      siteUrl,
      preheader: "Sign in to see it.",
      eyebrow: "Your results",
      title: { before: "A new result is ", accent: "ready" },
      body:
        paragraph(escapeHtml(hello)) +
        paragraph("A doctor at The Schoeman Clinic has reviewed one of your tests and shared it with you in your portal.") +
        button("View in your portal", portalUrl) +
        fineprint("For your privacy, we never send results by email. You will be asked to sign in."),
      reason,
    }),
    text: `${hello}\n\nA doctor at The Schoeman Clinic has reviewed one of your tests and shared it with you in your portal.\n\nView in your portal: ${portalUrl}\n\nFor your privacy, we never send results by email. You will be asked to sign in.\n\n${textFooter(reason)}`,
  };
}
