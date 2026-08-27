"use server";

import { getWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";
import { sendConversationMessage } from "@/lib/outbound";
import { generateCsatToken, buildCsatUrl, csatMessage } from "@/lib/csat";
import { revalidatePath } from "next/cache";

/**
 * Resolve a conversation and send the contact a CSAT survey link.
 * Works on any channel: the survey is a public tokenized page, delivered as
 * an ordinary outbound message (stored locally for website, sent via Zernio
 * for external platforms).
 */
export async function resolveWithSurvey(conversationId: string) {
  const { workspace, user, supabase } = await getWorkspace();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, workspace_id, contact_id, platform, late_conversation_id, channels(late_account_id)")
    .eq("id", conversationId)
    .eq("workspace_id", workspace.id)
    .single();
  if (!conversation) return { error: "Conversation not found" };

  // Reuse an existing survey for this conversation, or create one.
  const { data: existing } = await supabase
    .from("csat_surveys")
    .select("token")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  let token = existing?.token;
  if (!token) {
    token = generateCsatToken();
    const { error } = await supabase.from("csat_surveys").insert({
      workspace_id: workspace.id,
      conversation_id: conversationId,
      contact_id: conversation.contact_id,
      token,
      status: "pending",
    });
    if (error) return { error: error.message };
  }

  const text = csatMessage(buildCsatUrl(token));

  // Deliver the survey message on the conversation's channel (non-fatal on
  // failure: the survey row still exists and resolution proceeds).
  await sendConversationMessage(
    supabase,
    {
      id: conversation.id,
      workspace_id: conversation.workspace_id,
      platform: conversation.platform,
      late_conversation_id: conversation.late_conversation_id,
      channels: conversation.channels as { late_account_id: string } | null,
    },
    text,
    user.id
  );

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
