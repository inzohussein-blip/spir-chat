import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import {
  sendCampaignMessage,
  channelConfigured,
  type CampaignChannel,
} from "@/lib/campaigns/providers";
import { renderMessageWithTracking } from "@/lib/tracking";
import { renderMergeVariables } from "@/lib/merge";
import { applySegment, parseSegmentRules } from "@/lib/segments";

type Client = SupabaseClient<Database>;

// Cap per-send so a single delivery stays within request limits.
export const MAX_RECIPIENTS = 200;

export interface DeliverableCampaign {
  id: string;
  workspace_id: string;
  channel: string;
  subject: string | null;
  body: string;
  segment_id: string | null;
  status: string;
}

/**
 * Deliver one campaign to its audience. Shared by the manual "send now" server
 * action and the scheduled-campaign cron, so channel handling and audience
 * resolution live in one place. Works with either the RLS or service client.
 */
export async function deliverCampaign(
  supabase: Client,
  campaign: DeliverableCampaign
): Promise<{ error: string } | { sent: number; failed: number }> {
  if (campaign.status === "sent" || campaign.status === "sending") {
    return { error: "Campaign already sent" };
  }

  const channel = campaign.channel as CampaignChannel;
  if (!channelConfigured(channel)) {
    return {
      error: `The ${channel} provider isn't configured. Add its API keys to the environment.`,
    };
  }

  await supabase.from("campaigns").update({ status: "sending" }).eq("id", campaign.id);

  // Audience: subscribed contacts reachable on this channel, narrowed by the
  // campaign's segment when one is set.
  const field = channel === "email" ? "email" : "phone";
  let audience = supabase
    .from("contacts")
    .select("id, display_name, email, phone")
    .eq("workspace_id", campaign.workspace_id)
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
    const merged = renderMergeVariables(campaign.body, {
      display_name: row.display_name,
      email: row.email,
      phone: row.phone,
    });
    const body = renderMessageWithTracking({
      message: merged,
      recipientName: row.display_name,
    });
    const res = await sendCampaignMessage(channel, recipient, campaign.subject ?? "", body);
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
      scheduled_at: null,
    })
    .eq("id", campaign.id);

  return { sent, failed };
}
