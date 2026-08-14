import { getWorkspace } from "@/lib/workspace";
import { SITE_URL } from "@/lib/site";
import { DevelopersView } from "./developers-view";

export default async function DevelopersPage() {
  const { workspace, supabase } = await getWorkspace();

  const [{ data: apiKeys }, { data: webhooks }] = await Promise.all([
    supabase
      .from("api_keys")
      .select("id, name, key_prefix, last_used_at, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("webhook_endpoints")
      .select("id, url, events, is_active, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <DevelopersView
      apiKeys={apiKeys ?? []}
      webhooks={(webhooks ?? []).map((w) => ({
        ...w,
        events: Array.isArray(w.events) ? (w.events as string[]) : [],
      }))}
      baseUrl={SITE_URL}
    />
  );
}
