import { getWorkspace } from "@/lib/workspace";
import { InboxView } from "./inbox-view";

export default async function InboxPage() {
  const { workspace, supabase } = await getWorkspace();

  const [{ data: conversations }, { data: cannedResponses }, { data: labels }] =
    await Promise.all([
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
    ]);

  return (
    <InboxView
      conversations={conversations ?? []}
      workspaceId={workspace.id}
      cannedResponses={cannedResponses ?? []}
      labels={labels ?? []}
    />
  );
}
