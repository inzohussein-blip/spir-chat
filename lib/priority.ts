// Conversation priority — 0 normal, 1 high, 2 urgent. Pure helpers shared by
// the inbox list, the thread header, and their tests.

export const PRIORITY_LEVELS = [0, 1, 2] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export function isPriorityLevel(n: unknown): n is PriorityLevel {
  return n === 0 || n === 1 || n === 2;
}

/** Clamp any stored/incoming value to a valid level (defaults to normal). */
export function normalizePriority(n: unknown): PriorityLevel {
  return isPriorityLevel(n) ? n : 0;
}

export const PRIORITY_LABEL: Record<PriorityLevel, string> = {
  0: "Normal",
  1: "High",
  2: "Urgent",
};

/** Tailwind classes for the small priority badge shown on a conversation. */
export const PRIORITY_BADGE: Record<PriorityLevel, string> = {
  0: "",
  1: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  2: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

/**
 * Sort comparator: higher priority first, then most recent activity. Use with
 * a timestamp accessor so it works for either Date strings or nulls.
 */
export function comparePriority(
  a: { priority?: number | null; at: string | null },
  b: { priority?: number | null; at: string | null }
): number {
  const pa = normalizePriority(a.priority);
  const pb = normalizePriority(b.priority);
  if (pa !== pb) return pb - pa;
  const ta = a.at ? new Date(a.at).getTime() : 0;
  const tb = b.at ? new Date(b.at).getTime() : 0;
  return tb - ta;
}
