// Rich message content: link buttons + product card carousels (feature 12).

export interface RichButton {
  label: string;
  url: string;
}

export interface RichCard {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  url?: string;
  buttons: RichButton[];
}

export type RichContent =
  | { type: "buttons"; buttons: RichButton[] }
  | { type: "cards"; cards: RichCard[] };

function isHttpUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\/.+/.test(v);
}

function cleanButtons(raw: unknown): RichButton[] {
  if (!Array.isArray(raw)) return [];
  const out: RichButton[] = [];
  for (const b of raw) {
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim().slice(0, 40) : "";
    if (label && isHttpUrl(o.url)) out.push({ label, url: o.url });
    if (out.length >= 3) break; // at most 3 buttons
  }
  return out;
}

/** Safely coerce stored jsonb into typed rich content, or null. */
export function parseRichContent(raw: unknown): RichContent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  if (o.type === "buttons") {
    const buttons = cleanButtons(o.buttons);
    return buttons.length ? { type: "buttons", buttons } : null;
  }

  if (o.type === "cards" && Array.isArray(o.cards)) {
    const cards: RichCard[] = [];
    for (const c of o.cards) {
      if (!c || typeof c !== "object") continue;
      const cc = c as Record<string, unknown>;
      const title = typeof cc.title === "string" ? cc.title.trim().slice(0, 80) : "";
      if (!title) continue;
      cards.push({
        title,
        subtitle:
          typeof cc.subtitle === "string" ? cc.subtitle.trim().slice(0, 140) : undefined,
        imageUrl: isHttpUrl(cc.imageUrl) ? cc.imageUrl : undefined,
        url: isHttpUrl(cc.url) ? cc.url : undefined,
        buttons: cleanButtons(cc.buttons),
      });
      if (cards.length >= 10) break;
    }
    return cards.length ? { type: "cards", cards } : null;
  }

  return null;
}

/** Build a buttons payload from an agent's label/url pairs (drops invalid). */
export function buildButtonsContent(
  buttons: { label: string; url: string }[]
): RichContent | null {
  return parseRichContent({ type: "buttons", buttons });
}
