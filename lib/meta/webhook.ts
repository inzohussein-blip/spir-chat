// Meta webhook verification: GET subscribe challenge + POST signature.

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Handle the GET verification handshake. Returns the challenge string to echo
 * back when the verify token matches, else null.
 */
export function verifyWebhookChallenge(params: URLSearchParams): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected && challenge) {
    return challenge;
  }
  return null;
}

/**
 * Verify the X-Hub-Signature-256 header against the raw body using the app
 * secret. Returns false when the header/secret is missing or doesn't match.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Payload shapes (comments + messages) ────────────────────────────────────

export interface MetaCommentChange {
  igUserId: string; // the account that received the comment (entry.id)
  commentId: string;
  postId: string;
  text: string;
  fromId?: string;
  fromUsername?: string;
}

/**
 * Extract comment changes from a Meta webhook body. Instagram delivers comment
 * events under entry[].changes[] with field "comments".
 */
export function extractComments(body: unknown): MetaCommentChange[] {
  const out: MetaCommentChange[] = [];
  const entries = (body as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const e = entry as { id?: string; changes?: unknown[] };
    const igUserId = e.id ?? "";
    for (const change of e.changes ?? []) {
      const c = change as { field?: string; value?: Record<string, unknown> };
      if (c.field !== "comments" || !c.value) continue;
      const v = c.value;
      const from = v.from as { id?: string; username?: string } | undefined;
      const media = v.media as { id?: string } | undefined;
      if (typeof v.id === "string" && typeof v.text === "string") {
        out.push({
          igUserId,
          commentId: v.id,
          postId: media?.id ?? "",
          text: v.text,
          fromId: from?.id,
          fromUsername: from?.username,
        });
      }
    }
  }
  return out;
}
