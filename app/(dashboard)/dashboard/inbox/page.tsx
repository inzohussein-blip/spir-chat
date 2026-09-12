import { getWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";
import { InboxView } from "./inbox-view";

export default async function InboxPage() {
  const { workspace, user, supabase } = await getWorkspace();

  const [
    { data: conversations },
    { data: cannedResponses },
    { data: labels },
    { data: channels },
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select("*, contacts(*)")
      .eq("workspace_id", workspace.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(50),
    supabase
      .from("canned_responses")
      .select("id, short_code, content")
      .eq("workspace_id", workspace.id)
      .order("short_code", { ascending: true }),
    supabase
      .from("labels")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("name", { ascending: true }),
    supabase
      .from("channels")
      .select("id, platform, display_name, username")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true }),
  ]);

  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const currentUserName =
    meta.full_name || meta.name || user.email?.split("@")[0] || "Agent";

  // Map of workspace agent id → display name, so replies can be attributed to
  // the specific teammate who sent them. Names live in auth.users (service role).
  const serviceClient = await createServiceClient();
  const { data: memberRows } = await serviceClient
    .from("workspace_members")
    .select("user_id, last_seen_at, is_away")
    .eq("workspace_id", workspace.id);
  const ONLINE_WINDOW = 90 * 1000;
  const members = await Promise.all(
    (memberRows ?? []).map(async (m) => {
      const {
        data: { user: u },
      } = await serviceClient.auth.admin.getUserById(m.user_id);
      const um = (u?.user_metadata ?? {}) as { full_name?: string; name?: string };
      const name =
        um.full_name || um.name || u?.email?.split("@")[0] || "Agent";
      const seen = m.last_seen_at ? new Date(m.last_seen_at).getTime() : 0;
      return {
        id: m.user_id,
        name,
        online: Date.now() - seen < ONLINE_WINDOW,
        away: !!(m as { is_away?: boolean }).is_away,
      };
    })
  );
  const agentNames = Object.fromEntries(members.map((m) => [m.id, m.name]));
  // Teammates currently online (excluding yourself), for an inbox presence row.
  const onlineTeammates = members
    .filter((m) => m.online && m.id !== user.id)
    .map((m) => ({ id: m.id, name: m.name, away: m.away }));

  return (
    <InboxView
      conversations={conversations ?? []}
      workspaceId={workspace.id}
      currentUserId={user.id}
      currentUserName={currentUserName}
      agentNames={agentNames}
      onlineTeammates={onlineTeammates}
      cannedResponses={cannedResponses ?? []}
      labels={labels ?? []}
      channels={channels ?? []}
      slaMinutes={(workspace as { sla_minutes?: number }).sla_minutes ?? 0}
    />
  );
}
