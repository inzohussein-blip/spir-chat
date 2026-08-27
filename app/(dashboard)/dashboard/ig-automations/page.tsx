import { getWorkspace } from "@/lib/workspace";
import { IgAutomationsView } from "./ig-automations-view";

interface RawConfig {
  keywords?: { value: string; matchType?: string }[];
  replyText?: string;
  dmMessage?: string;
  dmButtons?: { label: string; url: string }[];
  requireFollow?: boolean;
  followMessage?: string;
}

export default async function IgAutomationsPage() {
  const { workspace, supabase } = await getWorkspace();

  const { data: creds } = await supabase
    .from("meta_credentials")
    .select("channel_id, username")
    .eq("workspace_id", workspace.id);

  const channels = (creds ?? []).map((c) => ({
    id: c.channel_id,
    username: c.username ?? "Instagram",
  }));
  const channelIds = channels.map((c) => c.id);

  let automations: {
    triggerId: string;
    flowId: string;
    channelId: string;
    name: string;
    keywords: string[];
    matchType: string;
    dmMessage: string;
    replyText: string;
    requireFollow: boolean;
    followMessage: string;
    buttons: { label: string; url: string }[];
    isActive: boolean;
    sentCount: number;
    clickCount: number;
  }[] = [];

  if (channelIds.length > 0) {
    const { data: triggers } = await supabase
      .from("triggers")
      .select("id, channel_id, config, is_active, flows!inner(id, name, description)")
      .eq("type", "comment_keyword")
      .in("channel_id", channelIds);

    automations = (triggers ?? [])
      .filter((t) => {
        const flow = t.flows as unknown as { description?: string };
        return flow?.description === "meta_automation";
      })
      .map((t) => {
        const config = (t.config ?? {}) as RawConfig;
        const flow = t.flows as unknown as { id: string; name: string };
        return {
          triggerId: t.id,
          flowId: flow.id,
          channelId: t.channel_id as string,
          name: flow.name,
          keywords: (config.keywords ?? []).map((k) => k.value),
          matchType: config.keywords?.[0]?.matchType ?? "contains",
          dmMessage: config.dmMessage ?? "",
          replyText: config.replyText ?? "",
          requireFollow: config.requireFollow === true,
          followMessage: config.followMessage ?? "",
          buttons: config.dmButtons ?? [],
          isActive: t.is_active,
          sentCount: 0,
          clickCount: 0,
        };
      });

    // Sent DMs per automation (from the comment log) + button clicks (matched
    // to the automation's tracked-link slugs).
    const triggerIds = automations.map((a) => a.triggerId);
    const slugToTrigger = new Map<string, string>();
    for (const a of automations) {
      for (const b of a.buttons) {
        const slug = b.url.split("/r/")[1];
        if (slug) slugToTrigger.set(slug, a.triggerId);
      }
    }

    const [{ data: sentLogs }, { data: trackedLinks }] = await Promise.all([
      triggerIds.length
        ? supabase
            .from("comment_logs")
            .select("matched_trigger_id")
            .in("matched_trigger_id", triggerIds)
            .eq("dm_sent", true)
        : Promise.resolve({ data: [] as { matched_trigger_id: string | null }[] }),
      slugToTrigger.size
        ? supabase
            .from("tracked_links")
            .select("id, slug")
            .in("slug", [...slugToTrigger.keys()])
        : Promise.resolve({ data: [] as { id: string; slug: string }[] }),
    ]);

    const sentByTrigger = new Map<string, number>();
    for (const l of sentLogs ?? []) {
      if (l.matched_trigger_id)
        sentByTrigger.set(l.matched_trigger_id, (sentByTrigger.get(l.matched_trigger_id) ?? 0) + 1);
    }

    // Count clicks for the automations' tracked links.
    const linkIds = (trackedLinks ?? []).map((l) => l.id);
    const clicksByTrigger = new Map<string, number>();
    if (linkIds.length) {
      const { data: clicks } = await supabase
        .from("link_clicks")
        .select("tracked_link_id")
        .in("tracked_link_id", linkIds)
        .limit(10000);
      const linkIdToSlug = new Map((trackedLinks ?? []).map((l) => [l.id, l.slug]));
      for (const c of clicks ?? []) {
        const slug = linkIdToSlug.get(c.tracked_link_id);
        const trig = slug ? slugToTrigger.get(slug) : undefined;
        if (trig) clicksByTrigger.set(trig, (clicksByTrigger.get(trig) ?? 0) + 1);
      }
    }

    automations = automations.map((a) => ({
      ...a,
      sentCount: sentByTrigger.get(a.triggerId) ?? 0,
      clickCount: clicksByTrigger.get(a.triggerId) ?? 0,
    }));
  }

  return <IgAutomationsView channels={channels} automations={automations} />;
}
