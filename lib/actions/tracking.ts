"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { generateTrackedLinkSlug, isValidUrl } from "@/lib/tracking";

export async function createTrackedLink(input: {
  destinationUrl: string;
  label?: string;
  campaignId?: string | null;
}) {
  const { workspace, supabase } = await getWorkspace();
  const destinationUrl = input.destinationUrl.trim();
  if (!isValidUrl(destinationUrl)) {
    return { error: "A valid http(s):// URL is required" };
  }

  // Retry once on the rare slug collision (unique constraint).
  for (let attempt = 0; attempt < 2; attempt++) {
    const slug = generateTrackedLinkSlug();
    const { data, error } = await supabase
      .from("tracked_links")
      .insert({
        workspace_id: workspace.id,
        campaign_id: input.campaignId ?? null,
        slug,
        label: input.label?.trim() || null,
        destination_url: destinationUrl,
      })
      .select("id, slug")
      .single();
    if (!error && data) {
      revalidatePath("/dashboard/links");
      return { id: data.id, slug: data.slug };
    }
    if (error && !/duplicate|unique/i.test(error.message)) {
      return { error: error.message };
    }
  }
  return { error: "Could not create link, please try again" };
}

export async function deleteTrackedLink(id: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("tracked_links").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/links");
  return { success: true };
}
