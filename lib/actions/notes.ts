"use server";

import { getWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";
import { findMentions, mentionTokens } from "@/lib/mentions";
import { sendPushToUsers } from "@/lib/push";

/**
 * Notify any teammates @mentioned in an internal note. Called after the note
 * is created; best-effort. The author is never notified about their own note.
 */
export async function notifyMentions(conversationId: string, body: string) {
  if (!body.includes("@")) return { ok: true };
  const { workspace, user, supabase } = await getWorkspace();

  // Confirm the conversation is in this workspace before doing anything.
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!conv) return { error: "Conversation not found" };

  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspace.id);

  const service = await createServiceClient();
  const resolved = await Promise.all(
    (members ?? [])
      .filter((m) => m.user_id !== user.id)
      .map(async (m) => {
        const { data } = await service.auth.admin.getUserById(m.user_id);
        return {
          userId: m.user_id,
          tokens: mentionTokens(
            data.user?.email ?? null,
            (data.user?.user_metadata?.full_name as string | undefined) ?? null
          ),
        };
      })
  );

  const mentioned = findMentions(body, resolved);
  if (mentioned.length > 0) {
    await sendPushToUsers(mentioned, {
      title: "You were mentioned in a note",
      body: body.slice(0, 120),
      url: "/dashboard/inbox",
      tag: `mention-${conversationId}`,
    });
  }
  return { ok: true, notified: mentioned.length };
}
