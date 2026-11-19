/**
 * The registration form every new patient completes (the clinic's own Semble form, recreated). Change the version
 * whenever the wording of the form or of the consent changes: it is stored with each registration.
 */
export const REGISTRATION_VERSION = "2026-11";

/** The clinic's own pages, linked from the consent. To be confirmed by the clinic as the final addresses. */
export const PRIVACY_NOTICE_URL = "https://theschoemanclinic.com/patient-terms-privacy/";
export const TERMS_URL = "https://theschoemanclinic.com/terms-of-treatment-and-fees/";

/** The choices for Title. The clinic's list is to be confirmed. */
export const TITLES = ["Mr", "Mrs", "Ms", "Miss", "Mx", "Dr", "Prof"] as const;

export const DEFAULT_COUNTRY = "United Kingdom";
