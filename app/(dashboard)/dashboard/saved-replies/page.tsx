import { getWorkspace } from "@/lib/workspace";
import { SavedRepliesView } from "./saved-replies-view";

export default async function SavedRepliesPage() {
  const { workspace, supabase } = await getWorkspace();

  const { data: replies } = await supabase
    .from("canned_responses")
    .select("id, short_code, content")
    .eq("workspace_id", workspace.id)
    .order("short_code", { ascending: true });

  return <SavedRepliesView replies={replies ?? []} />;
}
