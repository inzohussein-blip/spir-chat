import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Client = SupabaseClient<Database>;

/**
 * Send a one-time follow-up to website conversations that have gone quiet: open,
 * fully read (the ball is in the visitor's court), idle past the workspace's
 * follow-up window, and not yet followed up. Best-effort; returns how many were
 * sent. Timeliness tracks the cron frequency.
 */
export async function sendVisitorFollowups(supabase: Client): Promise<number> {
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, visitor_followup_minutes, visitor_followup_message")
    .gt("visitor_followup_minutes", 0)
    .not("visitor_followup_message", "is", null)
    .limit(200);

  let sent = 0;
  for (const ws of workspaces ?? []) {
    const msg = ws.visitor_followup_message;
    if (!msg) continue;
    const cutoff = new Date(Date.now() - ws.visitor_followup_minutes * 60000).toISOString();

    const { data: convs } = await supabase
      .from("conversations")
      .select("id")
      .eq("workspace_id", ws.id)
      .eq("platform", "website")
      .eq("status", "open")
      .eq("unread_count", 0)
      .is("followup_sent_at", null)
      .lte("last_message_at", cutoff)
      .limit(100);

    for (const c of convs ?? []) {
      // Claim (null -> now) so a concurrent run can't double-send.
      const { data: claim } = await supabase
        .from("conversations")
        .update({ followup_sent_at: new Date().toISOString() })
        .eq("id", c.id)
        .is("followup_sent_at", null)
        .select("id");
      if (!claim || claim.length === 0) continue;

      await supabase.from("messages").insert({
        conversation_id: c.id,
        direction: "outbound",
        text: msg,
      });
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString(), last_message_preview: msg.slice(0, 100) })
        .eq("id", c.id);
      sent++;
    }
  }
  return sent;
}
