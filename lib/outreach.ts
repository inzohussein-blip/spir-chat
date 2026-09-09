// Direct outreach — parse and normalize an ad-hoc recipient list (pasted or
// uploaded) into sendable addresses. Pure so it can be unit-tested and shared
// by the UI (live count/preview) and the server action (actual send).

export type OutreachChannel = "email" | "sms" | "whatsapp" | "telegram";

// Telegram handles: 5–32 chars, start with a letter, letters/digits/underscore.
const TG_USERNAME_RE = /^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/;

/**
 * Resolve a Telegram target to either a "@username" (lowercased) or a normalized
 * phone in +E.164. Digit/`+`-leading tokens are treated as phones; otherwise a
 * valid handle. Returns null when neither.
 */
export function normalizeTelegramTarget(token: string, defaultCode: string): string | null {
  const t = (token || "").trim();
  if (!t) return null;
  if (t.startsWith("@")) {
    return TG_USERNAME_RE.test(t) ? "@" + t.slice(1).toLowerCase() : null;
  }
  if (/^[+0-9]/.test(t)) return normalizePhone(t, defaultCode);
  return TG_USERNAME_RE.test(t) ? "@" + t.toLowerCase() : null;
}

/** Curated dialing codes, Arab market first, then common international. */
export const COUNTRY_CODES: { code: string; label: string; flag: string }[] = [
  { code: "964", label: "Iraq", flag: "🇮🇶" },
  { code: "966", label: "Saudi Arabia", flag: "🇸🇦" },
  { code: "971", label: "UAE", flag: "🇦🇪" },
  { code: "20", label: "Egypt", flag: "🇪🇬" },
  { code: "962", label: "Jordan", flag: "🇯🇴" },
  { code: "965", label: "Kuwait", flag: "🇰🇼" },
  { code: "974", label: "Qatar", flag: "🇶🇦" },
  { code: "973", label: "Bahrain", flag: "🇧🇭" },
  { code: "968", label: "Oman", flag: "🇴🇲" },
  { code: "970", label: "Palestine", flag: "🇵🇸" },
  { code: "963", label: "Syria", flag: "🇸🇾" },
  { code: "961", label: "Lebanon", flag: "🇱🇧" },
  { code: "967", label: "Yemen", flag: "🇾🇪" },
  { code: "212", label: "Morocco", flag: "🇲🇦" },
  { code: "213", label: "Algeria", flag: "🇩🇿" },
  { code: "216", label: "Tunisia", flag: "🇹🇳" },
  { code: "218", label: "Libya", flag: "🇱🇾" },
  { code: "249", label: "Sudan", flag: "🇸🇩" },
  { code: "90", label: "Turkey", flag: "🇹🇷" },
  { code: "1", label: "USA / Canada", flag: "🇺🇸" },
  { code: "44", label: "United Kingdom", flag: "🇬🇧" },
  { code: "49", label: "Germany", flag: "🇩🇪" },
  { code: "33", label: "France", flag: "🇫🇷" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalize a phone number to E.164-ish "+<digits>". `defaultCode` is a dialing
 * code without "+" (e.g. "964"), used only when the input isn't already
 * international. Returns null when the result isn't a plausible number.
 */
export function normalizePhone(input: string, defaultCode: string): string | null {
  let s = (input || "").trim();
  if (!s) return null;
  // Already international.
  if (s.startsWith("+")) {
    s = "+" + s.slice(1).replace(/\D/g, "");
  } else if (s.startsWith("00")) {
    s = "+" + s.slice(2).replace(/\D/g, "");
  } else {
    // Local: drop any non-digits, strip a leading trunk 0, prepend the code.
    let digits = s.replace(/\D/g, "");
    digits = digits.replace(/^0+/, "");
    const cc = (defaultCode || "").replace(/\D/g, "");
    if (!cc || !digits) return null;
    s = "+" + cc + digits;
  }
  const digits = s.slice(1);
  // E.164 allows up to 15 digits; require at least 8 to avoid garbage.
  if (digits.length < 8 || digits.length > 15) return null;
  return s;
}

export interface ParsedRecipients {
  valid: string[];
  invalid: string[];
}

/**
 * Split a free-form blob (newlines, commas, semicolons, spaces, tabs) into
 * recipients, normalize/validate for the channel, and dedupe. Email channel
 * validates addresses; phone channels normalize with the default dialing code.
 */
export function parseRecipients(
  raw: string,
  channel: OutreachChannel,
  defaultCode: string
): ParsedRecipients {
  const tokens = (raw || "")
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const token of tokens) {
    if (channel === "email") {
      const email = token.toLowerCase();
      if (!EMAIL_RE.test(email)) {
        invalid.push(token);
        continue;
      }
      if (seen.has(email)) continue;
      seen.add(email);
      valid.push(email);
    } else {
      // Telegram accepts @usernames as well as phones; SMS/WhatsApp are phones.
      const target =
        channel === "telegram"
          ? normalizeTelegramTarget(token, defaultCode)
          : normalizePhone(token, defaultCode);
      if (!target) {
        invalid.push(token);
        continue;
      }
      if (seen.has(target)) continue;
      seen.add(target);
      valid.push(target);
    }
  }

  return { valid, invalid };
}
