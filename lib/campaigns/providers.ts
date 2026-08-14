// Campaign delivery providers (feature 6). All calls are HTTP via fetch, so no
// extra dependencies. Each provider is env-gated and returns ok/error.
//
// Env:
//   Email (Resend):    RESEND_API_KEY, CAMPAIGN_FROM_EMAIL
//   SMS/WhatsApp (Twilio): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
//                          TWILIO_SMS_FROM, TWILIO_WHATSAPP_FROM

export type CampaignChannel = "email" | "sms" | "whatsapp";

export interface SendResult {
  ok: boolean;
  error?: string;
}

/** Whether a channel has the env configured to actually send. */
export function channelConfigured(channel: CampaignChannel): boolean {
  if (channel === "email") {
    return !!process.env.RESEND_API_KEY && !!process.env.CAMPAIGN_FROM_EMAIL;
  }
  const twilio =
    !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN;
  if (channel === "sms") return twilio && !!process.env.TWILIO_SMS_FROM;
  return twilio && !!process.env.TWILIO_WHATSAPP_FROM;
}

async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<SendResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.CAMPAIGN_FROM_EMAIL,
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
  whatsapp: boolean
): Promise<SendResult> {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN!;
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

/** Send one message on a channel to one recipient (email address or phone). */
export async function sendCampaignMessage(
  channel: CampaignChannel,
  recipient: string,
  subject: string,
  body: string
): Promise<SendResult> {
  if (channel === "email") return sendEmail(recipient, subject, body);
  if (channel === "sms") {
    return sendTwilio(recipient, body, process.env.TWILIO_SMS_FROM!, false);
  }
  return sendTwilio(recipient, body, process.env.TWILIO_WHATSAPP_FROM!, true);
}
