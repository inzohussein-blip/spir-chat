// URL slug generation that preserves Arabic (and other Unicode) letters.

/** Turn a title into a slug: lowercase, Unicode letters/numbers, hyphens. */
export function slugify(input: string): string {
  const slug = (input || "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  // Fallback for titles that reduce to nothing (e.g. only punctuation).
  return slug || `item-${Math.random().toString(36).slice(2, 8)}`;
}
