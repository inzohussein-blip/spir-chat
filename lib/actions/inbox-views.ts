"use server";

import { getWorkspace } from "@/lib/workspace";
import type { Json } from "@/lib/types/database";

export interface InboxViewFilters {
  status?: string;
  channel?: string;
  mine?: boolean;
  search?: string;
}

export async function createInboxView(name: string, filters: InboxViewFilters) {
  const { workspace, supabase } = await getWorkspace();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required" };
  const { data, error } = await supabase
    .from("inbox_views")
    .insert({
      workspace_id: workspace.id,
      name: trimmed.slice(0, 60),
      filters: filters as unknown as Json,
    })
    .select("id, name, filters")
    .single();
  if (error) return { error: error.message };
  return { ok: true, view: data };
}

export async function deleteInboxView(id: string) {
  const { workspace, supabase } = await getWorkspace();
  const { error } = await supabase
    .from("inbox_views")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };
  return { ok: true };
}
