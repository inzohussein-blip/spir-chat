import { getWorkspace } from "@/lib/workspace";
import { IntegrationsView } from "./integrations-view";

export default async function IntegrationsPage() {
  const { workspace, supabase } = await getWorkspace();

  const { data: rows } = await supabase
    .from("integrations")
    .select("provider, config, is_active")
    .eq("workspace_id", workspace.id);

  // Never send secrets to the client — only which providers are connected and a
  // masked hint (e.g. the store domain, which isn't sensitive).
  const configured: Record<string, { connected: boolean; hint: string }> = {};
  for (const r of rows ?? []) {
    const cfg = (r.config as Record<string, string>) ?? {};
    configured[r.provider] = {
      connected: r.is_active,
      hint: cfg.shopDomain || cfg.storeUrl || "",
    };
  }

  return <IntegrationsView configured={configured} />;
}
