"use server";

import { getWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Record that the current agent is active right now. Called on a timer while
 * the dashboard is open. Uses the service role for a cheap, RLS-free write
 * scoped to the caller's own membership row.
 */
export async function recordHeartbeat() {
  try {
    const { workspace, user } = await getWorkspace();
    const supabase = await createServiceClient();
    await supabase
      .from("workspace_members")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("workspace_id", workspace.id)
      .eq("user_id", user.id);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
