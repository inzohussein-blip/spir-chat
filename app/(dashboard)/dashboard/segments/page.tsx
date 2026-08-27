import { getWorkspace } from "@/lib/workspace";
import { parseSegmentRules } from "@/lib/segments";
import { SegmentsView } from "./segments-view";

export default async function SegmentsPage() {
  const { workspace, supabase } = await getWorkspace();

  const { data: segments } = await supabase
    .from("segments")
    .select("id, name, rules, updated_at")
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false });

  return (
    <SegmentsView
      segments={(segments ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        rules: parseSegmentRules(s.rules),
      }))}
    />
  );
}
