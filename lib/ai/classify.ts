// AI conversation classification (feature 4).
//
// Uses the same Vercel AI Gateway setup as the flow AI node. Classifies a
// visitor's first message into an intent category + sentiment so the inbox can
// auto-label and (optionally) route it. Best-effort: any failure is a no-op.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { generateText, createGateway } from "ai";

export const AI_CATEGORIES = ["sales", "support", "billing", "general"] as const;
export type AiCategory = (typeof AI_CATEGORIES)[number];

export const AI_SENTIMENTS = ["positive", "neutral", "negative"] as const;
export type AiSentiment = (typeof AI_SENTIMENTS)[number];

// Label colors so the auto-applied labels look intentional in the inbox.
const CATEGORY_COLOR: Record<AiCategory, string> = {
  sales: "#10b981",
  support: "#6366f1",
  billing: "#f59e0b",
  general: "#64748b",
};

interface Classification {
  category: AiCategory;
  sentiment: AiSentiment;
}

/** Ask the model to classify a message. Returns null when unavailable/unsure. */
export async function classifyMessage(
  apiKey: string | undefined,
  text: string
): Promise<Classification | null> {
  const key = apiKey || process.env.AI_GATEWAY_API_KEY;
  if (!key || !text.trim()) return null;

  try {
    const gw = createGateway({ apiKey: key });
    const { text: raw } = await generateText({
      model: gw("openai/gpt-4o-mini"),
      system:
        "You classify a customer's chat message. Respond with ONLY minified JSON " +
        '{"category","sentiment"}. category ∈ [sales,support,billing,general]. ' +
        "sentiment ∈ [positive,neutral,negative]. No prose.",
      messages: [{ role: "user", content: text.slice(0, 1000) }],
      temperature: 0,
      maxOutputTokens: 30,
    });

    const parsed = JSON.parse(raw.trim().replace(/^```json?|```$/g, "").trim());
    const category = AI_CATEGORIES.includes(parsed.category)
      ? (parsed.category as AiCategory)
      : "general";
    const sentiment = AI_SENTIMENTS.includes(parsed.sentiment)
      ? (parsed.sentiment as AiSentiment)
      : "neutral";
    return { category, sentiment };
  } catch {
    return null;
  }
}

/**
 * Classify a conversation's first message and apply an intent label. Ensures a
 * per-workspace label exists, then links it to the conversation. Best-effort.
 */
export async function applyAiClassification(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  conversationId: string,
  text: string
): Promise<void> {
  try {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("ai_api_key")
      .eq("id", workspaceId)
      .single();

    const result = await classifyMessage(ws?.ai_api_key ?? undefined, text);
    if (!result) return;

    const labelName = `AI: ${result.category}`;
    // Upsert the label (unique on workspace_id + name).
    const { data: label } = await supabase
      .from("labels")
      .upsert(
        {
          workspace_id: workspaceId,
          name: labelName,
          color: CATEGORY_COLOR[result.category],
        },
        { onConflict: "workspace_id,name" }
      )
      .select("id")
      .single();
    if (!label) return;

    await supabase
      .from("conversation_labels")
      .upsert(
        { conversation_id: conversationId, label_id: label.id },
        { onConflict: "conversation_id,label_id" }
      );
  } catch {
    // best-effort
  }
}
