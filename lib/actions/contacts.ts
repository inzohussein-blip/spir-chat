"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

// Cap a single bulk operation to keep the request bounded.
const MAX_BULK = 500;

/** Restrict a set of contact ids to those actually in the caller's workspace. */
async function scopeToWorkspace(
  supabase: Awaited<ReturnType<typeof getWorkspace>>["supabase"],
  workspaceId: string,
  contactIds: string[]
): Promise<string[]> {
  const ids = contactIds.slice(0, MAX_BULK);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("contacts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("id", ids);
  return (data ?? []).map((c) => c.id);
}

export async function bulkAddTag(contactIds: string[], tagId: string) {
  const { workspace, supabase } = await getWorkspace();
  if (!tagId) return { error: "Choose a tag" };

  // Verify the tag belongs to this workspace.
  const { data: tag } = await supabase
    .from("tags")
    .select("id")
    .eq("id", tagId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!tag) return { error: "Tag not found" };

  const ids = await scopeToWorkspace(supabase, workspace.id, contactIds);
  if (ids.length === 0) return { error: "No contacts selected" };

  const rows = ids.map((contact_id) => ({ contact_id, tag_id: tagId }));
  const { error } = await supabase
    .from("contact_tags")
    .upsert(rows, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/contacts");
  return { ok: true, count: ids.length };
}

export async function bulkSetSubscribed(contactIds: string[], subscribed: boolean) {
  const { workspace, supabase } = await getWorkspace();
  const ids = await scopeToWorkspace(supabase, workspace.id, contactIds);
  if (ids.length === 0) return { error: "No contacts selected" };

  const { error } = await supabase
    .from("contacts")
    .update({ is_subscribed: subscribed })
    .eq("workspace_id", workspace.id)
    .in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/contacts");
  return { ok: true, count: ids.length };
}

export async function bulkDeleteContacts(contactIds: string[]) {
  const { workspace, supabase } = await getWorkspace();
  const ids = await scopeToWorkspace(supabase, workspace.id, contactIds);
  if (ids.length === 0) return { error: "No contacts selected" };

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("workspace_id", workspace.id)
    .in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/contacts");
  return { ok: true, count: ids.length };
}
