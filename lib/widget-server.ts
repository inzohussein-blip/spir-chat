// Server-only helpers for the public widget endpoints.

import type { createServiceClient } from "@/lib/supabase/server";
import { isValidVisitorId, visitorSenderId } from "@/lib/widget";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * Verify the (channelId, conversationId, visitorId) triple all belong together:
 * the conversation is on this active website channel and the visitor owns its
 * contact. Returns the conversation's contact_id, or null when anything is off.
 */
export async function authorizeWidgetConversation(
  supabase: ServiceClient,
  channelId: string,
  conversationId: unknown,
  visitorId: unknown
): Promise<{ contactId: string } | null> {
  if (typeof conversationId !== "string" || !isValidVisitorId(visitorId)) {
    return null;
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, channel_id, contact_id, platform, channels(is_active)")
    .eq("id", conversationId)
    .single();

  const channel = conversation?.channels as { is_active: boolean } | null;
  if (
    !conversation ||
    conversation.channel_id !== channelId ||
    conversation.platform !== "website" ||
    !channel?.is_active
  ) {
    return null;
  }

  const { data: link } = await supabase
    .from("contact_channels")
    .select("contact_id")
    .eq("channel_id", channelId)
    .eq("platform_sender_id", visitorSenderId(visitorId as string))
    .maybeSingle();

  if (!link || link.contact_id !== conversation.contact_id) return null;
  return { contactId: conversation.contact_id };
}
