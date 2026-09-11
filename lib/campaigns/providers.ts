// Campaign delivery providers (feature 6). All calls are HTTP via fetch, so no
// extra dependencies. Each provider returns ok/error.
//
// Credentials resolve per-workspace first (set in the app, stored on the
// workspace row), falling back to deployment-wide env vars:
//   Email (Resend):        RESEND_API_KEY, CAMPAIGN_FROM_EMAIL
//   SMS/WhatsApp (Twilio):  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
//                           TWILIO_SMS_FROM, TWILIO_WHATSAPP_FROM
//   Telegram (gateway):     TELEGRAM_GATEWAY_URL, TELEGRAM_GATEWAY_TOKEN

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { decryptToken } from "@/lib/meta/oauth";

export type CampaignChannel = "email" | "sms" | "whatsapp" | "telegram";

export interface SendResult {
  ok: boolean;
  error?: string;
}

/** Resolved provider credentials for one workspace (or the env defaults). */
export interface ProviderConfig {
  resendApiKey: string | null;
  campaignFromEmail: string | null;
  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
  twilioSmsFrom: string | null;
  twilioWhatsappFrom: string | null;
  telegramGatewayUrl: string | null;
  telegramGatewayToken: string | null;
}

/** Deployment-wide defaults from env. */
export function envProviderConfig(): ProviderConfig {
  return {
    resendApiKey: process.env.RESEND_API_KEY ?? null,
    campaignFromEmail: process.env.CAMPAIGN_FROM_EMAIL ?? null,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? null,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? null,
    twilioSmsFrom: process.env.TWILIO_SMS_FROM ?? null,
    twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM ?? null,
    telegramGatewayUrl: process.env.TELEGRAM_GATEWAY_URL ?? null,
    telegramGatewayToken: process.env.TELEGRAM_GATEWAY_TOKEN ?? null,
  };
}

function tryDecrypt(v: string | null): string | null {
  if (!v) return null;
  try {
    return decryptToken(v);
  } catch {
    return null;
  }
}

/**
 * Merge a workspace's stored credentials over the env defaults. Workspace values
 * win when present; secrets are stored encrypted and decrypted here.
 */
export async function resolveWorkspaceProviders(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<ProviderConfig> {
  const env = envProviderConfig();
  const { data: ws } = await supabase
    .from("workspaces")
    .select(
      "resend_api_key, campaign_from_email, twilio_account_sid, twilio_auth_token, twilio_sms_from, twilio_whatsapp_from, telegram_gateway_url, telegram_gateway_token"
    )
    .eq("id", workspaceId)
    .maybeSingle();
  if (!ws) return env;

  return {
    resendApiKey: tryDecrypt(ws.resend_api_key) ?? env.resendApiKey,
    campaignFromEmail: ws.campaign_from_email?.trim() || env.campaignFromEmail,
    twilioAccountSid: ws.twilio_account_sid?.trim() || env.twilioAccountSid,
    twilioAuthToken: tryDecrypt(ws.twilio_auth_token) ?? env.twilioAuthToken,
    twilioSmsFrom: ws.twilio_sms_from?.trim() || env.twilioSmsFrom,
    twilioWhatsappFrom: ws.twilio_whatsapp_from?.trim() || env.twilioWhatsappFrom,
    telegramGatewayUrl: ws.telegram_gateway_url?.trim() || env.telegramGatewayUrl,
    telegramGatewayToken: tryDecrypt(ws.telegram_gateway_token) ?? env.telegramGatewayToken,
  };
}

/** Whether a channel has the credentials configured to actually send. */
export function channelConfigured(
  channel: CampaignChannel,
  cfg: ProviderConfig = envProviderConfig()
): boolean {
  if (channel === "email") {
    return !!cfg.resendApiKey && !!cfg.campaignFromEmail;
  }
  if (channel === "telegram") {
    return !!cfg.telegramGatewayUrl && !!cfg.telegramGatewayToken;
  }
  const twilio = !!cfg.twilioAccountSid && !!cfg.twilioAuthToken;
  if (channel === "sms") return twilio && !!cfg.twilioSmsFrom;
  return twilio && !!cfg.twilioWhatsappFrom;
}

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  cfg: ProviderConfig
): Promise<SendResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: cfg.campaignFromEmail,
        to,
        subject: subject || "(no subject)",
        text: body,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "email failed" };
  }
}

async function sendTwilio(
  to: string,
  body: string,
  from: string,
  whatsapp: boolean,
  cfg: ProviderConfig
): Promise<SendResult> {
  try {
    const sid = cfg.twilioAccountSid!;
    const token = cfg.twilioAuthToken!;
    const params = new URLSearchParams({
      To: whatsapp ? `whatsapp:${to}` : to,
      From: whatsapp ? `whatsapp:${from}` : from,
      Body: body,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return { ok: false, error: `Twilio ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "sms failed" };
  }
}

/**
 * Send one message to a Telegram user (phone in +E.164 or a @username) via an
 * external GramJS gateway. The gateway runs a real user account (MTProto),
 * which the official Bot API can't do — see services/telegram-gateway.
 */
async function sendTelegram(
  to: string,
  body: string,
  cfg: ProviderConfig
): Promise<SendResult> {
  try {
    const base = cfg.telegramGatewayUrl!.replace(/\/$/, "");
    const res = await fetch(`${base}/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.telegramGatewayToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, message: body }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Telegram gateway ${res.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`,
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "telegram failed" };
  }
}

/** Send one message on a channel to one recipient (email address or phone). */
export async function sendCampaignMessage(
  channel: CampaignChannel,
  recipient: string,
  subject: string,
  body: string,
  cfg: ProviderConfig = envProviderConfig()
): Promise<SendResult> {
  if (channel === "email") return sendEmail(recipient, subject, body, cfg);
  if (channel === "telegram") return sendTelegram(recipient, body, cfg);
  if (channel === "sms") {
    return sendTwilio(recipient, body, cfg.twilioSmsFrom!, false, cfg);
  }
  return sendTwilio(recipient, body, cfg.twilioWhatsappFrom!, true, cfg);
}
