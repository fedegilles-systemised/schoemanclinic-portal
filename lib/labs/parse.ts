/**
 * Reads what a lab posts. Every lab names its fields a little differently, so a name is compared
 * without case, spaces or punctuation (date_of_birth, dateOfBirth and DOB all match). Nothing here
 * touches a database or a file, so it is easy to check on its own.
 */

export type LabReport = {
  name: string | null;
  email: string | null;
  dateOfBirth: string | null;
  reportId: string | null;
  sampleDate: string | null;
  testName: string | null;
};

const KEYS = {
  fullName: ["name", "fullname", "patientname", "patient"],
  firstName: ["firstname", "givenname", "forename", "patientfirstname"],
  lastName: ["lastname", "surname", "familyname", "patientlastname"],
  email: ["email", "patientemail", "emailaddress"],
  dateOfBirth: ["dateofbirth", "dob", "birthdate", "patientdob", "birthday"],
  reportId: ["reportid", "externalid", "reference", "orderid", "accession", "accessionnumber", "labreference", "id"],
  sampleDate: ["sampledate", "collectiondate", "collected", "collectedat", "datecollected"],
  testName: ["testname", "test", "panel", "panelname", "producttype", "product"],
  file: ["file", "pdf", "report", "document", "attachment", "filebase64", "pdfbase64", "base64"],
} as const;

export function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(fields: Map<string, string>, names: readonly string[]): string | null {
  for (const name of names) {
    const value = fields.get(name);
    if (value !== undefined && value.trim() !== "") return value.trim();
  }
  return null;
}

/** An ISO date, or a day-first date as written in the UK (14/03/1974, 14-03-1974 or 14.03.1974). Anything else is null. */
export function parseDate(value: string | null): string | null {
  if (!value) return null;
  const text = value.trim();
  let year: number, month: number, day: number;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(text);
  if (m) {
    [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
    if (!m) return null;
    [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (year < 1900 || date.getTime() > Date.now()) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The report's details from a map of the posted fields (names already passed through normaliseKey). */
export function readReport(fields: Map<string, string>): LabReport {
  const first = pick(fields, KEYS.firstName);
  const last = pick(fields, KEYS.lastName);
  const name = pick(fields, KEYS.fullName) ?? ([first, last].filter(Boolean).join(" ") || null);
  const email = pick(fields, KEYS.email);
  return {
    name: name ? name.slice(0, 200) : null,
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 254) : null,
    dateOfBirth: parseDate(pick(fields, KEYS.dateOfBirth)),
    reportId: pick(fields, KEYS.reportId)?.slice(0, 200) ?? null,
    sampleDate: parseDate(pick(fields, KEYS.sampleDate)),
    testName: pick(fields, KEYS.testName)?.slice(0, 200) ?? null,
  };
}

/** The base64 text of a posted PDF, without any data: prefix, or null when the field holds nothing like it. */
export function readBase64Pdf(fields: Map<string, string>): string | null {
  const raw = pick(fields, KEYS.file);
  if (!raw) return null;
  const text = raw.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  return /^[A-Za-z0-9+/_-]+={0,2}$/.test(text) && text.length >= 8 ? text : null;
}

export const FILE_FIELD_NAMES: readonly string[] = KEYS.file;

/** True when the bytes begin like a PDF. A name or a declared type is never taken on trust. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length > 8 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
}

function nameWords(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

/** True when every word of the patient's first and last name appears in the name the lab wrote, in any order ("Hart, Eleanor" matches). */
export function namesAgree(labName: string | null, first: string, last: string): boolean {
  if (!labName) return false;
  const words = new Set(nameWords(labName));
  const wanted = [...nameWords(first), ...nameWords(last)];
  return wanted.length > 0 && wanted.every((w) => words.has(w));
}
