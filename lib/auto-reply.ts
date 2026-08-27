import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { parseBusinessHours, isOpenAt } from "@/lib/business-hours";
import { sendConversationMessage, type ConversationForSend } from "@/lib/outbound";

/**
 * Post the workspace's offline auto-reply once per conversation when the team
 * is outside business hours. Channel-agnostic: website threads store the reply
 * locally, social threads send it via Zernio. The one-time send is claimed
 * atomically via conversations.auto_reply_sent_at so concurrent inbound
 * messages can't both fire it. Best-effort.
 */
export async function maybeSendOfflineAutoReply(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  conversation: ConversationForSend
): Promise<void> {
  try {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("business_hours")
      .eq("id", workspaceId)
      .single();
    const bh = parseBusinessHours(ws?.business_hours);
    if (!bh.enabled || !bh.replyOffline || isOpenAt(bh)) return;

    const { data: claimed } = await supabase
      .from("conversations")
      .update({ auto_reply_sent_at: new Date().toISOString() })
      .eq("id", conversation.id)
      .is("auto_reply_sent_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) return;

    await sendConversationMessage(supabase, conversation, bh.replyOffline);
  } catch {
    // best-effort
  }
}
