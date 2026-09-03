"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { sendPushToUsers } from "@/lib/push";

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

const MAX_BULK_CONVERSATIONS = 200;

/**
 * Apply one change to many conversations at once (bulk inbox actions). Only a
 * whitelisted set of fields can be set; everything is scoped to the workspace.
 */
export async function bulkUpdateConversations(
  conversationIds: string[],
  change: { status?: "open" | "closed"; priority?: number; assignedTo?: string | null }
) {
  const { workspace, supabase } = await getWorkspace();
  const ids = conversationIds.slice(0, MAX_BULK_CONVERSATIONS);
  if (ids.length === 0) return { error: "No conversations selected" };

  const patch: { status?: "open" | "closed"; priority?: number; assigned_to?: string | null } = {};
  if (change.status === "open" || change.status === "closed") patch.status = change.status;
  if (change.priority === 0 || change.priority === 1 || change.priority === 2) {
    patch.priority = change.priority;
  }
  if (change.assignedTo !== undefined) patch.assigned_to = change.assignedTo;
  if (Object.keys(patch).length === 0) return { error: "Nothing to change" };

  const { error } = await supabase
    .from("conversations")
    .update(patch)
    .eq("workspace_id", workspace.id)
    .in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/inbox");
  return { ok: true, count: ids.length };
}

/**
 * Assign a conversation to a teammate (or unassign with null). Verifies the
 * assignee is a workspace member and notifies them (unless they assigned it to
 * themselves).
 */
export async function assignConversation(
  conversationId: string,
  assigneeId: string | null
) {
  const { workspace, user, supabase } = await getWorkspace();

  if (assigneeId) {
    const { data: member } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspace.id)
      .eq("user_id", assigneeId)
      .maybeSingle();
    if (!member) return { error: "Not a workspace member" };
  }

  const { error } = await supabase
    .from("conversations")
    .update({ assigned_to: assigneeId })
    .eq("id", conversationId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };

  if (assigneeId && assigneeId !== user.id) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("last_message_preview")
      .eq("id", conversationId)
      .maybeSingle();
    await sendPushToUsers([assigneeId], {
      title: "A conversation was assigned to you",
      body: (conv?.last_message_preview || "Open your inbox to reply.").slice(0, 120),
      url: "/dashboard/inbox",
      tag: `assign-${conversationId}`,
    });
  }

  revalidatePath("/dashboard/inbox");
  return { ok: true };
}

/** Permanently delete many conversations at once (workspace-scoped). */
export async function bulkDeleteConversations(conversationIds: string[]) {
  const { workspace, supabase } = await getWorkspace();
  const ids = conversationIds.slice(0, MAX_BULK_CONVERSATIONS);
  if (ids.length === 0) return { error: "No conversations selected" };

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("workspace_id", workspace.id)
    .in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/inbox");
  return { ok: true, count: ids.length };
}

/** Apply a label to many conversations at once. Verifies label ownership. */
export async function bulkAddLabel(conversationIds: string[], labelId: string) {
  const { workspace, supabase } = await getWorkspace();
  if (!labelId) return { error: "Choose a label" };
  const ids = conversationIds.slice(0, MAX_BULK_CONVERSATIONS);
  if (ids.length === 0) return { error: "No conversations selected" };

  // The label must belong to this workspace.
  const { data: label } = await supabase
    .from("labels")
    .select("id")
    .eq("id", labelId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!label) return { error: "Label not found" };

  // Restrict to conversations actually in this workspace.
  const { data: convs } = await supabase
    .from("conversations")
    .select("id")
    .eq("workspace_id", workspace.id)
    .in("id", ids);
  const scoped = (convs ?? []).map((c) => c.id);
  if (scoped.length === 0) return { error: "No conversations selected" };

  const rows = scoped.map((conversation_id) => ({ conversation_id, label_id: labelId }));
  const { error } = await supabase
    .from("conversation_labels")
    .upsert(rows, { onConflict: "conversation_id,label_id", ignoreDuplicates: true });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/inbox");
  return { ok: true, count: scoped.length };
}

/** Set a conversation's priority (0 normal, 1 high, 2 urgent). */
export async function setConversationPriority(
  conversationId: string,
  priority: number
) {
  const { workspace, supabase } = await getWorkspace();
  const level = priority === 1 || priority === 2 ? priority : 0;
  const { error } = await supabase
    .from("conversations")
    .update({ priority: level })
    .eq("id", conversationId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/inbox");
  return { ok: true };
}
