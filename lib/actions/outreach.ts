"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { parseRecipients, type OutreachChannel } from "@/lib/outreach";
import { channelConfigured, sendCampaignMessage } from "@/lib/campaigns/providers";
import { renderMergeVariables } from "@/lib/merge";
import { recordAudit } from "@/lib/audit-server";

// Direct sends run synchronously through the provider, each with a network
// round-trip, so keep the batch bounded to stay within serverless limits.
const MAX_DIRECT_RECIPIENTS = 200;

export interface OutreachInput {
  channel: string;
  countryCode: string;
  recipientsRaw: string;
  message: string;
  subject?: string;
  /** Create/link a contact record for each recipient (default false). */
  saveContacts?: boolean;
}

/**
 * Send a template immediately to an ad-hoc list of phone numbers or emails.
 * Reuses the campaign provider layer, records a batch + per-recipient outcomes,
 * and (optionally) files each recipient as a contact so replies can be matched.
 */
export async function sendOutreach(input: OutreachInput) {
  const { workspace, user, supabase } = await getWorkspace();

  const channel = input.channel as OutreachChannel;
  if (!["email", "sms", "whatsapp"].includes(channel)) {
    return { error: "Unsupported channel" };
  }
  if (!input.message.trim()) return { error: "Message is required" };
  if (!channelConfigured(channel)) {
    return {
      error: `The ${channel} provider isn't configured. Add its API keys to the environment.`,
    };
  }

  const { valid, invalid } = parseRecipients(
    input.recipientsRaw,
    channel,
    input.countryCode
  );
  if (valid.length === 0) {
    return { error: "No valid recipients found", invalid: invalid.length };
  }
  const recipients = valid.slice(0, MAX_DIRECT_RECIPIENTS);

  // Record the batch up front so progress is visible even if the request is cut.
  const { data: batch, error: batchErr } = await supabase
    .from("outreach_batches")
    .insert({
      workspace_id: workspace.id,
      created_by: user.id,
      channel,
      message: input.message.slice(0, 4000),
      subject: channel === "email" ? input.subject?.slice(0, 300) ?? null : null,
      total: recipients.length,
    })
    .select("id")
    .single();
  if (batchErr || !batch) return { error: batchErr?.message ?? "Could not start batch" };

  const isEmail = channel === "email";
  let sent = 0;
  let failed = 0;
  const rows: {
    batch_id: string;
    workspace_id: string;
    recipient: string;
    contact_id: string | null;
    status: "sent" | "failed";
    error: string | null;
  }[] = [];

  for (const recipient of recipients) {
    // Optionally file the recipient as a contact (matched by email/phone).
    let contactId: string | null = null;
    if (input.saveContacts) {
      contactId = await upsertContact(supabase, workspace.id, isEmail, recipient);
    }

    const body = renderMergeVariables(input.message, {
      display_name: null,
      email: isEmail ? recipient : null,
      phone: isEmail ? null : recipient,
    });
    const res = await sendCampaignMessage(channel, recipient, input.subject ?? "", body);
    if (res.ok) sent++;
    else failed++;
    rows.push({
      batch_id: batch.id,
      workspace_id: workspace.id,
      recipient,
      contact_id: contactId,
      status: res.ok ? "sent" : "failed",
      error: res.ok ? null : res.error ?? "Unknown error",
    });
  }

  if (rows.length > 0) await supabase.from("outreach_recipients").insert(rows);
  await supabase
    .from("outreach_batches")
    .update({ sent_count: sent, failed_count: failed })
    .eq("id", batch.id);

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
    capped: valid.length > MAX_DIRECT_RECIPIENTS ? valid.length - MAX_DIRECT_RECIPIENTS : 0,
  };
}

/** Find a contact by the address, or create an unsubscribed one. Returns id. */
async function upsertContact(
  supabase: Awaited<ReturnType<typeof getWorkspace>>["supabase"],
  workspaceId: string,
  isEmail: boolean,
  recipient: string
): Promise<string | null> {
  const field = isEmail ? "email" : "phone";
  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq(field, recipient)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("contacts")
    .insert({
      workspace_id: workspaceId,
      [field]: recipient,
      is_subscribed: false,
    })
    .select("id")
    .single();
  return created?.id ?? null;
}
