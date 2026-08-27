// Merge variables — {{field}} tokens resolved from a contact, with an optional
// fallback ({{first_name|there}}). Concept borrowed from ChatbotX. Pure and
// shared by campaigns, macros, and saved replies so personalization behaves the
// same everywhere.

export interface MergeContact {
  display_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

/** Variables offered in composer UIs. */
export const MERGE_VARIABLES: { key: string; label: string }[] = [
  { key: "first_name", label: "First name" },
  { key: "name", label: "Full name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
];

/** Resolve one variable to its value for a contact, or null when unset. */
export function mergeValue(contact: MergeContact, key: string): string | null {
  switch (key.toLowerCase()) {
    case "first_name": {
      const name = contact.display_name?.trim();
      if (!name) return null;
      return name.split(/\s+/)[0];
    }
    case "name":
    case "full_name":
    case "display_name":
      return contact.display_name?.trim() || null;
    case "email":
      return contact.email?.trim() || null;
    case "phone":
      return contact.phone?.trim() || null;
    default:
      return null;
  }
}

/**
 * Replace every {{key}} / {{key|fallback}} token in `text` using the contact.
 * An unresolved variable becomes its fallback, or an empty string when none.
 * Also supports the legacy {username} token (→ first name / "there").
 */
export function renderMergeVariables(text: string, contact: MergeContact): string {
  const merged = text.replace(/\{\{\s*([\w]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}/g, (_m, key, fallback) => {
    const value = mergeValue(contact, key);
    if (value != null && value !== "") return value;
    return fallback != null ? fallback : "";
  });
  // Legacy {username} kept for backward compatibility with older drafts.
  return merged.replace(/\{username\}/gi, mergeValue(contact, "first_name") ?? "there");
}
