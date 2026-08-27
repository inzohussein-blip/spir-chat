"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { parseSegmentRules, applySegment, type SegmentRule } from "@/lib/segments";
import type { Json } from "@/lib/types/database";

export async function createSegment(name: string, rules: SegmentRule[]) {
  const { workspace, supabase } = await getWorkspace();
  if (!name.trim()) return { error: "Name is required" };
  const { data, error } = await supabase
    .from("segments")
    .insert({
      workspace_id: workspace.id,
      name: name.trim(),
      rules: parseSegmentRules(rules) as unknown as Json,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/dashboard/segments");
  return { id: data.id };
}

export async function updateSegment(id: string, name: string, rules: SegmentRule[]) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase
    .from("segments")
    .update({
      name: name.trim(),
      rules: parseSegmentRules(rules) as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/segments");
  return { success: true };
}

export async function deleteSegment(id: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("segments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/segments");
  return { success: true };
}

/** Live contact count matching a set of rules (for the builder preview). */
export async function countSegment(rules: SegmentRule[]) {
  const { workspace, supabase } = await getWorkspace();
  let query = supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);
  query = applySegment(query, parseSegmentRules(rules));
  const { count, error } = await query;
  if (error) return { error: error.message };
  return { count: count ?? 0 };
}
