import type { Database } from "@/lib/database.types";

export type ConsentType = Database["public"]["Enums"]["consent_type"];

/** The wording below is this version. Change the version whenever the wording changes. */
export const CONSENT_VERSION = "2026-11";
export const PRIVACY_POLICY_URL = "https://theschoemanclinic.com/privacy/";
export const PRIVACY_CONTACT = "info@theschoemanclinic.com";

export const CONSENTS: Record<ConsentType, { title: string; description: string }> = {
  care: {
    title: "Using my information for my care",
    description:
      "The clinic team looking after you uses your details, results and notes to care for you. If you withdraw this, the clinic will contact you to talk it through, as we cannot safely care for you without it.",
  },
  partner_labs: {
    title: "Sharing with partner laboratories",
    description: "Your name, date of birth and the tests ordered are sent to the laboratory that processes your samples, and your results come back to the clinic.",
  },
  research: {
    title: "Anonymised research",
    description: "Results with your name and details removed may be used to improve care at the clinic. Saying no does not change your care.",
  },
};

export const CONSENT_TYPES = Object.keys(CONSENTS) as ConsentType[];
