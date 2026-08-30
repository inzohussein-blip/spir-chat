"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

/** Schedule a one-off message to a conversation, delivered by the jobs cron. */
export async function scheduleMessage(conversationId: string, text: string, atIso: string) {
  const { workspace, supabase } = await getWorkspace();
  const body = text.trim();
  if (!body) return { error: "Message is required" };
  const at = new Date(atIso);
  if (isNaN(at.getTime()) || at.getTime() <= Date.now()) {
    return { error: "Pick a time in the future" };
  }

  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!conv) return { error: "Conversation not found" };

  const { error } = await supabase.from("scheduled_jobs").insert({
    type: "scheduled_message",
    payload: { conversationId, text: body.slice(0, 2000) },
    run_at: at.toISOString(),
  });
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Snooze a conversation until a specific time. It's reopened automatically by
 * the jobs cron once snooze_until passes (and can be reopened manually anytime).
 */
export async function snoozeConversation(conversationId: string, untilIso: string) {
  const { workspace, supabase } = await getWorkspace();
  const until = new Date(untilIso);
  if (isNaN(until.getTime()) || until.getTime() <= Date.now()) {
    return { error: "Pick a time in the future" };
  }
  const { error } = await supabase
    .from("conversations")
    .update({ status: "snoozed", snooze_until: until.toISOString() })
    .eq("id", conversationId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/inbox");
  return { ok: true };
}
