import { contactLineText } from "@/lib/email/contact";
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

/** Every email closes the same way: a sign-off, then phone, email and WhatsApp (added by the layout). */
const SIGN_OFF_HTML = "Regards,<br />The Schoeman Clinic team";
const SIGN_OFF_TEXT = "Regards,\nThe Schoeman Clinic team";

function textFooter(reason: string): string {
  return `${SIGN_OFF_TEXT}\n\n${contactLineText}\n\n${reason}\n\nThe Schoeman Clinic · A private Harley Street and Wimbledon clinic, London.\n`;
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
  const hello = firstName ? `Dear ${firstName},` : "Hello,";
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
        paragraph(SIGN_OFF_HTML) +
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
  const hello = guardianFirstName ? `Dear ${guardianFirstName},` : "Hello,";
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
        paragraph(SIGN_OFF_HTML) +
        fineprint("If you did not expect this, please contact the clinic."),
      reason,
    }),
    text: `${hello}\n\nThe Schoeman Clinic has confirmed you as a guardian for ${patientFirstName}. You can ${scope}.\n\nSign in: ${signInUrl}\n\nIf you did not expect this, please contact the clinic.\n\n${textFooter(reason)}`,
  };
}

/** The clinic's lead is told that a doctor or an admin has been invited. */
export function teamInviteAlertEmail({
  siteUrl,
  inviterName,
  invitedEmail,
  roleLabel,
  teamUrl,
}: Base & { inviterName: string; invitedEmail: string; roleLabel: string; teamUrl: string }): EmailContent {
  const reason = "You are receiving this email because the clinic asked to be told whenever a doctor or an admin is invited.";
  const line = `${inviterName} invited ${invitedEmail} to join the team as ${roleLabel === "Admin" ? "an admin" : "a doctor"}.`;

  return {
    subject: `${roleLabel} invitation sent: ${invitedEmail}`,
    html: renderEmail({
      siteUrl,
      preheader: line,
      eyebrow: "Team",
      title: { before: "A new ", accent: roleLabel.toLowerCase(), after: " was invited" },
      body:
        paragraph("Hello,") +
        paragraph(escapeHtml(line)) +
        paragraph("If you did not expect this, cancel the invitation from Team and settings before it is accepted.") +
        button("Open Team and settings", teamUrl) +
        paragraph(SIGN_OFF_HTML),
      reason,
    }),
    text: `Hello,\n\n${line}\n\nIf you did not expect this, cancel the invitation from Team and settings before it is accepted.\n\nOpen Team and settings: ${teamUrl}\n\n${textFooter(reason)}`,
  };
}

/** A patient's appointment is booked, or cancelled by the team. Time and clinician only: never the type, which may hint at a condition. */
export function appointmentEmail({
  siteUrl,
  firstName,
  when,
  clinicianName,
  cancelled,
  portalUrl,
}: Base & { firstName?: string; when: string; clinicianName: string; cancelled: boolean; portalUrl: string }): EmailContent {
  const hello = firstName ? `Dear ${firstName},` : "Hello,";
  const line = cancelled
    ? `Your appointment with ${clinicianName} on ${when} has been cancelled.`
    : `Your appointment with ${clinicianName} is booked for ${when}.`;
  const policy = cancelled
    ? "If you did not expect this, or would like a new time, please contact the clinic."
    : "If you need to change or cancel it, please contact the clinic at least 48 hours before.";
  const reason = "You are receiving this email because you have an appointment at The Schoeman Clinic.";
  return {
    subject: cancelled ? "Your appointment has been cancelled" : "Your appointment is booked",
    html: renderEmail({
      siteUrl,
      preheader: line,
      eyebrow: "Appointments",
      title: cancelled ? { before: "Appointment ", accent: "cancelled" } : { before: "Your appointment is ", accent: "booked" },
      body:
        paragraph(escapeHtml(hello)) +
        paragraph(escapeHtml(line)) +
        paragraph(escapeHtml(policy)) +
        button("View your appointments", portalUrl) +
        paragraph(SIGN_OFF_HTML),
      reason,
    }),
    text: `${hello}\n\n${line}\n\n${policy}\n\nView your appointments: ${portalUrl}\n\n${textFooter(reason)}`,
  };
}

/** A patient is told that a result has been shared. It carries no value or verdict. */
export function resultReadyEmail({
  siteUrl,
  firstName,
  portalUrl,
}: Base & { firstName?: string; portalUrl: string }): EmailContent {
  const hello = firstName ? `Dear ${firstName},` : "Hello,";
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
        paragraph(SIGN_OFF_HTML) +
        fineprint("For your privacy, we never send results by email. You will be asked to sign in."),
      reason,
    }),
    text: `${hello}\n\nA doctor at The Schoeman Clinic has reviewed one of your tests and shared it with you in your portal.\n\nView in your portal: ${portalUrl}\n\nFor your privacy, we never send results by email. You will be asked to sign in.\n\n${textFooter(reason)}`,
  };
}
