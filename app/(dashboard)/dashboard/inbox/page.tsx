import { getWorkspace } from "@/lib/workspace";
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

  return (
    <InboxView
      conversations={conversations ?? []}
      workspaceId={workspace.id}
      currentUserId={user.id}
      currentUserName={currentUserName}
      cannedResponses={cannedResponses ?? []}
      labels={labels ?? []}
      channels={channels ?? []}
      slaMinutes={(workspace as { sla_minutes?: number }).sla_minutes ?? 0}
    />
  );
}
