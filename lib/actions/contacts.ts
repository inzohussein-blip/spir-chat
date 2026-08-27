"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import type { ImportedContact } from "@/lib/csv";

// Cap a single bulk operation to keep the request bounded.
const MAX_BULK = 500;
const MAX_IMPORT = 1000;

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

/**
 * Import contacts from parsed CSV records. Existing contacts are matched by
 * email (case-insensitive), then by phone, and updated in place; the rest are
 * inserted. Returns how many were created vs updated.
 */
export async function importContacts(records: ImportedContact[]) {
  const { workspace, supabase } = await getWorkspace();
  const rows = records.slice(0, MAX_IMPORT).filter((r) => r.email || r.phone);
  if (rows.length === 0) return { error: "No importable rows (need an email or phone)" };

  // Existing contacts for dedup.
  const { data: existing } = await supabase
    .from("contacts")
    .select("id, email, phone")
    .eq("workspace_id", workspace.id);

  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  for (const c of existing ?? []) {
    if (c.email) byEmail.set(c.email.toLowerCase(), c.id);
    if (c.phone) byPhone.set(c.phone, c.id);
  }

  const toInsert: {
    workspace_id: string;
    display_name: string | null;
    email: string | null;
    phone: string | null;
    is_subscribed: boolean;
  }[] = [];
  const updates: { id: string; rec: ImportedContact }[] = [];
  // Track ids matched within this batch so duplicate rows don't double-insert.
  const seenEmail = new Map<string, string>();
  const seenPhone = new Map<string, string>();

  for (const rec of rows) {
    const emailKey = rec.email?.toLowerCase();
    const existingId =
      (emailKey && (byEmail.get(emailKey) ?? seenEmail.get(emailKey))) ||
      (rec.phone && (byPhone.get(rec.phone) ?? seenPhone.get(rec.phone))) ||
      null;

    if (existingId) {
      updates.push({ id: existingId, rec });
    } else {
      toInsert.push({
        workspace_id: workspace.id,
        display_name: rec.display_name,
        email: rec.email,
        phone: rec.phone,
        is_subscribed: rec.is_subscribed,
      });
    }
    // Record keys so later duplicate rows in the same file merge, not duplicate.
    if (emailKey && !seenEmail.has(emailKey)) seenEmail.set(emailKey, existingId ?? "pending");
    if (rec.phone && !seenPhone.has(rec.phone)) seenPhone.set(rec.phone, existingId ?? "pending");
  }

  let created = 0;
  if (toInsert.length > 0) {
    const { data, error } = await supabase.from("contacts").insert(toInsert).select("id");
    if (error) return { error: error.message };
    created = data?.length ?? 0;
  }

  let updated = 0;
  for (const { id, rec } of updates) {
    const patch: Record<string, unknown> = { is_subscribed: rec.is_subscribed };
    if (rec.display_name) patch.display_name = rec.display_name;
    if (rec.email) patch.email = rec.email;
    if (rec.phone) patch.phone = rec.phone;
    const { error } = await supabase
      .from("contacts")
      .update(patch)
      .eq("id", id)
      .eq("workspace_id", workspace.id);
    if (!error) updated += 1;
  }

  revalidatePath("/dashboard/contacts");
  return { ok: true, created, updated };
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
