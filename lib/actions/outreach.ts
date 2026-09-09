"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { parseRecipients, type OutreachChannel } from "@/lib/outreach";
import { channelConfigured } from "@/lib/campaigns/providers";
import { workspaceHasMeta } from "@/lib/whatsapp-cloud";
import { processOutreachBatch } from "@/lib/outreach-process";
import { recordAudit } from "@/lib/audit-server";

// Direct sends run synchronously through the provider, each with a network
// round-trip, so keep an immediate batch bounded to stay within serverless
// limits. Larger scheduled batches are drained across cron runs.
const MAX_IMMEDIATE = 200;
const MAX_TOTAL = 5000;

/** Drop empty fields so we only store components the user actually set. */
function cleanComponents(c: NonNullable<OutreachInput["templateComponents"]>) {
  const out: Record<string, string> = {};
  if (c.headerText?.trim()) out.headerText = c.headerText.trim().slice(0, 300);
  if (c.headerMediaUrl?.trim() && c.headerMediaType) {
    out.headerMediaUrl = c.headerMediaUrl.trim();
    out.headerMediaType = c.headerMediaType;
  }
  if (c.buttonUrlParam?.trim()) out.buttonUrlParam = c.buttonUrlParam.trim().slice(0, 300);
  return Object.keys(out).length > 0 ? out : null;
}

/** Cancel a scheduled direct campaign before it runs (deletes it + its queue). */
export async function cancelOutreachBatch(batchId: string) {
  const { workspace, supabase } = await getWorkspace();
  const { data: batch } = await supabase
    .from("outreach_batches")
    .select("status")
    .eq("id", batchId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!batch) return { error: "Not found" };
  if (batch.status !== "scheduled") return { error: "Only scheduled campaigns can be cancelled" };

  // Recipients cascade on batch delete.
  const { error } = await supabase
    .from("outreach_batches")
    .delete()
    .eq("id", batchId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/outreach");
  return { ok: true };
}

export interface OutreachInput {
  channel: string;
  countryCode: string;
  recipientsRaw: string;
  message: string;
  subject?: string;
  saveContacts?: boolean;
  /** ISO time to send later; null/empty sends immediately. */
  scheduledAt?: string | null;
  /** WhatsApp Cloud approved template (compliant cold outreach). */
  templateName?: string;
  templateLang?: string;
  /** Body params for {{1}}, {{2}}… — may contain {{phone}} merge tokens. */
  templateParams?: string[];
  /** Optional header/button components. */
  templateComponents?: {
    headerText?: string;
    headerMediaType?: "image" | "document" | "video";
    headerMediaUrl?: string;
    buttonUrlParam?: string;
  };
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

  // WhatsApp Cloud template mode: an approved Meta template instead of free text
  // (the compliant way to start conversations with cold numbers).
  const templateName = channel === "whatsapp" ? input.templateName?.trim() : "";
  const useTemplate = !!templateName;
  const templateParams = (input.templateParams ?? [])
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 10);

  if (useTemplate) {
    if (!(await workspaceHasMeta(supabase, workspace.id))) {
      return { error: "WhatsApp isn't connected. Connect it in Settings first." };
    }
  } else {
    if (!input.message.trim()) return { error: "Message is required" };
    if (!channelConfigured(channel)) {
      return {
        error: `The ${channel} provider isn't configured. Add its API keys to the environment.`,
      };
    }
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
      message: useTemplate
        ? `Template: ${templateName}`
        : input.message.slice(0, 4000),
      subject: channel === "email" ? input.subject?.slice(0, 300) ?? null : null,
      total: recipients.length,
      status: scheduledAt ? "scheduled" : "sending",
      scheduled_at: scheduledAt,
      save_contacts: !!input.saveContacts,
      template_name: useTemplate ? templateName : null,
      template_lang: useTemplate ? (input.templateLang?.trim() || "ar") : null,
      template_params: useTemplate ? (templateParams as never) : null,
      template_components:
        useTemplate && input.templateComponents
          ? (cleanComponents(input.templateComponents) as never)
          : null,
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
