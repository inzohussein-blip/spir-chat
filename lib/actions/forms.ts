"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { parseFormFields, type FormField } from "@/lib/forms";
import type { Json } from "@/lib/types/database";

export async function createForm(name: string) {
  const { workspace, supabase } = await getWorkspace();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required" };

  const { data, error } = await supabase
    .from("forms")
    .insert({
      workspace_id: workspace.id,
      name: trimmed,
      fields: [
        { key: "name", label: "What's your name?", type: "text", required: true },
        { key: "email", label: "What's your email?", type: "email", required: true },
      ] as unknown as Json,
      success_message: "Thanks! We'll be in touch shortly.",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/dashboard/forms");
  return { id: data.id };
}

export async function updateForm(
  id: string,
  input: { name?: string; fields?: FormField[]; successMessage?: string; isActive?: boolean }
) {
  const { supabase } = await getWorkspace();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.fields !== undefined) {
    patch.fields = parseFormFields(input.fields) as unknown as Json;
  }
  if (input.successMessage !== undefined) {
    patch.success_message = input.successMessage.trim().slice(0, 500) || null;
  }
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { error } = await supabase.from("forms").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/forms");
  return { success: true };
}

export async function deleteForm(id: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("forms").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/forms");
  return { success: true };
}
