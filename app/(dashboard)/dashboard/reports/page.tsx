import { getWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/server";
import {
  MessageSquare,
  CheckCircle,
  Clock,
  Send,
  Timer,
  Inbox,
  LineChart,
  Star,
  Smile,
  Users,
} from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { csatStats } from "@/lib/csat";
import { agentStats } from "@/lib/agent-stats";
import { dailyBuckets, hourlyBuckets } from "@/lib/volume";
import { avatarGradient } from "@/lib/avatar";
import { cn } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default async function ReportsPage() {
  const { workspace, supabase } = await getWorkspace();
  const { dash } = await getDictionary();
  const wsId = workspace.id;
  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();

  const base = () =>
    supabase.from("conversations").select("*", { count: "exact", head: true }).eq("workspace_id", wsId);

  const [
    { count: total },
    { count: open },
    { count: resolved },
    { count: snoozed },
    { count: outboundWeek },
    { data: webConvs },
    { data: surveys },
  ] = await Promise.all([
    base(),
    base().eq("status", "open"),
    base().eq("status", "closed"),
    base().eq("status", "snoozed"),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "outbound")
      .gte("created_at", weekAgo),
    supabase
      .from("conversations")
      .select("id")
      .eq("workspace_id", wsId)
      .eq("platform", "website")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200),
    supabase
      .from("csat_surveys")
      .select("rating, status, feedback, responded_at")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const csat = csatStats(surveys ?? []);
  const recentComments = (surveys ?? [])
    .filter((s) => s.status === "responded" && s.feedback)
    .slice(0, 5);

  // Agent performance.
  const [{ data: members }, { data: assignConvs }, { data: agentReplies }, { data: agentSurveys }] =
    await Promise.all([
      supabase.from("workspace_members").select("user_id").eq("workspace_id", wsId),
      supabase.from("conversations").select("assigned_to, status").eq("workspace_id", wsId),
      supabase
        .from("messages")
        .select("sent_by_user_id")
        .eq("direction", "outbound")
        .not("sent_by_user_id", "is", null)
        .gte("created_at", new Date(Date.now() - 30 * DAY).toISOString())
        .limit(10000),
      supabase
        .from("csat_surveys")
        .select("rating, status, conversations(assigned_to)")
        .eq("workspace_id", wsId)
        .eq("status", "responded")
        .limit(1000),
    ]);

  const service = await createServiceClient();
  const agentMembers = await Promise.all(
    (members ?? []).map(async (m) => {
      const { data } = await service.auth.admin.getUserById(m.user_id);
      return { id: m.user_id, email: data.user?.email ?? "Unknown" };
    })
  );
  const agents = agentStats(
    agentMembers,
    assignConvs ?? [],
    agentReplies ?? [],
    (agentSurveys ?? []).map((s) => ({
      agentId: (s.conversations as unknown as { assigned_to: string | null } | null)?.assigned_to ?? null,
      rating: s.rating,
    }))
  ).filter((a) => a.assigned > 0 || a.replies > 0);

  // Conversation volume: new conversations per day (14d) and inbound-message
  // hour-of-day distribution (30d).
  const [{ data: convDates }, { data: inboundDates }] = await Promise.all([
    supabase
      .from("conversations")
      .select("created_at")
      .eq("workspace_id", wsId)
      .gte("created_at", new Date(Date.now() - 14 * DAY).toISOString())
      .limit(5000),
    supabase
      .from("messages")
      .select("created_at")
      .eq("direction", "inbound")
      .gte("created_at", new Date(Date.now() - 30 * DAY).toISOString())
      .limit(10000),
  ]);
  const daily = dailyBuckets((convDates ?? []).map((c) => c.created_at), 14);
  const dailyMax = Math.max(1, ...daily.map((d) => d.count));
  const hours = hourlyBuckets((inboundDates ?? []).map((m) => m.created_at));
  const hoursMax = Math.max(1, ...hours);
  const hasVolume = daily.some((d) => d.count > 0) || hours.some((h) => h > 0);

  // First-response time: for each website conversation, seconds from the first
  // inbound message to the first outbound reply after it. (Website threads store
  // messages locally; social threads live in Zernio and are excluded.)
  let avgFirstResponse: number | null = null;
  const ids = (webConvs ?? []).map((c) => c.id);
  if (ids.length > 0) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, direction, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: true })
      .limit(4000);

    const firstInbound = new Map<string, number>();
    const responseTimes: number[] = [];
    const answered = new Set<string>();
    for (const m of msgs ?? []) {
      const t = new Date(m.created_at).getTime();
      if (m.direction === "inbound") {
        if (!firstInbound.has(m.conversation_id)) firstInbound.set(m.conversation_id, t);
      } else if (
        m.direction === "outbound" &&
        firstInbound.has(m.conversation_id) &&
        !answered.has(m.conversation_id)
      ) {
        answered.add(m.conversation_id);
        responseTimes.push((t - firstInbound.get(m.conversation_id)!) / 1000);
      }
    }
    if (responseTimes.length > 0) {
      avgFirstResponse =
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }
  }

  const cards = [
    { label: "Total conversations", value: total ?? 0, icon: MessageSquare, tone: "text-foreground" },
    { label: "Open", value: open ?? 0, icon: Inbox, tone: "text-emerald-600" },
    { label: "Resolved", value: resolved ?? 0, icon: CheckCircle, tone: "text-blue-600" },
    { label: "Snoozed", value: snoozed ?? 0, icon: Clock, tone: "text-amber-600" },
    { label: "Replies sent (7d)", value: outboundWeek ?? 0, icon: Send, tone: "text-violet-600" },
    { label: "Avg first response (website)", value: formatDuration(avgFirstResponse), icon: Timer, tone: "text-cyan-600" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <PageTitle
          icon={LineChart}
          title={dash.reports.title}
          subtitle={dash.reports.subtitle}
        />
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="rounded-xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <Icon className={`h-4 w-4 ${c.tone}`} />
                </div>
                <p className="mt-2 text-3xl font-bold">{c.value}</p>
              </div>
            );
          })}
        </div>

        {csat.sent > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Smile className="h-4 w-4 text-amber-500" />
              Customer satisfaction (CSAT)
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-card shadow-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">CSAT score</p>
                  <Smile className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="mt-2 text-3xl font-bold">
                  {csat.satisfactionScore == null ? "—" : `${csat.satisfactionScore}%`}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Average rating</p>
                  <Star className="h-4 w-4 text-amber-500" />
                </div>
                <p className="mt-2 text-3xl font-bold">
                  {csat.average == null ? "—" : `${csat.average}/5`}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Responses</p>
                  <MessageSquare className="h-4 w-4 text-violet-600" />
                </div>
                <p className="mt-2 text-3xl font-bold">{csat.responses}</p>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Response rate</p>
                  <Send className="h-4 w-4 text-cyan-600" />
                </div>
                <p className="mt-2 text-3xl font-bold">
                  {csat.responseRate == null ? "—" : `${csat.responseRate}%`}
                </p>
              </div>
            </div>

            {recentComments.length > 0 && (
              <div className="mt-4 rounded-xl border border-border bg-card shadow-card p-5">
                <p className="mb-3 text-sm font-semibold">Recent feedback</p>
                <ul className="space-y-3">
                  {recentComments.map((s, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {s.rating}
                      </span>
                      <p className="text-sm text-muted-foreground">{s.feedback}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {hasVolume && (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <h2 className="mb-4 text-sm font-semibold">New conversations · 14 days</h2>
              <div className="flex h-32 items-end gap-1">
                {daily.map((d) => (
                  <div key={d.day} className="group flex flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">
                      {d.count}
                    </span>
                    <div
                      className="w-full rounded-t bg-primary/70"
                      style={{ height: `${Math.max(2, (d.count / dailyMax) * 100)}%` }}
                    />
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(d.day).getDate()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <h2 className="mb-4 text-sm font-semibold">Busiest hours · inbound (30d)</h2>
              <div className="flex h-32 items-end gap-[2px]">
                {hours.map((count, h) => (
                  <div key={h} className="group flex flex-1 flex-col items-center justify-end gap-1">
                    <div
                      className="w-full rounded-t bg-cyan-500/70"
                      style={{ height: `${Math.max(2, (count / hoursMax) * 100)}%` }}
                      title={`${h}:00 — ${count}`}
                    />
                    {h % 6 === 0 && (
                      <span className="text-[9px] text-muted-foreground">{h}</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">Hour of day (local)</p>
            </div>
          </div>
        )}

        {agents.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-primary" />
              Agent performance
            </h2>
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase text-muted-foreground">
                    <th className="px-5 py-3">Agent</th>
                    <th className="px-4 py-3">Assigned</th>
                    <th className="px-4 py-3">Open</th>
                    <th className="px-4 py-3">Resolved</th>
                    <th className="px-4 py-3">Replies (30d)</th>
                    <th className="px-4 py-3">CSAT</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a) => {
                    const name = a.email.split("@")[0];
                    return (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white",
                                avatarGradient(name)
                              )}
                            >
                              {name.charAt(0).toUpperCase()}
                            </span>
                            <span className="truncate text-sm font-medium">{a.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{a.assigned}</td>
                        <td className="px-4 py-3 text-sm">{a.open}</td>
                        <td className="px-4 py-3 text-sm">{a.resolved}</td>
                        <td className="px-4 py-3 text-sm">{a.replies}</td>
                        <td className="px-4 py-3 text-sm">
                          {a.csatAvg == null ? (
                            <span className="text-muted-foreground/60">—</span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              {a.csatAvg}
                              <span className="text-xs text-muted-foreground">({a.csatResponses})</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          Response time is measured on website conversations (social message
          timing lives in the connected provider).
        </p>
      </div>
    </div>
  );
}
