// Conversational form field types + parsing (feature 5).

export const FIELD_TYPES = ["text", "email", "number", "phone"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
}

function slugKey(v: unknown, fallback: string): string {
  const s = typeof v === "string" ? v.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_") : "";
  return s.replace(/^_+|_+$/g, "").slice(0, 40) || fallback;
}

/** Safely parse a form's fields jsonb into typed FormField[]. */
export function parseFormFields(raw: unknown): FormField[] {
  if (!Array.isArray(raw)) return [];
  const out: FormField[] = [];
  raw.forEach((f, i) => {
    if (!f || typeof f !== "object") return;
    const o = f as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim().slice(0, 160) : "";
    if (!label) return;
    const type = FIELD_TYPES.includes(o.type as FieldType)
      ? (o.type as FieldType)
      : "text";
    out.push({
      key: slugKey(o.key, `field_${i + 1}`),
      label,
      type,
      required: o.required === true,
    });
  });
  return out;
}

/** Validate a single answer against a field. Returns an error message or null. */
export function validateAnswer(field: FormField, value: string): string | null {
  const v = value.trim();
  if (!v) return field.required ? "This field is required" : null;
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return "Please enter a valid email";
  }
  if (field.type === "number" && !/^-?\d+(\.\d+)?$/.test(v)) {
    return "Please enter a number";
  }
  return null;
}
