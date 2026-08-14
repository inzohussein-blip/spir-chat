"use server";

import crypto from "crypto";
import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { generateApiKey, WEBHOOK_EVENTS } from "@/lib/api-keys";

/** Create an API key. The plaintext is returned ONCE and never stored. */
export async function createApiKey(name: string) {
  const { workspace, user, supabase } = await getWorkspace();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required" };

  const { plaintext, prefix, hash } = generateApiKey();
  const { error } = await supabase.from("api_keys").insert({
    workspace_id: workspace.id,
    name: trimmed,
    key_prefix: prefix,
    key_hash: hash,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/developers");
  // plaintext is shown to the user a single time.
  return { plaintext };
}

export async function deleteApiKey(id: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("api_keys").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/developers");
  return { success: true };
}

export async function createWebhook(url: string, events: string[]) {
  const { workspace, supabase } = await getWorkspace();
  const trimmed = url.trim();
  if (!/^https:\/\/.+/.test(trimmed)) {
    return { error: "A valid https:// URL is required" };
  }
  const validEvents = events.filter((e) =>
    (WEBHOOK_EVENTS as readonly string[]).includes(e)
  );

  const { error } = await supabase.from("webhook_endpoints").insert({
    workspace_id: workspace.id,
    url: trimmed,
    secret: `whsec_${crypto.randomBytes(24).toString("hex")}`,
    events: validEvents,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/developers");
  return { success: true };
}

export async function deleteWebhook(id: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("webhook_endpoints").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/developers");
  return { success: true };
}

export async function toggleWebhook(id: string, isActive: boolean) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase
    .from("webhook_endpoints")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/developers");
  return { success: true };
}
