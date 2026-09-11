"use server";

import { getWorkspace } from "@/lib/workspace";
import { encryptToken } from "@/lib/meta/oauth";
import { revalidatePath } from "next/cache";

export interface CampaignProvidersInput {
  // Secrets — only written when a new (non-empty) value is provided.
  resendApiKey?: string;
  twilioAuthToken?: string;
  telegramGatewayToken?: string;
  // Plain identifiers — always written (empty clears them).
  campaignFromEmail?: string;
  twilioAccountSid?: string;
  twilioSmsFrom?: string;
  twilioWhatsappFrom?: string;
  telegramGatewayUrl?: string;
}

/**
 * Save the workspace's campaign provider credentials (email/SMS/Telegram) so
 * they can be configured from the app instead of only env vars. Secret fields
 * are encrypted; blank secrets keep the stored value unchanged.
 */
export async function updateCampaignProviders(input: CampaignProvidersInput) {
  const { workspace, supabase } = await getWorkspace();

  const update: Record<string, string | null> = {
    campaign_from_email: input.campaignFromEmail?.trim() || null,
    twilio_account_sid: input.twilioAccountSid?.trim() || null,
    twilio_sms_from: input.twilioSmsFrom?.trim() || null,
    twilio_whatsapp_from: input.twilioWhatsappFrom?.trim() || null,
    telegram_gateway_url: input.telegramGatewayUrl?.trim() || null,
  };

  if (input.resendApiKey?.trim()) {
    update.resend_api_key = encryptToken(input.resendApiKey.trim());
  }
  if (input.twilioAuthToken?.trim()) {
    update.twilio_auth_token = encryptToken(input.twilioAuthToken.trim());
  }
  if (input.telegramGatewayToken?.trim()) {
    update.telegram_gateway_token = encryptToken(input.telegramGatewayToken.trim());
  }

  const { error } = await supabase
    .from("workspaces")
    .update(update)
    .eq("id", workspace.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/outreach");
  return { ok: true as const };
}
