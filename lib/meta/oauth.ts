// Instagram Business Login OAuth + token encryption.
// Adapted from OpenReply (MIT): github.com/diwenne/openreply.

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";

const IG_OAUTH_URL = "https://api.instagram.com/oauth/authorize";
const IG_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const TAG_LEN = 16;
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

const SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
  "instagram_business_manage_insights",
].join(",");

function stateSecret(): string {
  return process.env.META_APP_SECRET ?? process.env.CRON_SECRET ?? "spirchat-meta-state";
}

/** Whether the Meta app credentials are configured. */
export function isMetaConfigured(): boolean {
  return !!process.env.META_APP_ID && !!process.env.META_APP_SECRET;
}

function sign(payload: string): string {
  return createHmac("sha256", stateSecret()).update(payload).digest("base64url");
}

/** Signed, time-boxed OAuth state carrying the workspace id. */
export function createOAuthState(workspaceId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ workspaceId, ts: Date.now() })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyOAuthState(
  state: string | null
): { workspaceId: string } | null {
  if (!state) return null;
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.workspaceId || Date.now() - parsed.ts > STATE_MAX_AGE_MS) return null;
    return { workspaceId: parsed.workspaceId };
  } catch {
    return null;
  }
}

export function getAuthorizationUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    redirect_uri: redirectUri,
    scope: SCOPES,
    response_type: "code",
    state,
  });
  return `${IG_OAUTH_URL}?${params.toString()}`;
}

/** Exchange the OAuth code for a short-lived token + the IG user id. */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; userId: string }> {
  const body = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(IG_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`Token exchange failed: ${e.error_message || res.status}`);
  }
  const data = await res.json();
  return { accessToken: data.access_token, userId: String(data.user_id) };
}

// ── Token encryption (AES-256-GCM) ──────────────────────────────────────────
// Key: META_TOKEN_KEY (64 hex chars = 32 bytes). Falls back to a hash of
// META_APP_SECRET so encryption still works if the dedicated key isn't set.

function encryptionKey(): Buffer {
  const hex = process.env.META_TOKEN_KEY;
  if (hex && /^[0-9a-f]{64}$/i.test(hex)) return Buffer.from(hex, "hex");
  return createHash("sha256")
    .update(process.env.META_APP_SECRET ?? "spirchat-meta-key")
    .digest();
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decryptToken(encryptedBase64: string): string {
  const combined = Buffer.from(encryptedBase64, "base64");
  const iv = combined.subarray(0, IV_LEN);
  const tag = combined.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = combined.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
