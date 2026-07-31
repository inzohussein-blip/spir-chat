import { getWorkspace } from "@/lib/workspace";
import { WidgetsView } from "./widgets-view";

export default async function WidgetsPage() {
  const { workspace, supabase } = await getWorkspace();

  const { data: widgets } = await supabase
    .from("channels")
    .select("id, display_name, is_active, created_at")
    .eq("workspace_id", workspace.id)
    .eq("platform", "website")
    .order("created_at", { ascending: false });

  // Prefer an explicitly configured public URL; the view falls back to the
  // current origin in the browser when this is unset.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return <WidgetsView widgets={widgets ?? []} appUrl={appUrl} />;
}
