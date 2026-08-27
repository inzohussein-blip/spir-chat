import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { createZernioClient } from "@/lib/zernio-client";

type Client = SupabaseClient<Database>;

export interface ConversationForSend {
  id: string;
  workspace_id: string;
  platform: string;
  late_conversation_id: string | null;
  channels: { late_account_id: string } | null;
}

/**
 * Send a plain-text outbound message on a conversation's own channel and
 * refresh its inbox preview. Website threads are stored locally (the visitor's
 * widget polls them); social threads go through Zernio. Shared by CSAT surveys
 * and macros so channel handling lives in one place.
 */
export async function sendConversationMessage(
  supabase: Client,
  conversation: ConversationForSend,
  text: string,
  userId?: string
): Promise<{ ok: boolean }> {
  let ok = true;

  if (conversation.platform === "website") {
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      direction: "outbound",
      text,
      sent_by_user_id: userId ?? null,
    });
  } else if (conversation.late_conversation_id) {
    const account = conversation.channels?.late_account_id;
    const { data: ws } = await supabase
      .from("workspaces")
      .select("late_api_key_encrypted")
      .eq("id", conversation.workspace_id)
      .single();
    if (account && ws?.late_api_key_encrypted) {
      try {
        const zernio = createZernioClient(ws.late_api_key_encrypted);
        await zernio.messages.sendInboxMessage({
          path: { conversationId: conversation.late_conversation_id },
          body: { accountId: account, message: text },
        });
      } catch {
        ok = false;
      }
    }
  }

  await supabase
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: text.slice(0, 100),
    })
    .eq("id", conversation.id);

  return { ok };
}
