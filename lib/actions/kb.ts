"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/slug";

export async function createArticle(input: {
  title: string;
  category?: string;
  body?: string;
}) {
  const { workspace, supabase } = await getWorkspace();
  const title = input.title.trim();
  if (!title) return { error: "Title is required" };

  // Ensure the slug is unique within the workspace.
  let slug = slugify(title);
  const { data: existing } = await supabase
    .from("kb_articles")
    .select("slug")
    .eq("workspace_id", workspace.id)
    .like("slug", `${slug}%`);
  if (existing?.some((e) => e.slug === slug)) {
    slug = `${slug}-${(existing.length + 1).toString(36)}`;
  }

  const { data, error } = await supabase
    .from("kb_articles")
    .insert({
      workspace_id: workspace.id,
      title,
      slug,
      category: input.category?.trim() || null,
      body: input.body ?? "",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/dashboard/help-center");
  return { id: data.id };
}

export async function updateArticle(
  id: string,
  input: { title?: string; category?: string; body?: string }
) {
  const { supabase } = await getWorkspace();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.category !== undefined) patch.category = input.category.trim() || null;
  if (input.body !== undefined) patch.body = input.body;

  const { error } = await supabase.from("kb_articles").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/help-center");
  return { success: true };
}

export async function togglePublish(id: string, isPublished: boolean) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase
    .from("kb_articles")
    .update({ is_published: isPublished, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/help-center");
  return { success: true };
}

export async function deleteArticle(id: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("kb_articles").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/help-center");
  return { success: true };
}
