import { button, codeBlock, details, fineprint, linkFallback, paragraph, renderEmail } from "@/lib/email/layout";

/**
 * The emails the sign-in service sends. They are written with Supabase's template
 * placeholders ({{ .SiteURL }} and the like), which Supabase fills in when it sends. They
 * are built into supabase/templates/ by `pnpm email:build`, so edit this file, not those.
 * The same files are pasted into the hosted project's Auth email templates.
 */

const SITE = "{{ .SiteURL }}";

export type AuthTemplate = { subject: string; html: string };

export const authTemplates = {
  recovery: {
    file: "recovery.html",
    subject: "Reset your password",
    html: () => {
      const link = `${SITE}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password`;
      return renderEmail({
        siteUrl: SITE,
        preheader: "Choose a new password for your account.",
        eyebrow: "Password reset",
        title: { before: "Choose a new ", accent: "password" },
        body:
          paragraph("We received a request to reset the password for your account at The Schoeman Clinic.") +
          paragraph("Use the button below to choose a new one. The link works once and expires after an hour.") +
          button("Reset password", link) +
          linkFallback(link) +
          fineprint("If you did not ask for this, you can ignore this email. Your password has not changed."),
        reason: "You are receiving this email because a password reset was requested for this address.",
      });
    },
  },

  email_change: {
    file: "email_change.html",
    subject: "Confirm the change of your email address",
    html: () => {
      const link = `${SITE}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change`;
      return renderEmail({
        siteUrl: SITE,
        preheader: "Confirm the new email address for your account.",
        eyebrow: "Email address",
        title: { before: "Confirm your new ", accent: "email address" },
        body:
          paragraph("A change to the email address you use to sign in to The Schoeman Clinic was requested.") +
          details([
            { label: "Current", value: "{{ .Email }}" },
            { label: "New", value: "{{ .NewEmail }}" },
          ]) +
          paragraph("To finish the change, confirm it with the button below. If you receive a second email about this change, confirm that one too.") +
          button("Confirm the change", link) +
          linkFallback(link) +
          fineprint("If you did not ask for this, do not use the link and contact the clinic."),
        reason: "You are receiving this email because a change of email address was requested on your account.",
      });
    },
  },

  reauthentication: {
    file: "reauthentication.html",
    subject: "Your confirmation code",
    html: () =>
      renderEmail({
        siteUrl: SITE,
        preheader: "Your one-time confirmation code.",
        eyebrow: "Security check",
        title: { before: "Your ", accent: "confirmation code" },
        body:
          paragraph("Enter this code to confirm that it is you. It works once and expires after an hour.") +
          codeBlock("{{ .Token }}") +
          fineprint("If you did not ask for this code, change your password and tell the clinic. Do not share the code with anyone."),
        reason: "You are receiving this email because a security check was started on your account.",
      }),
  },

  password_changed: {
    file: "password_changed_notification.html",
    subject: "Your password has been changed",
    html: () =>
      renderEmail({
        siteUrl: SITE,
        preheader: "The password for your account was changed.",
        eyebrow: "Account security",
        title: { before: "Your password ", accent: "has changed" },
        body:
          paragraph("The password for {{ .Email }} at The Schoeman Clinic was changed. If this was you, there is nothing more to do.") +
          paragraph("If it was not you, reset your password now and contact the clinic.") +
          button("Reset password", `${SITE}/forgot-password`) +
          fineprint("For your safety, this email never contains your password."),
        reason: "You are receiving this email because the password on your account changed.",
      }),
  },
} as const satisfies Record<string, { file: string; subject: string; html: () => string }>;
