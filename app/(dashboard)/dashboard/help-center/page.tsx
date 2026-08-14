import { getWorkspace } from "@/lib/workspace";
import { SITE_URL } from "@/lib/site";
import { HelpCenterView } from "./help-center-view";

export default async function HelpCenterPage() {
  const { workspace, supabase } = await getWorkspace();

  const { data: articles } = await supabase
    .from("kb_articles")
    .select("id, title, slug, category, body, is_published, updated_at")
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false });

  return (
    <HelpCenterView
      articles={articles ?? []}
      publicBase={`${SITE_URL}/help/${workspace.slug}`}
    />
  );
}
