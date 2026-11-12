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
  moved = false,
  portalUrl,
  bookedOnline = false,
}: Base & { firstName?: string; when: string; clinicianName: string; cancelled: boolean; moved?: boolean; portalUrl: string | null; bookedOnline?: boolean }): EmailContent {
  const hello = firstName ? `Dear ${firstName},` : "Hello,";
  const line = cancelled
    ? `Your appointment with ${clinicianName} on ${when} has been cancelled.`
    : moved
      ? `Your appointment has moved. It is now with ${clinicianName} on ${when}.`
      : `Your appointment with ${clinicianName} is booked for ${when}.`;
  const policy = cancelled
    ? "If you did not expect this, or would like a new time, please contact the clinic."
    : "If you need to change or cancel it, please contact the clinic at least 48 hours before.";
  const reason = "You are receiving this email because you have an appointment at The Schoeman Clinic.";
  const check = bookedOnline ? NOT_YOU : null;
  return {
    subject: cancelled ? "Your appointment has been cancelled" : moved ? "Your appointment has moved" : "Your appointment is booked",
    html: renderEmail({
      siteUrl,
      preheader: line,
      eyebrow: "Appointments",
      title: cancelled
        ? { before: "Appointment ", accent: "cancelled" }
        : moved
          ? { before: "Your appointment has ", accent: "moved" }
          : { before: "Your appointment is ", accent: "booked" },
      body:
        paragraph(escapeHtml(hello)) +
        paragraph(escapeHtml(line)) +
        paragraph(escapeHtml(policy)) +
        (check ? paragraph(escapeHtml(check)) : "") +
        (portalUrl ? button("View your appointments", portalUrl) : "") +
        paragraph(SIGN_OFF_HTML),
      reason,
    }),
    text: `${hello}\n\n${line}\n\n${policy}\n\n${check ? `${check}\n\n` : ""}${portalUrl ? `View your appointments: ${portalUrl}\n\n` : ""}${textFooter(reason)}`,
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

/** The clinic's inbox is told a question is waiting. It carries no name, subject or words of the question. */
export function questionAlertEmail({ siteUrl, questionsUrl }: Base & { questionsUrl: string }): EmailContent {
  const reason = "You are receiving this email because this address receives the clinic's portal questions.";
  const line = "A patient has asked a question in the portal. Sign in to Clinic Hub to read and reply.";
  return {
    subject: "A new question is waiting in Clinic Hub",
    html: renderEmail({
      siteUrl,
      preheader: line,
      eyebrow: "Ask the clinic",
      title: { before: "A new ", accent: "question" },
      body: paragraph("Hello,") + paragraph(escapeHtml(line)) + button("Open questions", questionsUrl) + paragraph(SIGN_OFF_HTML),
      reason,
    }),
    text: `Hello,\n\n${line}\n\nOpen questions: ${questionsUrl}\n\n${textFooter(reason)}`,
  };
}

/** A patient is told the clinic has replied. The reply itself stays in the portal. */
export function questionReplyEmail({
  siteUrl,
  firstName,
  portalUrl,
}: Base & { firstName?: string; portalUrl: string }): EmailContent {
  const hello = firstName ? `Dear ${firstName},` : "Hello,";
  const line = "The clinic has replied to your question. For your privacy, the reply is in your portal.";
  const reason = "You are receiving this email because you asked The Schoeman Clinic a question in your portal.";
  return {
    subject: "The clinic has replied to your question",
    html: renderEmail({
      siteUrl,
      preheader: line,
      eyebrow: "Ask the clinic",
      title: { before: "The clinic has ", accent: "replied" },
      body: paragraph(escapeHtml(hello)) + paragraph(escapeHtml(line)) + button("Read the reply", portalUrl) + paragraph(SIGN_OFF_HTML),
      reason,
    }),
    text: `${hello}\n\n${line}\n\nRead the reply: ${portalUrl}\n\n${textFooter(reason)}`,
  };
}

/** A patient is told a letter or document has been shared. Never its title, which may name a condition. */
export function documentSharedEmail({
  siteUrl,
  firstName,
  portalUrl,
}: Base & { firstName?: string; portalUrl: string }): EmailContent {
  const hello = firstName ? `Dear ${firstName},` : "Hello,";
  const line = "The clinic has shared a new letter or document with you in your portal.";
  const reason = "You are receiving this email because you have an account at The Schoeman Clinic.";
  return {
    subject: "A new document is in your portal",
    html: renderEmail({
      siteUrl,
      preheader: line,
      eyebrow: "Letters and documents",
      title: { before: "A new ", accent: "document" },
      body: paragraph(escapeHtml(hello)) + paragraph(escapeHtml(line)) + button("Open your documents", portalUrl) + paragraph(SIGN_OFF_HTML),
      reason,
    }),
    text: `${hello}\n\n${line}\n\nOpen your documents: ${portalUrl}\n\n${textFooter(reason)}`,
  };
}

/** The clinic's inbox is told a repeat prescription request needs the team. No name and no medicine. */
export function repeatPaidAlertEmail({ siteUrl, requestUrl, paid }: Base & { requestUrl: string; paid: boolean }): EmailContent {
  const reason = "You are receiving this email because this address receives the clinic's repeat prescription alerts.";
  const line = paid
    ? "A repeat prescription request has been paid for and is ready to be looked at. Sign in to Clinic Hub to see it."
    : "A patient has requested a repeat prescription. Online payment is not switched on, so please check the fee. Sign in to Clinic Hub to see it.";
  return {
    subject: paid ? "A paid repeat prescription request is waiting" : "A new repeat prescription request is waiting",
    html: renderEmail({
      siteUrl,
      preheader: line,
      eyebrow: "Prescriptions",
      title: paid ? { before: "A repeat request is ", accent: "paid" } : { before: "A new repeat ", accent: "request" },
      body: paragraph("Hello,") + paragraph(escapeHtml(line)) + button("Open the request", requestUrl) + paragraph(SIGN_OFF_HTML),
      reason,
    }),
    text: `Hello,\n\n${line}\n\nOpen the request: ${requestUrl}\n\n${textFooter(reason)}`,
  };
}

/** A patient is told their repeat request and payment have reached the clinic. */
export function repeatReceivedEmail({
  siteUrl,
  firstName,
  portalUrl,
}: Base & { firstName?: string; portalUrl: string }): EmailContent {
  const hello = firstName ? `Dear ${firstName},` : "Hello,";
  const line = "Thank you. We have received your repeat prescription request and your payment. The clinic will review it, and you can follow its progress in your portal.";
  const reason = "You are receiving this email because you requested a repeat prescription in your portal.";
  return {
    subject: "We have received your repeat prescription request",
    html: renderEmail({
      siteUrl,
      preheader: line,
      eyebrow: "Prescriptions",
      title: { before: "Request ", accent: "received" },
      body: paragraph(escapeHtml(hello)) + paragraph(escapeHtml(line)) + button("Follow your request", portalUrl) + paragraph(SIGN_OFF_HTML),
      reason,
    }),
    text: `${hello}\n\n${line}\n\nFollow your request: ${portalUrl}\n\n${textFooter(reason)}`,
  };
}

const REPEAT_UPDATE_LINES = {
  approved: { subject: "Your repeat prescription request is approved", accent: "approved", line: "Your repeat prescription request has been approved. You can follow it in your portal until it goes to the pharmacy." },
  sent_to_pharmacy: { subject: "Your repeat prescription has gone to the pharmacy", accent: "sent", line: "Your repeat prescription has been sent to the pharmacy." },
  declined: { subject: "An update on your repeat prescription request", accent: "update", line: "There is an update on your repeat prescription request. For your privacy, the details are in your portal." },
} as const;

/** A patient is told their repeat request has moved on. The clinic's note stays in the portal. */
export function repeatUpdateEmail({
  siteUrl,
  firstName,
  portalUrl,
  status,
}: Base & { firstName?: string; portalUrl: string; status: keyof typeof REPEAT_UPDATE_LINES }): EmailContent {
  const hello = firstName ? `Dear ${firstName},` : "Hello,";
  const { subject, accent, line } = REPEAT_UPDATE_LINES[status];
  const reason = "You are receiving this email because you requested a repeat prescription in your portal.";
  return {
    subject,
    html: renderEmail({
      siteUrl,
      preheader: line,
      eyebrow: "Prescriptions",
      title: { before: "Your request: ", accent },
      body: paragraph(escapeHtml(hello)) + paragraph(escapeHtml(line)) + button("View your request", portalUrl) + paragraph(SIGN_OFF_HTML),
      reason,
    }),
    text: `${hello}\n\n${line}\n\nView your request: ${portalUrl}\n\n${textFooter(reason)}`,
  };
}

/** A patient is reminded, three weeks ahead, that a prescription will run out. Never which one. */
export function runOutReminderEmail({
  siteUrl,
  firstName,
  portalUrl,
}: Base & { firstName?: string; portalUrl: string }): EmailContent {
  const hello = firstName ? `Dear ${firstName},` : "Hello,";
  const line =
    "One of your prescriptions runs out within the next three weeks. Please request a repeat in your portal now, so there is time to prepare it and send it to you.";
  const reason = "You are receiving this email because you have a prescription with The Schoeman Clinic.";
  return {
    subject: "Time to request your repeat prescription",
    html: renderEmail({
      siteUrl,
      preheader: line,
      eyebrow: "Prescriptions",
      title: { before: "Time to ", accent: "reorder" },
      body: paragraph(escapeHtml(hello)) + paragraph(escapeHtml(line)) + button("Request a repeat", portalUrl) + paragraph(SIGN_OFF_HTML),
      reason,
    }),
    text: `${hello}\n\n${line}\n\nRequest a repeat: ${portalUrl}\n\n${textFooter(reason)}`,
  };
}

/** A patient is asked for feedback after an appointment, or reminded once. */
export function feedbackRequestEmail({
  siteUrl,
  firstName,
  surveyUrl,
  reminder,
}: Base & { firstName?: string; surveyUrl: string; reminder: boolean }): EmailContent {
  const hello = firstName ? `Dear ${firstName},` : "Hello,";
  const line = reminder
    ? "A few days ago we asked how your recent appointment went. We would value your answer if you have a moment. It takes less than a minute, and every answer is read by the clinic."
    : "Thank you for your recent appointment. We would value a minute of your time to hear how it went. Every answer is read by the clinic.";
  const reason = "You are receiving this email because you recently had an appointment with The Schoeman Clinic.";
  return {
    subject: reminder ? "A reminder: how was your appointment?" : "How was your appointment?",
    html: renderEmail({
      siteUrl,
      preheader: line,
      eyebrow: "Your feedback",
      title: { before: "How did we ", accent: "do" },
      body: paragraph(escapeHtml(hello)) + paragraph(escapeHtml(line)) + button("Share your feedback", surveyUrl) + paragraph(SIGN_OFF_HTML),
      reason,
    }),
    text: `${hello}\n\n${line}\n\nShare your feedback: ${surveyUrl}\n\n${textFooter(reason)}`,
  };
}

/** The clinic inbox is told that feedback needs a follow-up. No name and nothing the patient wrote. */
export function feedbackAlertEmail({ siteUrl, feedbackUrl, urgent }: Base & { feedbackUrl: string; urgent: boolean }): EmailContent {
  const reason = "You are receiving this email because this address receives the clinic's patient feedback alerts.";
  const line = urgent
    ? "A patient's feedback needs a follow-up today. Sign in to Clinic Hub to read it and record the follow-up."
    : "A patient's feedback needs a follow-up within two working days. Sign in to Clinic Hub to read it and record the follow-up.";
  return {
    subject: urgent ? "Patient feedback to follow up today" : "Patient feedback to follow up",
    html: renderEmail({
      siteUrl,
      preheader: line,
      eyebrow: "Patient feedback",
      title: { before: "Feedback to ", accent: "follow up" },
      body: paragraph("Hello,") + paragraph(escapeHtml(line)) + button("Open the feedback", feedbackUrl) + paragraph(SIGN_OFF_HTML),
      reason,
    }),
    text: `Hello,\n\n${line}\n\nOpen the feedback: ${feedbackUrl}\n\n${textFooter(reason)}`,
  };
}

/** Online bookings need no account, so every confirmation asks the patient to report one they did not make (S-192). */
const NOT_YOU = "This appointment was booked on our website. If you did not book it, please contact the clinic so we can cancel it.";

/** A new patient who booked online is told it is booked and what happens next. No portal link yet. */
export function onlineBookingEmail({
  siteUrl,
  firstName,
  when,
  clinicianName,
}: Base & { firstName?: string; when: string; clinicianName: string }): EmailContent {
  const hello = firstName ? `Dear ${firstName},` : "Hello,";
  const line = `Your appointment with ${clinicianName} is booked for ${when}.`;
  const next =
    "Before your appointment the clinic will be in touch to confirm your details and invite you to your patient portal, where you will find forms to complete and, later, your results.";
  const policy = "If you need to change or cancel it, please contact the clinic at least 48 hours before.";
  const reason = "You are receiving this email because an appointment was booked with this email address on The Schoeman Clinic's website.";
  return {
    subject: "Your appointment is booked",
    html: renderEmail({
      siteUrl,
      preheader: line,
      eyebrow: "Appointments",
      title: { before: "Your appointment is ", accent: "booked" },
      body:
        paragraph(escapeHtml(hello)) +
        paragraph(escapeHtml(line)) +
        paragraph(escapeHtml(next)) +
        paragraph(escapeHtml(policy)) +
        paragraph(escapeHtml(NOT_YOU)) +
        paragraph(SIGN_OFF_HTML),
      reason,
    }),
    text: `${hello}\n\n${line}\n\n${next}\n\n${policy}\n\n${NOT_YOU}\n\n${textFooter(reason)}`,
  };
}
