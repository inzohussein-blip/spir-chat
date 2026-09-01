// AI writing assistant for the inbox composer. Rewrites an agent's draft.
// Best-effort: any failure returns null.
import { generateText, createGateway } from "ai";

export type ComposeMode = "improve" | "shorten" | "friendly" | "translate_ar" | "translate_en";

const PROMPTS: Record<ComposeMode, string> = {
  improve:
    "Rewrite the support agent's draft reply to be clear, correct, and professional. Keep the meaning and language. Return ONLY the rewritten message, no quotes or preamble.",
  shorten:
    "Make the support agent's draft reply shorter and more concise while keeping the meaning and language. Return ONLY the message.",
  friendly:
    "Rewrite the support agent's draft reply in a warmer, friendlier tone, keeping the meaning and language. Return ONLY the message.",
  translate_ar:
    "Translate the support agent's message into natural, professional Arabic. Return ONLY the translation.",
  translate_en:
    "Translate the support agent's message into natural, professional English. Return ONLY the translation.",
};

export function isComposeMode(v: unknown): v is ComposeMode {
  return typeof v === "string" && v in PROMPTS;
}

export async function composeAssist(
  apiKey: string | undefined,
  mode: ComposeMode,
  text: string
): Promise<string | null> {
  const key = apiKey || process.env.AI_GATEWAY_API_KEY;
  if (!key || !text.trim()) return null;
  try {
    const gw = createGateway({ apiKey: key });
    const { text: out } = await generateText({
      model: gw("openai/gpt-4o-mini"),
      system: PROMPTS[mode],
      messages: [{ role: "user", content: text.slice(0, 2000) }],
      temperature: 0.4,
      maxOutputTokens: 500,
    });
    const cleaned = out.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
    return cleaned || null;
  } catch {
    return null;
  }
}
