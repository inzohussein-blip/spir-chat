"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { generateTrackedLinkSlug, buildTrackedUrl, isValidUrl } from "@/lib/tracking";
import type { Json } from "@/lib/types/database";

// Meta comment automations reuse the trigger/flow plumbing: each automation is a
// published placeholder flow + a comment_keyword trigger whose config the Meta
// processor reads directly (the flow itself is never executed for Meta).

const FLOW_MARKER = "meta_automation";

export interface MetaAutomationInput {
  channelId: string;
  name: string;
  keywords: string[];
  matchType: "contains" | "exact" | "startsWith" | "word";
  replyText?: string;
  dmMessage: string;
  requireFollow?: boolean;
  followMessage?: string;
  buttons?: { label: string; destinationUrl: string }[];
}

/** Turn button destinations into tracked links, returning {label, url:/r/slug}. */
async function buildTrackedButtons(
  supabase: Awaited<ReturnType<typeof getWorkspace>>["supabase"],
  workspaceId: string,
  buttons: { label: string; destinationUrl: string }[]
): Promise<{ label: string; url: string }[]> {
  const out: { label: string; url: string }[] = [];
  for (const b of buttons.slice(0, 3)) {
    const label = b.label.trim();
    const dest = b.destinationUrl.trim();
    if (!label || !isValidUrl(dest)) continue;
    const slug = generateTrackedLinkSlug();
    const { error } = await supabase.from("tracked_links").insert({
      workspace_id: workspaceId,
      slug,
      label,
      destination_url: dest,
    });
    if (!error) out.push({ label: label.slice(0, 20), url: buildTrackedUrl(slug) });
  }
  return out;
}

function buildConfig(
  input: MetaAutomationInput,
  buttons: { label: string; url: string }[]
): Json {
  const keywords = input.keywords
    .map((k) => k.trim())
    .filter(Boolean)
    .map((value) => ({ value, matchType: input.matchType }));
  return {
    keywords,
    replyText: input.replyText?.trim() || undefined,
    dmMessage: input.dmMessage.trim(),
    dmButtons: buttons.length ? buttons : undefined,
    requireFollow: input.requireFollow === true,
    followMessage: input.followMessage?.trim() || undefined,
    _meta: true,
  } as unknown as Json;
}

export async function createMetaAutomation(input: MetaAutomationInput) {
  const { workspace, supabase } = await getWorkspace();
  if (!input.name.trim() || !input.dmMessage.trim() || input.keywords.filter((k) => k.trim()).length === 0) {
    return { error: "Name, at least one keyword, and a DM message are required" };
  }

  // Placeholder published flow so the comment-trigger query matches it.
  const { data: flow, error: flowError } = await supabase
    .from("flows")
    .insert({
      workspace_id: workspace.id,
      name: input.name.trim(),
      description: FLOW_MARKER,
      status: "published",
      published_at: new Date().toISOString(),
      nodes: [] as unknown as Json,
      edges: [] as unknown as Json,
    })
    .select("id")
    .single();
  if (flowError || !flow) return { error: flowError?.message ?? "Could not create automation" };

  const buttons = await buildTrackedButtons(supabase, workspace.id, input.buttons ?? []);

  const { error: triggerError } = await supabase.from("triggers").insert({
    flow_id: flow.id,
    channel_id: input.channelId,
    type: "comment_keyword",
    config: buildConfig(input, buttons),
    is_active: true,
  });
  if (triggerError) {
    await supabase.from("flows").delete().eq("id", flow.id);
    return { error: triggerError.message };
  }

  revalidatePath("/dashboard/ig-automations");
  return { success: true };
}

export async function updateMetaAutomation(
  triggerId: string,
  flowId: string,
  input: MetaAutomationInput
) {
  const { workspace, supabase } = await getWorkspace();
  const buttons = await buildTrackedButtons(supabase, workspace.id, input.buttons ?? []);

  await supabase.from("flows").update({ name: input.name.trim() }).eq("id", flowId);
  const { error } = await supabase
    .from("triggers")
    .update({ config: buildConfig(input, buttons) })
    .eq("id", triggerId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/ig-automations");
  return { success: true };
}

export async function toggleMetaAutomation(triggerId: string, isActive: boolean) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase
    .from("triggers")
    .update({ is_active: isActive })
    .eq("id", triggerId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/ig-automations");
  return { success: true };
}

export async function deleteMetaAutomation(triggerId: string, flowId: string) {
  const { supabase } = await getWorkspace();
  // Deleting the flow cascades to its trigger.
  const { error } = await supabase.from("flows").delete().eq("id", flowId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/ig-automations");
  return { success: true };
}
