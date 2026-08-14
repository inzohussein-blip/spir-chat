// Auto-assignment (feature 13). Server-only — called with a service client.

import type { createServiceClient } from "@/lib/supabase/server";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * Auto-assign a conversation to the least-loaded agent when the workspace has
 * round-robin assignment on and the conversation is still unassigned. Load is
 * measured by open conversations currently assigned to each member. Best-effort.
 */
export async function autoAssignConversation(
  supabase: ServiceClient,
  workspaceId: string,
  conversationId: string
): Promise<void> {
  try {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("auto_assign")
      .eq("id", workspaceId)
      .single();
    if (ws?.auto_assign !== "round_robin") return;

    const { data: members } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId);
    if (!members || members.length === 0) return;

    // Count each member's currently open, assigned conversations.
    const { data: openConvs } = await supabase
      .from("conversations")
      .select("assigned_to")
      .eq("workspace_id", workspaceId)
      .eq("status", "open")
      .not("assigned_to", "is", null);

    const load = new Map<string, number>();
    for (const m of members) load.set(m.user_id, 0);
    for (const c of openConvs ?? []) {
      if (c.assigned_to && load.has(c.assigned_to)) {
        load.set(c.assigned_to, (load.get(c.assigned_to) ?? 0) + 1);
      }
    }

    // Pick the member with the smallest load.
    let best: string | null = null;
    let bestLoad = Infinity;
    for (const [userId, count] of load) {
      if (count < bestLoad) {
        best = userId;
        bestLoad = count;
      }
    }
    if (!best) return;

    await supabase
      .from("conversations")
      .update({ assigned_to: best })
      .eq("id", conversationId)
      .is("assigned_to", null);
  } catch {
    // best-effort
  }
}
