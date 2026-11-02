import "server-only";

import { Resend } from "resend";

import { getEmailEnv } from "@/lib/env";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Sends one email through Resend. Not wired to any flow yet. Emails must never
 * carry clinical values: link to the portal instead.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const env = getEmailEnv();
  const resend = new Resend(env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Email could not be sent." };
  }
  return { ok: true, id: data.id };
}
