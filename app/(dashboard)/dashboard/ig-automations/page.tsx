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
        };
      });
  }

  return <IgAutomationsView channels={channels} automations={automations} />;
}
