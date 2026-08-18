"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { generateTrackedLinkSlug } from "@/lib/tracking";

/** Create a public share link for the workspace's tracked-link report. */
export async function createReportShare(title?: string) {
  const { workspace, supabase } = await getWorkspace();
  for (let attempt = 0; attempt < 2; attempt++) {
    const slug = generateTrackedLinkSlug();
    const { data, error } = await supabase
      .from("report_shares")
      .insert({ workspace_id: workspace.id, slug, title: title?.trim() || null })
      .select("slug")
      .single();
    if (!error && data) {
      revalidatePath("/dashboard/links");
      return { slug: data.slug };
    }
    if (error && !/duplicate|unique/i.test(error.message)) {
      return { error: error.message };
    }
  }
  return { error: "Could not create report, please try again" };
}

export async function deleteReportShare(id: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("report_shares").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/links");
  return { success: true };
}
