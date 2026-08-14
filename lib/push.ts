// Server-side Web Push sender (feature 20). Uses VAPID keys from env.
//
// Env:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   (generate: npx web-push generate-vapid-keys)
//   VAPID_SUBJECT                         (e.g. mailto:you@example.com)
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY          (same public key, exposed to the client)

import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/server";

let configured = false;

/** Configure web-push from env once. Returns false when keys are missing. */
function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:notifications@spirchat.app",
    publicKey,
    privateKey
  );
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send a push notification to every subscription in a workspace. Best-effort:
 * missing VAPID config is a no-op; expired endpoints (404/410) are pruned.
 */
export async function sendPushToWorkspace(
  workspaceId: string,
  payload: PushPayload
): Promise<void> {
  if (!ensureConfigured()) return;
  try {
    const supabase = await createServiceClient();
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("workspace_id", workspaceId);
    if (!subs || subs.length === 0) return;

    const body = JSON.stringify(payload);
    const stale: string[] = [];

    await Promise.allSettled(
      subs.map((s) =>
        webpush
          .sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          )
          .catch((err: unknown) => {
            const code = (err as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) stale.push(s.id);
          })
      )
    );

    if (stale.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", stale);
    }
  } catch {
    // best-effort
  }
}
