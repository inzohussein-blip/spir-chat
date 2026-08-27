"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

const FIELD_TYPES = ["text", "number", "boolean", "date", "url", "email"];

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "field"
  );
}

export async function createCustomFieldDefinition(name: string, type: string) {
  const { workspace, supabase } = await getWorkspace();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required" };
  const fieldType = FIELD_TYPES.includes(type) ? type : "text";

  // Ensure a unique slug within the workspace.
  const base = slugify(trimmed);
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data: clash } = await supabase
      .from("custom_field_definitions")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("slug", slug)
      .maybeSingle();
    if (!clash) break;
    slug = `${base}_${i}`;
  }

  const { data, error } = await supabase
    .from("custom_field_definitions")
    .insert({ workspace_id: workspace.id, name: trimmed, slug, type: fieldType })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/dashboard/contacts");
  return { ok: true, id: data.id };
}

export async function deleteCustomFieldDefinition(id: string) {
  const { workspace, supabase } = await getWorkspace();
  const { error } = await supabase
    .from("custom_field_definitions")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/contacts");
  return { ok: true };
}

/** Set a contact's value for a field; an empty value clears it. */
export async function setContactFieldValue(
  contactId: string,
  fieldId: string,
  value: string
) {
  const { workspace, supabase } = await getWorkspace();

  // Verify both the contact and the field belong to this workspace.
  const [{ data: contact }, { data: field }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
    supabase
      .from("custom_field_definitions")
      .select("id")
      .eq("id", fieldId)
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
  ]);
  if (!contact || !field) return { error: "Not found" };

  const trimmed = value.trim();
  if (!trimmed) {
    await supabase
      .from("contact_custom_fields")
      .delete()
      .eq("contact_id", contactId)
      .eq("field_id", fieldId);
  } else {
    const { error } = await supabase.from("contact_custom_fields").upsert(
      { contact_id: contactId, field_id: fieldId, value: trimmed, updated_at: new Date().toISOString() },
      { onConflict: "contact_id,field_id" }
    );
    if (error) return { error: error.message };
  }

  revalidatePath(`/dashboard/contacts/${contactId}`);
  return { ok: true };
}
