import { notFound } from "next/navigation";
import { MousePointerClick, Link2, Users } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createServiceClient();

  const { data: report } = await supabase
    .from("report_shares")
    .select("workspace_id, title, created_at")
    .eq("slug", slug)
    .single();
  if (!report) notFound();

  const [{ data: links }, { data: clicks }] = await Promise.all([
    supabase
      .from("tracked_links")
      .select("id, slug, label, destination_url")
      .eq("workspace_id", report.workspace_id),
    supabase
      .from("link_clicks")
      .select("tracked_link_id, ip_hash, created_at")
      .eq("workspace_id", report.workspace_id)
      .order("created_at", { ascending: false })
      .limit(10000),
  ]);

  // Aggregate per-link + a 14-day daily series.
  const perLink = new Map<string, { clicks: number; uniques: Set<string> }>();
  const days = 14;
  const series = new Array(days).fill(0);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  for (const c of clicks ?? []) {
    const s = perLink.get(c.tracked_link_id) ?? { clicks: 0, uniques: new Set<string>() };
    s.clicks += 1;
    if (c.ip_hash) s.uniques.add(c.ip_hash);
    perLink.set(c.tracked_link_id, s);
    // Compare day-starts so a click earlier *today* lands in today's bucket
    // (not a negative offset that would be dropped).
    const clickDay = new Date(c.created_at);
    clickDay.setHours(0, 0, 0, 0);
    const daysAgo = Math.round((startOfToday.getTime() - clickDay.getTime()) / DAY);
    const dayIdx = days - 1 - daysAgo;
    if (dayIdx >= 0 && dayIdx < days) series[dayIdx] += 1;
  }

  const totalClicks = clicks?.length ?? 0;
  const totalUnique = new Set((clicks ?? []).map((c) => c.ip_hash).filter(Boolean)).size;
  const rows = (links ?? [])
    .map((l) => ({
      slug: l.slug,
      label: l.label ?? l.destination_url,
      clicks: perLink.get(l.id)?.clicks ?? 0,
      uniques: perLink.get(l.id)?.uniques.size ?? 0,
    }))
    .sort((a, b) => b.clicks - a.clicks);

  const maxDay = Math.max(1, ...series);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-br from-violet-600 to-cyan-500 px-6 py-12 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-white/80">Link performance report</p>
          <h1 className="mt-1 text-3xl font-bold">{report.title || "Tracked links"}</h1>
          <p className="mt-1 text-sm text-white/80">
            Generated {new Date(report.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {/* Totals */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon={<MousePointerClick className="h-4 w-4 text-primary" />} label="Total clicks" value={totalClicks} />
          <Stat icon={<Users className="h-4 w-4 text-cyan-600" />} label="Unique visitors" value={totalUnique} />
          <Stat icon={<Link2 className="h-4 w-4 text-violet-600" />} label="Links" value={rows.length} />
        </div>

        {/* 14-day sparkline */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="mb-3 text-sm font-semibold">Clicks — last {days} days</p>
          <div className="flex h-24 items-end gap-1">
            {series.map((v, i) => (
              <div key={i} className="flex-1" title={`${v} clicks`}>
                <div
                  className="rounded-t bg-gradient-to-t from-violet-500 to-cyan-400"
                  style={{ height: `${Math.round((v / maxDay) * 100)}%`, minHeight: v > 0 ? 4 : 0 }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Per-link table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2 font-medium">Link</th>
                <th className="px-4 py-2 font-medium">Clicks</th>
                <th className="px-4 py-2 font-medium">Unique</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                    No links yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.slug} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      <span className="font-medium">{r.label}</span>
                      <code className="ms-2 rounded bg-muted px-1 text-[11px]">/r/{r.slug}</code>
                    </td>
                    <td className="px-4 py-2 font-medium">{r.clicks}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.uniques}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="text-center text-xs text-muted-foreground">Powered by SpirChat</p>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
