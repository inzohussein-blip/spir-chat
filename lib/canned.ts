// Canned responses (saved replies) — shared helpers.

export interface CannedResponseItem {
  id: string;
  short_code: string;
  content: string;
}

/**
 * Filter saved replies for the composer picker. A leading "/" is treated as the
 * shortcut prefix (Chatwoot-style), so "/hi" matches the short code "hi". The
 * match is case-insensitive across both the short code and the content.
 */
export function filterCannedResponses<T extends CannedResponseItem>(
  items: T[],
  query: string
): T[] {
  const q = query.trim().replace(/^\//, "").toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.short_code.toLowerCase().includes(q) ||
      item.content.toLowerCase().includes(q)
  );
}

/** True when the composer text is acting as a saved-reply shortcut ("/...\"). */
export function isCannedShortcut(text: string): boolean {
  return /^\/\S*$/.test(text.trim());
}
