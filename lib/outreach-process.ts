import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { sendCampaignMessage, type CampaignChannel } from "@/lib/campaigns/providers";
import { sendCloudTemplate, resolveWorkspaceMeta } from "@/lib/whatsapp-cloud";
import { renderMergeVariables } from "@/lib/merge";

type Client = SupabaseClient<Database>;

// Bounded per invocation to stay within serverless limits; the cron re-drains
// any that remain pending on its next run.
const MAX_PER_RUN = 200;

/** Find a contact by the address, or create an unsubscribed one. Returns id. */
async function upsertContact(
  supabase: Client,
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
    .insert({ workspace_id: workspaceId, [field]: recipient, is_subscribed: false })
    .select("id")
    .single();
  return created?.id ?? null;
}

/**
 * Send every still-pending recipient of a batch and flip the batch to 'sent'.
 * Shared by the immediate send action and the scheduled-batch cron, so channel
 * handling and contact filing live in one place. Best-effort per recipient.
 */
export async function processOutreachBatch(
  supabase: Client,
  batchId: string
): Promise<{ sent: number; failed: number }> {
  const { data: batch } = await supabase
    .from("outreach_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch || batch.status === "sent") {
    return { sent: batch?.sent_count ?? 0, failed: batch?.failed_count ?? 0 };
  }

  await supabase.from("outreach_batches").update({ status: "sending" }).eq("id", batchId);

  const channel = batch.channel as CampaignChannel;
  const isEmail = channel === "email";
  const canFileContact = channel !== "telegram"; // usernames don't map to phone/email

  // WhatsApp Cloud approved-template mode (compliant cold outreach).
  const templateName = (batch as { template_name?: string | null }).template_name || null;
  const templateLang = (batch as { template_lang?: string | null }).template_lang || "ar";
  const templateParams = Array.isArray((batch as { template_params?: unknown }).template_params)
    ? ((batch as { template_params?: unknown }).template_params as string[])
    : [];
  // Resolve the workspace's WhatsApp Cloud credentials once for template sends.
  const metaCreds = templateName
    ? await resolveWorkspaceMeta(supabase, batch.workspace_id)
    : null;

  const { data: recipients } = await supabase
    .from("outreach_recipients")
    .select("id, recipient, contact_id")
    .eq("batch_id", batchId)
    .eq("status", "pending")
    .limit(MAX_PER_RUN);

  let sent = 0;
  let failed = 0;
  for (const r of recipients ?? []) {
    let contactId = r.contact_id;
    if (batch.save_contacts && canFileContact && !contactId) {
      contactId = await upsertContact(supabase, batch.workspace_id, isEmail, r.recipient);
    }
    let res;
    if (templateName) {
      // Render each body param per recipient (supports {{phone}} tokens).
      const params = templateParams.map((p) =>
        renderMergeVariables(p, { display_name: null, email: null, phone: r.recipient })
      );
      res = await sendCloudTemplate(r.recipient, templateName, templateLang, params, metaCreds);
    } else {
      const body = renderMergeVariables(batch.message, {
        display_name: null,
        email: isEmail ? r.recipient : null,
        phone: isEmail ? null : r.recipient,
      });
      res = await sendCampaignMessage(channel, r.recipient, batch.subject ?? "", body);
    }
    if (res.ok) sent++;
    else failed++;
    await supabase
      .from("outreach_recipients")
      .update({
        status: res.ok ? "sent" : "failed",
        error: res.ok ? null : res.error ?? "Unknown error",
        contact_id: contactId,
      })
      .eq("id", r.id);
  }

  // Any pending left (batch larger than MAX_PER_RUN) keeps the batch open for
  // the next drain; otherwise close it out with the accumulated totals.
  const { count: stillPending } = await supabase
    .from("outreach_recipients")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "pending");

  await supabase
    .from("outreach_batches")
    .update({
      status: (stillPending ?? 0) > 0 ? "scheduled" : "sent",
      sent_count: (batch.sent_count ?? 0) + sent,
      failed_count: (batch.failed_count ?? 0) + failed,
    })
    .eq("id", batchId);

  return { sent, failed };
}

/**
 * Drain outreach batches whose scheduled time has passed. Called from the daily
 * jobs cron. Returns how many recipients were processed.
 */
export async function drainScheduledOutreach(supabase: Client): Promise<number> {
  const { data: due } = await supabase
    .from("outreach_batches")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .limit(20);

  let processed = 0;
  for (const b of due ?? []) {
    const { sent, failed } = await processOutreachBatch(supabase, b.id);
    processed += sent + failed;
  }
  return processed;
}
