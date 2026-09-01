"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { type CampaignChannel } from "@/lib/campaigns/providers";
import { deliverCampaign } from "@/lib/campaigns/send";
import { createTrackedLink } from "@/lib/actions/tracking";
import { isValidUrl } from "@/lib/tracking";
import { recordAudit } from "@/lib/audit-server";

const CHANNELS: CampaignChannel[] = ["email", "sms", "whatsapp"];

export async function createCampaign(input: {
  name: string;
  channel: string;
  subject?: string;
  body: string;
  bodyB?: string | null;
  segmentId?: string | null;
  scheduledAt?: string | null;
  linkUrl?: string | null;
}) {
  const { workspace, user, supabase } = await getWorkspace();
  const name = input.name.trim();
  const channel = (CHANNELS as string[]).includes(input.channel)
    ? input.channel
    : "email";
  if (!name || !input.body.trim()) {
    return { error: "Name and message are required" };
  }

  // A future schedule marks the campaign 'scheduled' for the cron to deliver.
  let scheduledAt: string | null = null;
  let status = "draft";
  if (input.scheduledAt) {
    const when = new Date(input.scheduledAt);
    if (isNaN(when.getTime())) return { error: "Invalid schedule time" };
    if (when.getTime() <= Date.now()) return { error: "Schedule time must be in the future" };
    scheduledAt = when.toISOString();
    status = "scheduled";
  }

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      workspace_id: workspace.id,
      name,
      channel,
      subject: input.subject?.trim() || null,
      body: input.body,
      body_b: input.bodyB?.trim() || null,
      segment_id: input.segmentId || null,
      scheduled_at: scheduledAt,
      status,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Optional tracked link: {link} in the body resolves to it at send time and
  // clicks are attributed to this campaign.
  if (input.linkUrl && isValidUrl(input.linkUrl.trim())) {
    await createTrackedLink({
      destinationUrl: input.linkUrl.trim(),
      label: name,
      campaignId: data.id,
    });
  }

  revalidatePath("/dashboard/campaigns");
  return { id: data.id };
}

/** Cancel a pending schedule, returning the campaign to draft. */
export async function cancelSchedule(id: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase
    .from("campaigns")
    .update({ status: "draft", scheduled_at: null })
    .eq("id", id)
    .eq("status", "scheduled");
  if (error) return { error: error.message };
  revalidatePath("/dashboard/campaigns");
  return { ok: true };
}

/** Send a draft (or scheduled) campaign now to all reachable subscribers. */
export async function sendCampaign(id: string) {
  const { workspace, user, supabase } = await getWorkspace();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, workspace_id, name, channel, subject, body, body_b, segment_id, status")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .single();
  if (!campaign) return { error: "Campaign not found" };

  const result = await deliverCampaign(supabase, campaign);
  if (!("error" in result)) {
    await recordAudit({
      workspaceId: workspace.id,
      actorId: user.id,
      actorLabel: user.email ?? null,
      action: "campaign.sent",
      targetLabel: campaign.name,
      metadata: { sent: result.sent, failed: result.failed },
    });
  }
  revalidatePath("/dashboard/campaigns");
  return result;
}

export async function deleteCampaign(id: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/campaigns");
  return { success: true };
}
