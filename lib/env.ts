import { z } from "zod";

/**
 * Environment validation. Every check runs inside a function, never at import
 * time, so a build or a test run does not fail because of a variable it does
 * not use.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_DEMO: z.enum(["true", "false"]).optional(),
});

const supabaseServerSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const emailSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  /** The site's public address, for links and the logo in emails. Never taken from a request. */
  SITE_URL: z.url(),
  /** Where replies go. Leave out if nobody reads replies. */
  EMAIL_REPLY_TO: z.string().min(1).optional(),
});

const sessionSchema = z.object({
  // Signs the session-limit cookies. Any random string of 32 characters or more.
  SESSION_COOKIE_SECRET: z.string().min(32),
});

const googleSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  // Encrypts each staff member's Google token before it is stored: 32 random bytes, base64.
  // `openssl rand -base64 32`. Changing it disconnects everyone's calendar.
  GOOGLE_TOKEN_ENCRYPTION_KEY: z
    .string()
    .refine((value) => Buffer.from(value, "base64").length === 32, "must be 32 bytes, base64"),
  /** The site's public address. The OAuth callback is built from it, never from a request. */
  SITE_URL: z.url(),
  /**
   * Optional. When set, only Google accounts in this Google Workspace domain can be connected
   * (for example theschoemanclinic.com), so patient details stay in accounts the clinic controls.
   */
  GOOGLE_WORKSPACE_DOMAIN: z
    .string()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "must be a domain like example.com")
    .optional(),
});

const ghlSchema = z.object({
  // A GoHighLevel Private Integration token for the clinic's sub-account, with contacts and
  // conversation-message write scopes. Settings > Private Integrations in GoHighLevel.
  GHL_PRIVATE_TOKEN: z.string().min(1),
  GHL_LOCATION_ID: z.string().min(1),
});

const transcriptionSchema = z.object({
  // AssemblyAI, EU region: call recordings are transcribed there. Needs a data processing agreement.
  ASSEMBLYAI_API_KEY: z.string().min(1),
  // Sent back by AssemblyAI with each finished transcript, so nobody else can post one. 32+ characters.
  TRANSCRIPTION_WEBHOOK_SECRET: z.string().min(32),
  SITE_URL: z.url(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error("Server-only environment variables were read in the browser.");
  }
}

function formatIssues(error: z.ZodError): string {
  // Names only: a validation message must never contain a secret value.
  return error.issues.map((issue) => issue.path.join(".")).join(", ");
}

/** Public variables. Next.js inlines these only when referenced by full name. */
export function getPublicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_DEMO: process.env.NEXT_PUBLIC_DEMO,
  });
  if (!parsed.success) {
    throw new Error(`Invalid public environment: ${formatIssues(parsed.error)}`);
  }
  return parsed.data;
}

/** Server-only Supabase variables, for lib/supabase/admin.ts. */
export function getSupabaseServerEnv(): z.infer<typeof supabaseServerSchema> {
  assertServer();
  const parsed = supabaseServerSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${formatIssues(parsed.error)}`);
  }
  return parsed.data;
}

/** Server-only email variables, for lib/email/send.ts. */
export function getEmailEnv(): z.infer<typeof emailSchema> {
  assertServer();
  const parsed = emailSchema.safeParse({
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    SITE_URL: process.env.SITE_URL,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Invalid email environment: ${formatIssues(parsed.error)}`);
  }
  return parsed.data;
}

/** Server-only Google Calendar variables, for lib/calendar/. */
export function getGoogleEnv(): z.infer<typeof googleSchema> {
  assertServer();
  const parsed = googleSchema.safeParse({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_TOKEN_ENCRYPTION_KEY: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
    SITE_URL: process.env.SITE_URL,
    GOOGLE_WORKSPACE_DOMAIN: process.env.GOOGLE_WORKSPACE_DOMAIN || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Invalid Google environment: ${formatIssues(parsed.error)}`);
  }
  return parsed.data;
}

/** True when every Google Calendar variable is set, so the screen can say it is not set up. */
export function isGoogleConfigured(): boolean {
  assertServer();
  return googleSchema.safeParse({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_TOKEN_ENCRYPTION_KEY: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
    SITE_URL: process.env.SITE_URL,
    GOOGLE_WORKSPACE_DOMAIN: process.env.GOOGLE_WORKSPACE_DOMAIN || undefined,
  }).success;
}

/** Server-only GoHighLevel variables, for lib/ghl/. */
export function getGhlEnv(): z.infer<typeof ghlSchema> {
  assertServer();
  const parsed = ghlSchema.safeParse({
    GHL_PRIVATE_TOKEN: process.env.GHL_PRIVATE_TOKEN,
    GHL_LOCATION_ID: process.env.GHL_LOCATION_ID,
  });
  if (!parsed.success) {
    throw new Error(`Invalid GoHighLevel environment: ${formatIssues(parsed.error)}`);
  }
  return parsed.data;
}

/** True when GoHighLevel is connected, so messages go through it and WhatsApp is offered. */
export function isGhlConfigured(): boolean {
  assertServer();
  return ghlSchema.safeParse({
    GHL_PRIVATE_TOKEN: process.env.GHL_PRIVATE_TOKEN,
    GHL_LOCATION_ID: process.env.GHL_LOCATION_ID,
  }).success;
}

/** Server-only transcription variables, for lib/transcription/. */
export function getTranscriptionEnv(): z.infer<typeof transcriptionSchema> {
  assertServer();
  const parsed = transcriptionSchema.safeParse({
    ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY,
    TRANSCRIPTION_WEBHOOK_SECRET: process.env.TRANSCRIPTION_WEBHOOK_SECRET,
    SITE_URL: process.env.SITE_URL,
  });
  if (!parsed.success) {
    throw new Error(`Invalid transcription environment: ${formatIssues(parsed.error)}`);
  }
  return parsed.data;
}

export function isTranscriptionConfigured(): boolean {
  assertServer();
  return transcriptionSchema.safeParse({
    ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY,
    TRANSCRIPTION_WEBHOOK_SECRET: process.env.TRANSCRIPTION_WEBHOOK_SECRET,
    SITE_URL: process.env.SITE_URL,
  }).success;
}

/** Server-only session variables, for lib/supabase/session-cookies.ts. */
export function getSessionEnv(): z.infer<typeof sessionSchema> {
  assertServer();
  const parsed = sessionSchema.safeParse({
    SESSION_COOKIE_SECRET: process.env.SESSION_COOKIE_SECRET,
  });
  if (!parsed.success) {
    throw new Error(`Invalid session environment: ${formatIssues(parsed.error)}`);
  }
  return parsed.data;
}
