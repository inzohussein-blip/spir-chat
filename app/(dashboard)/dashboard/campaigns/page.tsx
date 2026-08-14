import { getWorkspace } from "@/lib/workspace";
import { CampaignsView } from "./campaigns-view";

export default async function CampaignsPage() {
  const { workspace, supabase } = await getWorkspace();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, channel, subject, body, status, sent_count, failed_count, sent_at, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  return <CampaignsView campaigns={campaigns ?? []} />;
}
