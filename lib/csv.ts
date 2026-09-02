// Minimal, dependency-free CSV parse/serialize. Handles quoted fields with
// embedded commas, quotes ("" escaping), and CR/LF newlines.

/** Parse CSV text into rows of string cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Normalize CRLF/CR to LF so newline handling is uniform.
  const s = text.replace(/\r\n?/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  // Flush the last field/row unless the input ended on a trailing newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Quote a single CSV cell when it contains a comma, quote, or newline. */
export function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serialize rows of cells into CSV text. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) => row.map((c) => csvCell(c == null ? "" : String(c))).join(","))
    .join("\n");
}

export interface ImportedContact {
  display_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  is_subscribed: boolean;
}

const HEADER_ALIASES: Record<string, keyof ImportedContact> = {
  name: "display_name",
  "display name": "display_name",
  "full name": "display_name",
  contact: "display_name",
  email: "email",
  "e-mail": "email",
  "email address": "email",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
  company: "company",
  organization: "company",
  organisation: "company",
  subscribed: "is_subscribed",
  "is subscribed": "is_subscribed",
};

const TRUE_VALUES = new Set(["1", "true", "yes", "y", "subscribed"]);

/**
 * Map parsed CSV rows (with a header row) into contact records. Unknown
 * columns are ignored; rows with neither an email nor a phone are dropped.
 */
export function contactsFromCsv(rows: string[][]): ImportedContact[] {
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const cols = header.map((h) => HEADER_ALIASES[h]);

  const out: ImportedContact[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => c.trim() === "")) continue;
    const rec: ImportedContact = {
      display_name: null,
      email: null,
      phone: null,
      company: null,
      is_subscribed: true,
    };
    let sawSubscribed = false;
    for (let i = 0; i < row.length; i++) {
      const key = cols[i];
      if (!key) continue;
      const raw = row[i].trim();
      if (key === "is_subscribed") {
        sawSubscribed = true;
        rec.is_subscribed = raw === "" ? true : TRUE_VALUES.has(raw.toLowerCase());
      } else if (raw !== "") {
        rec[key] = raw;
      }
    }
    if (!sawSubscribed) rec.is_subscribed = true;
    if (!rec.email && !rec.phone) continue;
    out.push(rec);
  }
  return out;
}
