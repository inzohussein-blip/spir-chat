"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import {
  sendCampaignMessage,
  channelConfigured,
  type CampaignChannel,
} from "@/lib/campaigns/providers";
import { renderMessageWithTracking } from "@/lib/tracking";
import { applySegment, parseSegmentRules } from "@/lib/segments";

const CHANNELS: CampaignChannel[] = ["email", "sms", "whatsapp"];
// Cap per-send so the server action stays within request limits (baseline).
const MAX_RECIPIENTS = 200;

export async function createCampaign(input: {
  name: string;
  channel: string;
  subject?: string;
  body: string;
  segmentId?: string | null;
}) {
  const { workspace, user, supabase } = await getWorkspace();
  const name = input.name.trim();
  const channel = (CHANNELS as string[]).includes(input.channel)
    ? input.channel
    : "email";
  if (!name || !input.body.trim()) {
    return { error: "Name and message are required" };
  }

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      workspace_id: workspace.id,
      name,
      channel,
      subject: input.subject?.trim() || null,
      body: input.body,
      segment_id: input.segmentId || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/dashboard/campaigns");
  return { id: data.id };
}

/** Send a draft campaign to all subscribed contacts reachable on its channel. */
export async function sendCampaign(id: string) {
  const { workspace, supabase } = await getWorkspace();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();
  if (!campaign) return { error: "Campaign not found" };
  if (campaign.status === "sent" || campaign.status === "sending") {
    return { error: "Campaign already sent" };
  }

  const channel = campaign.channel as CampaignChannel;
  if (!channelConfigured(channel)) {
    return {
      error: `The ${channel} provider isn't configured. Add its API keys to the environment.`,
    };
  }

  await supabase.from("campaigns").update({ status: "sending" }).eq("id", id);

  // Audience: subscribed contacts with the field this channel needs, further
  // narrowed by the campaign's segment when one is set.
  const field = channel === "email" ? "email" : "phone";
  let audience = supabase
    .from("contacts")
    .select(`id, display_name, ${field}`)
    .eq("workspace_id", workspace.id)
    .eq("is_subscribed", true)
    .not(field, "is", null);

  if (campaign.segment_id) {
    const { data: segment } = await supabase
      .from("segments")
      .select("rules")
      .eq("id", campaign.segment_id)
      .maybeSingle();
    if (segment) audience = applySegment(audience, parseSegmentRules(segment.rules));
  }

  const { data: contacts } = await audience.limit(MAX_RECIPIENTS);

  let sent = 0;
  let failed = 0;
  for (const c of contacts ?? []) {
    const row = c as Record<string, string | null>;
    const recipient = row[field];
    if (!recipient) continue;
    // Personalize {username}; strip any leftover {link} token.
    const body = renderMessageWithTracking({
      message: campaign.body,
      recipientName: row.display_name,
    });
    const res = await sendCampaignMessage(
      channel,
      recipient,
      campaign.subject ?? "",
      body
    );
    if (res.ok) sent++;
    else failed++;
  }

  await supabase
    .from("campaigns")
    .update({
      status: "sent",
      sent_count: sent,
      failed_count: failed,
      sent_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/dashboard/campaigns");
  return { sent, failed };
}

export async function deleteCampaign(id: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/campaigns");
  return { success: true };
}
