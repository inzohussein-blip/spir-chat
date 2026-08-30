import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { matchLabelRules } from "@/lib/label-rules";

/**
 * Apply any matching auto-label rules to a conversation based on an inbound
 * message's text. Best-effort and idempotent (upsert ignores duplicates).
 */
export async function applyLabelRules(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  conversationId: string,
  text: string | null | undefined
): Promise<void> {
  try {
    if (!text) return;
    const { data: rules } = await supabase
      .from("label_rules")
      .select("keyword, label_id")
      .eq("workspace_id", workspaceId);
    const labelIds = matchLabelRules(rules ?? [], text);
    if (labelIds.length === 0) return;
    await supabase.from("conversation_labels").upsert(
      labelIds.map((label_id) => ({ conversation_id: conversationId, label_id })),
      { onConflict: "conversation_id,label_id", ignoreDuplicates: true }
    );
  } catch {
    // best-effort
  }
}
