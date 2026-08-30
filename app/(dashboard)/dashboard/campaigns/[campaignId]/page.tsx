import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/workspace";
import {
  Megaphone,
  ArrowLeft,
  Send,
  CheckCircle,
  XCircle,
  Users,
  Percent,
} from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  sending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  sent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const { workspace, supabase } = await getWorkspace();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("workspace_id", workspace.id)
    .single();
  if (!campaign) notFound();

  const { data: recipients } = await supabase
    .from("campaign_recipients")
    .select("id, recipient, status, error, variant, created_at, contacts(display_name)")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = recipients ?? [];
  const sent = rows.filter((r) => r.status === "sent").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const total = rows.length || campaign.sent_count + campaign.failed_count;
  const deliveryRate = total > 0 ? Math.round((sent / total) * 100) : null;

  // A/B breakdown (only meaningful when a second variant was configured).
  const variantStats = (v: "a" | "b") => {
    const vr = rows.filter((r) => r.variant === v);
    const vsent = vr.filter((r) => r.status === "sent").length;
    return {
      total: vr.length,
      sent: vsent,
      rate: vr.length ? Math.round((vsent / vr.length) * 100) : null,
    };
  };
  const abA = variantStats("a");
  const abB = variantStats("b");
  const hasAb = !!(campaign as { body_b?: string | null }).body_b || abB.total > 0;

  const stats = [
    { label: "Recipients", value: total, icon: Users, tone: "text-violet-600" },
    { label: "Delivered", value: sent, icon: CheckCircle, tone: "text-emerald-600" },
    { label: "Failed", value: failed, icon: XCircle, tone: "text-red-600" },
    {
      label: "Delivery rate",
      value: deliveryRate == null ? "—" : `${deliveryRate}%`,
      icon: Percent,
      tone: "text-cyan-600",
    },
  ];

  const failures = rows.filter((r) => r.status === "failed");

  // Click performance (when the campaign has a tracked link).
  const { data: cLink } = await supabase
    .from("tracked_links")
    .select("id, slug, destination_url")
    .eq("campaign_id", campaignId)
    .maybeSingle();
  let clicks = 0;
  let uniqueClicks = 0;
  if (cLink) {
    const { data: clickRows } = await supabase
      .from("link_clicks")
      .select("ip_hash")
      .eq("tracked_link_id", cLink.id)
      .limit(10000);
    clicks = clickRows?.length ?? 0;
    uniqueClicks = new Set((clickRows ?? []).map((c) => c.ip_hash).filter(Boolean)).size;
  }
  const ctr = cLink && sent > 0 ? Math.round((uniqueClicks / sent) * 100) : null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <Link
          href="/dashboard/campaigns"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Campaigns
        </Link>
        <div className="flex items-center justify-between gap-3">
          <PageTitle icon={Megaphone} title={campaign.name} subtitle={campaign.subject ?? undefined} />
          <div className="flex flex-shrink-0 items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                STATUS_STYLE[campaign.status] ?? STATUS_STYLE.draft
              )}
            >
              {campaign.status}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
              {campaign.channel}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-border bg-card p-5 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <s.icon className={cn("h-4 w-4", s.tone)} />
                </div>
                <p className="mt-2 text-3xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* A/B breakdown */}
          {hasAb && (
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                { label: "Variant A", body: campaign.body, s: abA },
                { label: "Variant B", body: (campaign as { body_b?: string | null }).body_b ?? "", s: abB },
              ] as const).map((v) => (
                <div key={v.label} className="rounded-xl border border-border bg-card p-5 shadow-card">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">{v.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {v.s.sent}/{v.s.total} delivered
                      {v.s.rate != null ? ` · ${v.s.rate}%` : ""}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{v.body}</p>
                </div>
              ))}
            </div>
          )}

          {/* Link performance */}
          {cLink && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Percent className="h-4 w-4 text-primary" /> Link performance
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Clicks</p>
                  <p className="mt-1 text-2xl font-bold">{clicks}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unique clicks</p>
                  <p className="mt-1 text-2xl font-bold">{uniqueClicks}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Click-through rate</p>
                  <p className="mt-1 text-2xl font-bold">{ctr == null ? "—" : `${ctr}%`}</p>
                </div>
              </div>
              <p className="mt-3 truncate text-xs text-muted-foreground">
                {cLink.destination_url}
              </p>
            </div>
          )}

          {/* Message (single variant) */}
          {!hasAb && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Send className="h-4 w-4 text-primary" /> Message
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{campaign.body}</p>
            </div>
          )}

          {/* Failures */}
          {failures.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <p className="mb-3 text-sm font-semibold">Failures ({failures.length})</p>
              <ul className="space-y-2">
                {failures.slice(0, 50).map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="truncate">
                      {(r.contacts as unknown as { display_name: string | null } | null)?.display_name || r.recipient}
                    </span>
                    <span className="truncate text-xs text-red-600">{r.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recipients */}
          {rows.length > 0 ? (
            <div className="rounded-xl border border-border bg-card shadow-card">
              <p className="border-b border-border px-5 py-3 text-sm font-semibold">
                Recipients
              </p>
              <ul className="divide-y divide-border">
                {rows.slice(0, 200).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="truncate">
                      {(r.contacts as unknown as { display_name: string | null } | null)?.display_name || r.recipient}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-medium",
                        r.status === "sent" ? "text-emerald-600" : "text-red-600"
                      )}
                    >
                      {r.status === "sent" ? (
                        <CheckCircle className="h-3.5 w-3.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      {r.status === "sent" ? "Delivered" : "Failed"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No per-recipient data yet — this report populates when the campaign is sent.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
