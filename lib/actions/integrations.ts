"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/types/database";

const PROVIDERS = ["shopify", "woocommerce"];

export async function saveIntegration(
  provider: string,
  config: Record<string, string>
) {
  const { workspace, supabase } = await getWorkspace();
  if (!PROVIDERS.includes(provider)) return { error: "Unknown provider" };

  // Trim string values; drop empties (a blank field means "keep existing").
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === "string" && v.trim()) clean[k] = v.trim();
  }

  // Merge over any existing config so leaving a secret blank preserves it.
  const { data: existing } = await supabase
    .from("integrations")
    .select("config")
    .eq("workspace_id", workspace.id)
    .eq("provider", provider)
    .maybeSingle();
  const merged = {
    ...((existing?.config as Record<string, string>) ?? {}),
    ...clean,
  };

  const { error } = await supabase.from("integrations").upsert(
    {
      workspace_id: workspace.id,
      provider,
      config: merged as unknown as Json,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,provider" }
  );
  if (error) return { error: error.message };

  revalidatePath("/dashboard/integrations");
  return { success: true };
}

export async function deleteIntegration(provider: string) {
  const { workspace, supabase } = await getWorkspace();
  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("provider", provider);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/integrations");
  return { success: true };
}
