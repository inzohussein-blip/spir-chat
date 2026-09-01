// @mention matching for internal notes. Pure + testable.

export interface MentionMember {
  userId: string;
  /** Tokens that, prefixed with "@", count as a mention (e.g. email local
   *  part, first name) — all lowercase. */
  tokens: string[];
}

/**
 * Return the user ids mentioned in `body`. A mention is "@" followed by one of
 * a member's tokens on a word boundary (case-insensitive).
 */
export function findMentions(body: string, members: MentionMember[]): string[] {
  if (!body.includes("@")) return [];
  const hay = body.toLowerCase();
  const out = new Set<string>();
  for (const m of members) {
    for (const raw of m.tokens) {
      const token = raw.trim().toLowerCase();
      if (!token) continue;
      // "@token" not immediately followed by a word char (so @ana ≠ @anabel).
      const re = new RegExp(`@${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9._-])`, "i");
      if (re.test(hay)) {
        out.add(m.userId);
        break;
      }
    }
  }
  return [...out];
}

/** Build match tokens from an email and optional display name. */
export function mentionTokens(email: string | null, displayName?: string | null): string[] {
  const tokens: string[] = [];
  if (email) {
    const local = email.split("@")[0];
    if (local) tokens.push(local);
  }
  if (displayName) {
    const first = displayName.trim().split(/\s+/)[0];
    if (first) tokens.push(first);
  }
  return tokens;
}
