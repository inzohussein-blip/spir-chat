"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

/** Save a reusable direct-campaign template. */
export async function createOutreachTemplate(input: {
  name: string;
  subject?: string;
  body: string;
}) {
  const { workspace, supabase } = await getWorkspace();
  const name = input.name.trim();
  const body = input.body.trim();
  if (!name) return { error: "Name is required" };
  if (!body) return { error: "Message is required" };

  const { data, error } = await supabase
    .from("outreach_templates")
    .insert({
      workspace_id: workspace.id,
      name: name.slice(0, 120),
      subject: input.subject?.trim() ? input.subject.trim().slice(0, 300) : null,
      body: body.slice(0, 4000),
    })
    .select("id, name, subject, body")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/dashboard/outreach");
  return { ok: true, template: data };
}

/** Delete a direct-campaign template. */
export async function deleteOutreachTemplate(id: string) {
  const { workspace, supabase } = await getWorkspace();
  const { error } = await supabase
    .from("outreach_templates")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/outreach");
  return { ok: true };
}
