"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { parseRecipients, type OutreachChannel } from "@/lib/outreach";
import { channelConfigured } from "@/lib/campaigns/providers";
import { processOutreachBatch } from "@/lib/outreach-process";
import { recordAudit } from "@/lib/audit-server";

// Direct sends run synchronously through the provider, each with a network
// round-trip, so keep an immediate batch bounded to stay within serverless
// limits. Larger scheduled batches are drained across cron runs.
const MAX_IMMEDIATE = 200;
const MAX_TOTAL = 5000;

export interface OutreachInput {
  channel: string;
  countryCode: string;
  recipientsRaw: string;
  message: string;
  subject?: string;
  saveContacts?: boolean;
  /** ISO time to send later; null/empty sends immediately. */
  scheduledAt?: string | null;
}

/**
 * Queue a direct campaign to an ad-hoc list of phone numbers, emails, or
 * Telegram handles. Sends immediately, or schedules for later (drained by the
 * jobs cron). Records a batch + per-recipient rows and reuses the shared
 * processor so channel handling lives in one place.
 */
export async function sendOutreach(input: OutreachInput) {
  const { workspace, user, supabase } = await getWorkspace();

  const channel = input.channel as OutreachChannel;
  if (!["email", "sms", "whatsapp", "telegram"].includes(channel)) {
    return { error: "Unsupported channel" };
  }
  if (!input.message.trim()) return { error: "Message is required" };
  if (!channelConfigured(channel)) {
    return {
      error: `The ${channel} provider isn't configured. Add its API keys to the environment.`,
    };
  }

  // Validate a schedule time if provided.
  let scheduledAt: string | null = null;
  if (input.scheduledAt) {
    const when = new Date(input.scheduledAt);
    if (isNaN(when.getTime())) return { error: "Invalid schedule time" };
    if (when.getTime() <= Date.now()) return { error: "Schedule time must be in the future" };
    scheduledAt = when.toISOString();
  }

  const { valid, invalid } = parseRecipients(input.recipientsRaw, channel, input.countryCode);
  if (valid.length === 0) {
    return { error: "No valid recipients found", invalid: invalid.length };
  }
  const recipients = valid.slice(0, MAX_TOTAL);

  const { data: batch, error: batchErr } = await supabase
    .from("outreach_batches")
    .insert({
      workspace_id: workspace.id,
      created_by: user.id,
      channel,
      message: input.message.slice(0, 4000),
      subject: channel === "email" ? input.subject?.slice(0, 300) ?? null : null,
      total: recipients.length,
      status: scheduledAt ? "scheduled" : "sending",
      scheduled_at: scheduledAt,
      save_contacts: !!input.saveContacts,
    })
    .select("id")
    .single();
  if (batchErr || !batch) return { error: batchErr?.message ?? "Could not start batch" };

  // Store the pending recipient list up front (so a scheduled batch has its
  // audience, and an interrupted immediate send can be resumed by the cron).
  const rows = recipients.map((recipient) => ({
    batch_id: batch.id,
    workspace_id: workspace.id,
    recipient,
    status: "pending",
  }));
  // Insert in chunks to keep each statement reasonable.
  for (let i = 0; i < rows.length; i += 500) {
    await supabase.from("outreach_recipients").insert(rows.slice(i, i + 500));
  }

  if (scheduledAt) {
    revalidatePath("/dashboard/outreach");
    return {
      ok: true,
      scheduled: true,
      batchId: batch.id,
      count: recipients.length,
      invalid: invalid.length,
    };
  }

  // Immediate: process up to the synchronous cap now; any overflow is left
  // pending and picked up by the cron.
  if (recipients.length > MAX_IMMEDIATE) {
    await supabase
      .from("outreach_batches")
      .update({ status: "scheduled", scheduled_at: new Date().toISOString() })
      .eq("id", batch.id);
  }
  const { sent, failed } = await processOutreachBatch(supabase, batch.id);

  await recordAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    actorLabel: user.email ?? null,
    action: "outreach.sent",
    targetLabel: `${sent}/${recipients.length} via ${channel}`,
    metadata: { channel, sent, failed, batch_id: batch.id },
  });

  revalidatePath("/dashboard/outreach");
  return {
    ok: true,
    batchId: batch.id,
    sent,
    failed,
    invalid: invalid.length,
    queued: recipients.length > MAX_IMMEDIATE ? recipients.length - MAX_IMMEDIATE : 0,
  };
}
