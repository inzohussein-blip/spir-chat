import "server-only";
import crypto from "crypto";

// Official Meta WhatsApp Cloud API integration. Env-configured for a single
// business number, mapped to one workspace (multi-tenant can come later):
//   META_WHATSAPP_TOKEN   — permanent access token
//   META_PHONE_NUMBER_ID  — the sending number's phone_number_id
//   META_WORKSPACE_ID     — the workspace that owns this number (for inbound)
//   META_VERIFY_TOKEN     — webhook verification challenge secret
//   META_APP_SECRET       — app secret, to verify inbound X-Hub-Signature-256
const GRAPH = "https://graph.facebook.com/v21.0";

export function metaConfigured(): boolean {
  return !!process.env.META_WHATSAPP_TOKEN && !!process.env.META_PHONE_NUMBER_ID;
}

export function metaWorkspaceId(): string | null {
  return process.env.META_WORKSPACE_ID || null;
}

export interface CloudSendResult {
  ok: boolean;
  error?: string;
  id?: string;
}

async function post(payload: Record<string, unknown>): Promise<CloudSendResult> {
  try {
    const res = await fetch(`${GRAPH}/${process.env.META_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.META_WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
      signal: AbortSignal.timeout(12000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data as { error?: { message?: string } })?.error?.message;
      return { ok: false, error: msg || `Meta ${res.status}` };
    }
    const id = (data as { messages?: { id?: string }[] })?.messages?.[0]?.id;
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "whatsapp cloud failed" };
  }
}

/** Free-form text — only deliverable inside the 24h customer service window. */
export function sendCloudText(to: string, body: string): Promise<CloudSendResult> {
  return post({ to, type: "text", text: { preview_url: false, body } });
}

/**
 * An approved message template — the compliant way to start a conversation.
 * `params` fill the body {{1}}, {{2}}… in order.
 */
export function sendCloudTemplate(
  to: string,
  name: string,
  languageCode: string,
  params: string[] = []
): Promise<CloudSendResult> {
  const components =
    params.length > 0
      ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }]
      : [];
  return post({
    to,
    type: "template",
    template: { name, language: { code: languageCode }, components },
  });
}

/** Constant-time verification of Meta's X-Hub-Signature-256 over the raw body. */
export function verifyMetaSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true; // not configured → skip (test mode)
  if (!signature || !signature.startsWith("sha256=")) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
