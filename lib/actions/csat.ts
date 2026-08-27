"use server";

import { getWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";
import { sendConversationMessage } from "@/lib/outbound";
import { generateCsatToken, buildCsatUrl, csatMessage } from "@/lib/csat";
import { revalidatePath } from "next/cache";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

interface ConversationForCsat {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  platform: string;
  late_conversation_id: string | null;
  channels: unknown;
}

/**
 * Create (or reuse) a CSAT survey for a conversation and deliver its link on
 * the conversation's channel. Shared by the manual and automatic resolve paths.
 * Works on any channel: the survey is a public tokenized page, sent as an
 * ordinary outbound message (stored locally for website, via Zernio for social).
 */
async function deliverSurvey(
  supabase: SupabaseClient<Database>,
  conversation: ConversationForCsat,
  userId: string
): Promise<{ error?: string }> {
  const { data: existing } = await supabase
    .from("csat_surveys")
    .select("token")
    .eq("conversation_id", conversation.id)
    .maybeSingle();

  let token = existing?.token;
  if (!token) {
    token = generateCsatToken();
    const { error } = await supabase.from("csat_surveys").insert({
      workspace_id: conversation.workspace_id,
      conversation_id: conversation.id,
      contact_id: conversation.contact_id,
      token,
      status: "pending",
    });
    if (error) return { error: error.message };
  }

  await sendConversationMessage(
    supabase,
    {
      id: conversation.id,
      workspace_id: conversation.workspace_id,
      platform: conversation.platform,
      late_conversation_id: conversation.late_conversation_id,
      channels: conversation.channels as { late_account_id: string } | null,
    },
    csatMessage(buildCsatUrl(token)),
    userId
  );
  return {};
}

const CONVERSATION_CSAT_SELECT =
  "id, workspace_id, contact_id, platform, late_conversation_id, channels(late_account_id)";

/**
 * Resolve a conversation. Always closes it; additionally sends a CSAT survey
 * when the workspace has CSAT enabled. Used by the inbox Resolve action.
 */
export async function resolveConversation(conversationId: string) {
  const { workspace, user, supabase } = await getWorkspace();

  const { data: conversation } = await supabase
    .from("conversations")
    .select(CONVERSATION_CSAT_SELECT)
    .eq("id", conversationId)
    .eq("workspace_id", workspace.id)
    .single();
  if (!conversation) return { error: "Conversation not found" };

  await supabase.from("conversations").update({ status: "closed" }).eq("id", conversationId);

  let surveySent = false;
  const { data: ws } = await supabase
    .from("workspaces")
    .select("csat_enabled")
    .eq("id", workspace.id)
    .maybeSingle();
  if (ws?.csat_enabled) {
    await deliverSurvey(supabase, conversation, user.id);
    surveySent = true;
  }

  revalidatePath("/dashboard/inbox");
  return { ok: true, surveySent };
}

/** Resolve a conversation and always send a CSAT survey (manual trigger). */
export async function resolveWithSurvey(conversationId: string) {
  const { workspace, user, supabase } = await getWorkspace();

  const { data: conversation } = await supabase
    .from("conversations")
    .select(CONVERSATION_CSAT_SELECT)
    .eq("id", conversationId)
    .eq("workspace_id", workspace.id)
    .single();
  if (!conversation) return { error: "Conversation not found" };

  const res = await deliverSurvey(supabase, conversation, user.id);
  if (res.error) return { error: res.error };

  await supabase.from("conversations").update({ status: "closed" }).eq("id", conversationId);

  revalidatePath("/dashboard/inbox");
  return { ok: true };
}

/** Public rating submission from the /csat/<token> page (no auth). */
export async function submitCsat(token: string, rating: number, feedback: string) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Please choose a rating from 1 to 5." };
  }
  const supabase = await createServiceClient();

  const { data: survey } = await supabase
    .from("csat_surveys")
    .select("id")
    .eq("token", token)
    .maybeSingle();
  if (!survey) return { error: "Survey not found." };

  const { error } = await supabase
    .from("csat_surveys")
    .update({
      rating,
      feedback: feedback.trim().slice(0, 1000) || null,
      status: "responded",
      responded_at: new Date().toISOString(),
    })
    .eq("id", survey.id);
  if (error) return { error: error.message };

  return { ok: true };
}
