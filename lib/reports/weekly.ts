import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { sendCampaignMessage, channelConfigured } from "@/lib/campaigns/providers";
import { csatStats } from "@/lib/csat";

type Client = SupabaseClient<Database>;

const WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Email a weekly summary to every workspace that opted in (weekly_report_email
 * set) and hasn't been sent one in the last ~7 days. Called from the daily
 * jobs cron; the last_report_sent_at gate keeps it weekly. Best-effort.
 */
export async function sendWeeklyReports(supabase: Client): Promise<number> {
  if (!channelConfigured("email")) return 0;

  const cutoff = new Date(Date.now() - (WEEK - 6 * 60 * 60 * 1000)).toISOString();
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name, weekly_report_email, last_report_sent_at")
    .not("weekly_report_email", "is", null)
    .or(`last_report_sent_at.is.null,last_report_sent_at.lt.${cutoff}`)
    .limit(50);

  const weekAgo = new Date(Date.now() - WEEK).toISOString();
  let sent = 0;

  for (const ws of workspaces ?? []) {
    const email = ws.weekly_report_email;
    if (!email) continue;

    const convBase = () =>
      supabase.from("conversations").select("*", { count: "exact", head: true }).eq("workspace_id", ws.id);

    const [
      { count: totalConv },
      { count: openConv },
      { count: newConv },
      { count: repliesWeek },
      { count: contactsTotal },
      { count: newContacts },
      { data: surveys },
    ] = await Promise.all([
      convBase(),
      convBase().eq("status", "open"),
      convBase().gte("created_at", weekAgo),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "outbound")
        .gte("created_at", weekAgo),
      supabase.from("contacts").select("*", { count: "exact", head: true }).eq("workspace_id", ws.id),
      supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", ws.id)
        .gte("created_at", weekAgo),
      supabase
        .from("csat_surveys")
        .select("rating, status")
        .eq("workspace_id", ws.id)
        .gte("created_at", weekAgo)
        .limit(500),
    ]);

    const csat = csatStats(surveys ?? []);
    const lines = [
      `Weekly summary for ${ws.name}`,
      ``,
      `New conversations (7d): ${newConv ?? 0}`,
      `Open conversations now: ${openConv ?? 0}`,
      `Total conversations: ${totalConv ?? 0}`,
      `Replies sent (7d): ${repliesWeek ?? 0}`,
      `New contacts (7d): ${newContacts ?? 0}`,
      `Total contacts: ${contactsTotal ?? 0}`,
    ];
    if (csat.responses > 0) {
      lines.push(
        ``,
        `CSAT score: ${csat.satisfactionScore}% (avg ${csat.average}/5 over ${csat.responses} response${csat.responses === 1 ? "" : "s"})`
      );
    }
    lines.push(``, `— SpirChat`);

    const res = await sendCampaignMessage("email", email, `Your weekly SpirChat report — ${ws.name}`, lines.join("\n"));
    if (res.ok) {
      sent++;
      await supabase
        .from("workspaces")
        .update({ last_report_sent_at: new Date().toISOString() })
        .eq("id", ws.id);
    }
  }

  return sent;
}
