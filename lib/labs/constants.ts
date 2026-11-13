/** Where a lab file alert goes when LAB_ALERT_TO is not set. */
export const LAB_ALERT_TO_DEFAULT = "info@theschoemanclinic.com";

/** The largest PDF taken. Vercel itself refuses a request body over about 4.5 MB, so a lab with larger reports sends a link instead. */
export const MAX_LAB_FILE_BYTES = 10 * 1024 * 1024;
