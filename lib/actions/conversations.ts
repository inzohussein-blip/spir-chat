"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

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
