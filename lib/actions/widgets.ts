"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

/**
 * Create a website live-chat widget (a channel with platform "website"). Unlike
 * social channels there is no Zernio account, so late_account_id is a synthetic
 * id that keeps the (workspace_id, late_account_id) uniqueness happy.
 */
export async function createWebsiteWidget(name: string) {
  const { workspace, supabase } = await getWorkspace();

  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required" };

  const { data, error } = await supabase
    .from("channels")
    .insert({
      workspace_id: workspace.id,
      platform: "website",
      late_account_id: `website:${randomUUID()}`,
      display_name: trimmed,
      username: trimmed,
      is_active: true,
    })
    .select("id, display_name, is_active, created_at")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/widgets");
  return { data };
}

/** Toggle a website widget on/off without deleting its conversation history. */
export async function setWidgetActive(channelId: string, isActive: boolean) {
  const { supabase } = await getWorkspace();

  const { error } = await supabase
    .from("channels")
    .update({ is_active: isActive })
    .eq("id", channelId)
    .eq("platform", "website");

  if (error) return { error: error.message };

  revalidatePath("/dashboard/widgets");
  return { success: true };
}
