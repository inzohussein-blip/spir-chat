import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Client = SupabaseClient<Database>;

/**
 * Resolve stale conversations: for each workspace with auto_close_days > 0,
 * close open conversations with no activity for that many days. Runs from the
 * daily jobs cron. Best-effort; returns how many were closed.
 */
export async function autoCloseStale(supabase: Client): Promise<number> {
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, auto_close_days")
    .gt("auto_close_days", 0)
    .limit(200);

  let closed = 0;

  for (const ws of workspaces ?? []) {
    const days = (ws as { auto_close_days?: number }).auto_close_days ?? 0;
    if (days <= 0) continue;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();

    const { data: stale } = await supabase
      .from("conversations")
      .select("id")
      .eq("workspace_id", ws.id)
      .eq("status", "open")
      .lte("last_message_at", cutoff)
      .limit(500);

    if (!stale || stale.length === 0) continue;

    const { error } = await supabase
      .from("conversations")
      .update({ status: "closed" })
      .in(
        "id",
        stale.map((c) => c.id)
      );
    if (!error) closed += stale.length;
  }

  return closed;
}
