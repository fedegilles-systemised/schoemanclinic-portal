/**
 * Reads a panel list pasted from a spreadsheet (tab separated) or saved as CSV (comma or semicolon),
 * and checks every row. Pure: no database, no server code, so the screen and the server action use
 * the same rules. Nothing is written until an admin confirms the preview, and the server checks the
 * text again.
 */

export const MAX_IMPORT_ROWS = 200;
export const MAX_IMPORT_CHARS = 200_000;

export type PanelImportRow = {
  line: number;
  code: string;
  name: string;
  pricePence: number;
  fasting: boolean;
  tubes: string | null;
  preparation: string | null;
  sexRestriction: "F" | "M" | null;
  /** Empty when the sheet has no such column: the admin's choice on the form applies. */
  active: boolean | null;
  lab: string | null;
};

/** Which optional columns the sheet has. A column that is missing leaves an existing panel's value alone. */
export type PanelImportColumns = { fasting: boolean; tubes: boolean; preparation: boolean; sex: boolean };

export type PanelImportResult = { rows: PanelImportRow[]; errors: string[]; columns: PanelImportColumns };

const NO_COLUMNS: PanelImportColumns = { fasting: false, tubes: false, preparation: false, sex: false };

/** Splits text into rows of cells. Quoted cells may hold the delimiter, quotes ("") and line breaks. */
export function splitCells(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

/** A spreadsheet paste has tabs; a CSV file has commas or, in some locales, semicolons. */
function detectDelimiter(firstLine: string): string {
  const counts: [string, number][] = [
    ["\t", firstLine.split("\t").length],
    [";", firstLine.split(";").length],
    [",", firstLine.split(",").length],
  ];
  return counts.sort((a, b) => b[1] - a[1])[0]![0];
}

const COLUMN_ALIASES: Record<string, readonly string[]> = {
  code: ["code", "panel code", "test code"],
  name: ["name", "panel", "panel name", "test", "test name"],
  price: ["price", "price (£)", "price £", "cost", "fee"],
  fasting: ["fasting", "fasting needed", "fasting required", "fast"],
  tubes: ["tubes", "tube", "bottles", "samples"],
  preparation: ["preparation", "prep", "instructions", "patient instructions"],
  sex: ["sex", "for", "sex at birth", "restriction"],
  active: ["active", "orderable", "can be ordered", "available"],
  lab: ["lab", "laboratory", "lab partner"],
};

function normaliseHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function columnOf(headers: string[], key: keyof typeof COLUMN_ALIASES): number {
  return headers.findIndex((h) => COLUMN_ALIASES[key]!.includes(h));
}

const YES = new Set(["y", "yes", "true", "1", "x", "fasting"]);
const NO = new Set(["n", "no", "false", "0", ""]);

function yesNo(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (YES.has(v)) return true;
  if (NO.has(v)) return false;
  return null;
}

function sexOf(value: string): "F" | "M" | null | undefined {
  const v = value.trim().toLowerCase();
  if (["", "any", "all", "both", "-", "n/a"].includes(v)) return null;
  if (["f", "female", "women", "woman"].includes(v)) return "F";
  if (["m", "male", "men", "man"].includes(v)) return "M";
  return undefined;
}

/** Pounds as typed: 295, 45.50, £1,200 (comma for thousands) or 12,50 (a decimal comma, as some spreadsheets save it). */
function priceOf(value: string): number | null {
  let cleaned = value.trim().replace(/^£\s*/, "");
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) cleaned = cleaned.replace(/,/g, "");
  else if (/^\d{1,5},\d{1,2}$/.test(cleaned)) cleaned = cleaned.replace(",", ".");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export function parsePanelImport(text: string): PanelImportResult {
  const errors: string[] = [];
  const clean = text.replace(/^﻿/, "");
  if (clean.trim() === "") return { rows: [], errors: ["Paste the panel list, or choose a CSV file."], columns: NO_COLUMNS };
  if (clean.length > MAX_IMPORT_CHARS) return { rows: [], errors: ["That list is too long. Split it into smaller files."], columns: NO_COLUMNS };

  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const table = splitCells(clean, detectDelimiter(firstLine));
  const headers = (table[0] ?? []).map(normaliseHeader);
  const col = {
    code: columnOf(headers, "code"),
    name: columnOf(headers, "name"),
    price: columnOf(headers, "price"),
    fasting: columnOf(headers, "fasting"),
    tubes: columnOf(headers, "tubes"),
    preparation: columnOf(headers, "preparation"),
    sex: columnOf(headers, "sex"),
    active: columnOf(headers, "active"),
    lab: columnOf(headers, "lab"),
  };
  const missing = (["code", "name", "price"] as const).filter((k) => col[k] === -1);
  if (missing.length > 0) {
    return { rows: [], errors: [`The first row must name the columns. Missing: ${missing.join(", ")}. Use code, name, price, fasting, tubes, preparation, sex.`], columns: NO_COLUMNS };
  }

  const dataRows = table.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  if (dataRows.length === 0) return { rows: [], errors: ["There are no panels under the column names."], columns: NO_COLUMNS };
  if (dataRows.length > MAX_IMPORT_ROWS) return { rows: [], errors: [`Import up to ${MAX_IMPORT_ROWS} panels at a time.`], columns: NO_COLUMNS };

  const rows: PanelImportRow[] = [];
  const seen = new Set<string>();
  const cell = (r: string[], i: number) => (i === -1 ? "" : (r[i] ?? "").trim());

  dataRows.forEach((r, index) => {
    const line = index + 2;
    const problems: string[] = [];
    const code = cell(r, col.code).toUpperCase();
    const name = cell(r, col.name);
    const price = priceOf(cell(r, col.price));
    const fasting = col.fasting === -1 ? false : yesNo(cell(r, col.fasting));
    const sex = col.sex === -1 ? null : sexOf(cell(r, col.sex));
    const active = col.active === -1 ? null : yesNo(cell(r, col.active));
    const tubes = cell(r, col.tubes);
    const preparation = cell(r, col.preparation);

    if (!/^[A-Z0-9-]{1,20}$/.test(code)) problems.push("the code needs up to 20 letters, numbers or hyphens");
    else if (seen.has(code)) problems.push(`the code ${code} appears twice`);
    if (name === "" || name.length > 120) problems.push("the name needs 1 to 120 characters");
    if (price === null) problems.push("the price must be in pounds, for example 295 or 45.50");
    if (fasting === null) problems.push("fasting must be yes or no");
    if (sex === undefined) problems.push("sex must be female, male or empty");
    if (col.active !== -1 && active === null) problems.push("orderable must be yes or no");
    if (tubes.length > 200) problems.push("tubes are over 200 characters");
    if (preparation.length > 1000) problems.push("the preparation is over 1,000 characters");

    if (problems.length > 0) {
      errors.push(`Row ${line}: ${problems.join("; ")}.`);
      return;
    }
    seen.add(code);
    rows.push({
      line,
      code,
      name,
      pricePence: price as number,
      fasting: fasting as boolean,
      tubes: tubes || null,
      preparation: preparation || null,
      sexRestriction: sex ?? null,
      active,
      lab: cell(r, col.lab) || null,
    });
  });

  return {
    rows,
    errors,
    columns: { fasting: col.fasting !== -1, tubes: col.tubes !== -1, preparation: col.preparation !== -1, sex: col.sex !== -1 },
  };
}
