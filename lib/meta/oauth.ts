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
  const secret =
    process.env.META_APP_SECRET ??
    process.env.CRON_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("No secret configured to sign the OAuth state");
  return secret;
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
// Encrypts provider secrets stored in the DB (Meta/WhatsApp tokens, Resend,
// Twilio, Telegram). Key, in order of preference:
//   1. META_TOKEN_KEY (64 hex chars = 32 bytes) — recommended, set explicitly.
//   2. Derived from SUPABASE_SERVICE_ROLE_KEY — secret and always present, so
//      encryption works with no extra setup.
// Never a constant baked into the source: anyone reading the repo could then
// decrypt every stored secret (workspace members can read the ciphertext).
// Decryption tries every configured key (plus the legacy META_APP_SECRET
// derivation), so adding META_TOKEN_KEY later doesn't strand stored secrets.

/** Candidate keys, the first one being the one new values are encrypted with. */
export function tokenKeys(env: NodeJS.ProcessEnv = process.env): Buffer[] {
  const keys: Buffer[] = [];
  const hex = env.META_TOKEN_KEY;
  if (hex && /^[0-9a-f]{64}$/i.test(hex)) keys.push(Buffer.from(hex, "hex"));
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    keys.push(
      createHash("sha256")
        .update(`spirchat-token-key:${env.SUPABASE_SERVICE_ROLE_KEY}`)
        .digest()
    );
  }
  if (env.META_APP_SECRET) {
    keys.push(createHash("sha256").update(env.META_APP_SECRET).digest());
  }
  return keys;
}

export function encryptToken(plaintext: string, env: NodeJS.ProcessEnv = process.env): string {
  const [key] = tokenKeys(env);
  if (!key) {
    throw new Error("Token encryption key not configured: set META_TOKEN_KEY");
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decryptToken(encryptedBase64: string, env: NodeJS.ProcessEnv = process.env): string {
  const combined = Buffer.from(encryptedBase64, "base64");
  const iv = combined.subarray(0, IV_LEN);
  const tag = combined.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = combined.subarray(IV_LEN + TAG_LEN);
  let lastError: unknown = new Error("Token encryption key not configured");
  // GCM's auth tag rejects a wrong key, so the first key that verifies wins.
  for (const key of tokenKeys(env)) {
    try {
      const decipher = createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}
