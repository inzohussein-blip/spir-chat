import { getWorkspace } from "@/lib/workspace";
import { CampaignsView } from "./campaigns-view";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>;
}) {
  const { workspace, supabase } = await getWorkspace();
  const { segment: initialSegmentId } = await searchParams;

  const [{ data: campaigns }, { data: segments }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name, channel, subject, body, status, sent_count, failed_count, sent_at, scheduled_at, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("segments")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .order("name", { ascending: true }),
  ]);

  // Only honor the query param if it names a real segment in this workspace.
  const validSegment = (segments ?? []).some((s) => s.id === initialSegmentId)
    ? initialSegmentId
    : undefined;

  return (
    <CampaignsView
      campaigns={campaigns ?? []}
      segments={segments ?? []}
      initialSegmentId={validSegment}
    />
  );
}
