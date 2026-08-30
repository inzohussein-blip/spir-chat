// Auto-label matching. Pure + testable; the inbound handlers apply the result.

export interface LabelRule {
  keyword: string;
  label_id: string;
}

/**
 * Return the distinct label ids whose keyword appears (case-insensitive,
 * substring) in the message text. Empty keywords never match.
 */
export function matchLabelRules(rules: LabelRule[], text: string | null | undefined): string[] {
  if (!text) return [];
  const hay = text.toLowerCase();
  const out = new Set<string>();
  for (const rule of rules) {
    const kw = rule.keyword.trim().toLowerCase();
    if (kw && hay.includes(kw)) out.add(rule.label_id);
  }
  return [...out];
}
