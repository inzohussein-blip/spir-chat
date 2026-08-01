"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

/** Create a saved reply. short_code is normalized (no leading slash, no spaces). */
export async function createCannedResponse(shortCode: string, content: string) {
  const { workspace, supabase } = await getWorkspace();

  const code = shortCode.trim().replace(/^\//, "").replace(/\s+/g, "-");
  const body = content.trim();
  if (!code) return { error: "Short code is required" };
  if (!body) return { error: "Content is required" };

  const { data, error } = await supabase
    .from("canned_responses")
    .insert({ workspace_id: workspace.id, short_code: code, content: body })
    .select("id, short_code, content")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "That short code is already used" };
    return { error: error.message };
  }

  revalidatePath("/dashboard/saved-replies");
  return { data };
}

export async function deleteCannedResponse(id: string) {
  const { supabase } = await getWorkspace();

  const { error } = await supabase.from("canned_responses").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/saved-replies");
  return { success: true };
}
