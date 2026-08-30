"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

export async function createLabelRule(keyword: string, labelId: string) {
  const { workspace, supabase } = await getWorkspace();
  const kw = keyword.trim();
  if (!kw) return { error: "Keyword is required" };
  if (!labelId) return { error: "Choose a label" };

  // Verify the label belongs to this workspace.
  const { data: label } = await supabase
    .from("labels")
    .select("id")
    .eq("id", labelId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!label) return { error: "Label not found" };

  const { error } = await supabase
    .from("label_rules")
    .insert({ workspace_id: workspace.id, keyword: kw.slice(0, 100), label_id: labelId });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function deleteLabelRule(id: string) {
  const { workspace, supabase } = await getWorkspace();
  const { error } = await supabase
    .from("label_rules")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
