import { getWorkspace } from "@/lib/workspace";
import { SITE_URL } from "@/lib/site";
import { LinksView } from "./links-view";

export default async function LinksPage() {
  const { workspace, supabase } = await getWorkspace();

  const [{ data: links }, { data: clicks }, { data: campaigns }] = await Promise.all([
    supabase
      .from("tracked_links")
      .select("id, slug, label, destination_url, campaign_id, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    // Aggregate recent clicks in JS (capped) — avoids a per-link count query.
    supabase
      .from("link_clicks")
      .select("tracked_link_id, ip_hash, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("campaigns")
      .select("id, name, sent_count")
      .eq("workspace_id", workspace.id),
  ]);

  const sentByCampaign = new Map(
    (campaigns ?? []).map((c) => [c.id, { name: c.name, sent: c.sent_count }])
  );

  const stats = new Map<
    string,
    { clicks: number; uniques: Set<string>; last: string | null }
  >();
  for (const c of clicks ?? []) {
    const s =
      stats.get(c.tracked_link_id) ??
      { clicks: 0, uniques: new Set<string>(), last: null as string | null };
    s.clicks += 1;
    if (c.ip_hash) s.uniques.add(c.ip_hash);
    if (!s.last) s.last = c.created_at;
    stats.set(c.tracked_link_id, s);
  }

  const rows = (links ?? []).map((l) => {
    const s = stats.get(l.id);
    const camp = l.campaign_id ? sentByCampaign.get(l.campaign_id) : undefined;
    const clickCount = s?.clicks ?? 0;
    return {
      id: l.id,
      slug: l.slug,
      label: l.label,
      destinationUrl: l.destination_url,
      campaignName: camp?.name ?? null,
      clicks: clickCount,
      uniqueClicks: s?.uniques.size ?? 0,
      lastClick: s?.last ?? null,
      ctr:
        camp && camp.sent > 0 ? Math.round((clickCount / camp.sent) * 1000) / 10 : null,
    };
  });

  return <LinksView links={rows} baseUrl={SITE_URL} />;
}
