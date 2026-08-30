import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { sendPushToWorkspace } from "@/lib/push";
import { autoAssignConversation } from "@/lib/routing";

type Client = SupabaseClient<Database>;

/**
 * Escalate conversations that have breached their workspace's first-response
 * SLA: notify the workspace (once per breach, tracked by sla_escalated_at) and
 * round-robin assign any that are still unassigned. Best-effort; returns the
 * number of conversations escalated. Called from the daily jobs cron, so
 * timeliness tracks the cron frequency.
 */
export async function escalateSla(supabase: Client): Promise<number> {
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, sla_minutes")
    .gt("sla_minutes", 0)
    .limit(200);

  let escalated = 0;

  for (const ws of workspaces ?? []) {
    const cutoff = new Date(Date.now() - ws.sla_minutes * 60000).toISOString();
    // Open, unread (awaiting a reply), past the SLA cutoff, not yet escalated.
    const { data: breached } = await supabase
      .from("conversations")
      .select("id, assigned_to")
      .eq("workspace_id", ws.id)
      .eq("status", "open")
      .gt("unread_count", 0)
      .is("sla_escalated_at", null)
      .lte("last_message_at", cutoff)
      .limit(100);

    if (!breached || breached.length === 0) continue;

    // Assign any unassigned breached conversations (no-op unless round-robin on).
    for (const c of breached) {
      if (!c.assigned_to) await autoAssignConversation(supabase, ws.id, c.id);
    }

    await supabase
      .from("conversations")
      .update({ sla_escalated_at: new Date().toISOString() })
      .in(
        "id",
        breached.map((c) => c.id)
      );

    await sendPushToWorkspace(ws.id, {
      title: "SLA breached",
      body: `${breached.length} conversation${breached.length === 1 ? "" : "s"} awaiting a first reply past your SLA.`,
      url: "/dashboard/inbox",
      tag: `sla-${ws.id}`,
    });
    escalated += breached.length;
  }

  return escalated;
}
