"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

/** Add a private note to a contact. */
export async function addContactNote(contactId: string, body: string) {
  const text = body.trim();
  if (!text) return { error: "Note is empty" };
  const { workspace, user, supabase } = await getWorkspace();

  // Verify the contact belongs to this workspace.
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!contact) return { error: "Contact not found" };

  const { data, error } = await supabase
    .from("contact_notes")
    .insert({
      contact_id: contactId,
      workspace_id: workspace.id,
      author_id: user.id,
      body: text.slice(0, 2000),
    })
    .select("id, body, author_id, created_at")
    .single();
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/contacts/${contactId}`);
  return { ok: true, note: data };
}

/** Delete a contact note (workspace-scoped by RLS). */
export async function deleteContactNote(noteId: string) {
  const { workspace, supabase } = await getWorkspace();
  const { error } = await supabase
    .from("contact_notes")
    .delete()
    .eq("id", noteId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };
  return { ok: true };
}
