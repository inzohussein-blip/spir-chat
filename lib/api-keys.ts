// Public API key + webhook helpers (feature 18). Server-only (uses node:crypto).

import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { type WebhookEvent } from "@/lib/webhook-events";

export { WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/webhook-events";

/** Generate a new API key: returns the plaintext (shown once) + its stored parts. */
export function generateApiKey(): {
  plaintext: string;
  prefix: string;
  hash: string;
} {
  const random = crypto.randomBytes(24).toString("hex");
  const plaintext = `sk_live_${random}`;
  return {
    plaintext,
    prefix: plaintext.slice(0, 14), // "sk_live_" + 6 chars
    hash: hashApiKey(plaintext),
  };
}

/** SHA-256 hash used to store/compare API keys. */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Resolve a Bearer token to its workspace. Returns the workspace id + key id, or
 * null when the token is missing/invalid. Touches last_used_at (best-effort).
 */
export async function authenticateApiKey(
  authorizationHeader: string | null
): Promise<{ workspaceId: string; keyId: string } | null> {
  if (!authorizationHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  const token = match?.[1]?.trim();
  if (!token || !token.startsWith("sk_")) return null;

  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("api_keys")
    .select("id, workspace_id")
    .eq("key_hash", hashApiKey(token))
    .maybeSingle();
  if (!data) return null;

  void supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return { workspaceId: data.workspace_id, keyId: data.id };
}

/** HMAC-SHA256 signature (hex) of a payload string using an endpoint secret. */
export function signWebhookPayload(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Fire an event to all active webhook endpoints in a workspace subscribed to it.
 * Fire-and-forget: failures are swallowed so the caller's request never blocks
 * on a slow/broken customer endpoint.
 */
export async function dispatchWebhook(
  workspaceId: string,
  event: WebhookEvent,
  data: unknown
): Promise<void> {
  try {
    const supabase = await createServiceClient();
    const { data: endpoints } = await supabase
      .from("webhook_endpoints")
      .select("url, secret, events")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true);

    if (!endpoints || endpoints.length === 0) return;

    const body = JSON.stringify({
      event,
      created_at: new Date().toISOString(),
      data,
    });

    await Promise.allSettled(
      endpoints
        .filter((e) => {
          const subs = Array.isArray(e.events) ? (e.events as string[]) : [];
          return subs.length === 0 || subs.includes(event);
        })
        .map((e) =>
          fetch(e.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-SpirChat-Event": event,
              "X-SpirChat-Signature": signWebhookPayload(e.secret, body),
            },
            body,
            // Don't let a hung endpoint stall us for long.
            signal: AbortSignal.timeout(5000),
          }).catch(() => {})
        )
    );
  } catch {
    // best-effort
  }
}
