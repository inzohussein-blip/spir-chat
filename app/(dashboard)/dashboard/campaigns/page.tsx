import { getWorkspace } from "@/lib/workspace";
import { CampaignsView } from "./campaigns-view";

export default async function CampaignsPage() {
  const { workspace, supabase } = await getWorkspace();

  const [{ data: campaigns }, { data: segments }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name, channel, subject, body, status, sent_count, failed_count, sent_at, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("segments")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .order("name", { ascending: true }),
  ]);

  return (
    <CampaignsView campaigns={campaigns ?? []} segments={segments ?? []} />
  );
}
