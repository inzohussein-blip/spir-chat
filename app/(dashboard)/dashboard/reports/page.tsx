import { getWorkspace } from "@/lib/workspace";
import { getDictionary } from "@/lib/i18n/server";
import {
  MessageSquare,
  CheckCircle,
  Clock,
  Send,
  Timer,
  Inbox,
  LineChart,
} from "lucide-react";
import { PageTitle } from "@/components/page-title";

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
  ]);

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
              <div key={c.label} className="rounded-xl border border-border bg-card shadow-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <Icon className={`h-4 w-4 ${c.tone}`} />
                </div>
                <p className="mt-2 text-3xl font-bold">{c.value}</p>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Response time is measured on website conversations (social message
          timing lives in the connected provider).
        </p>
      </div>
    </div>
  );
}
