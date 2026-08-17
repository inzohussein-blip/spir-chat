// Instagram Graph API client — direct Meta integration alongside Zernio.
// Endpoints/flows adapted from OpenReply (MIT): github.com/diwenne/openreply.
//
// Used for comment→DM private replies, public comment replies, the follow gate
// (is_user_follow_business), 24h-window DMs, and long-lived token refresh.

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";
const IG_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;

export class MetaApiError extends Error {
  constructor(
    public code: number,
    public message: string,
    public traceId?: string
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}
export class MetaTokenExpiredError extends MetaApiError {}
export class MetaRateLimitError extends MetaApiError {}

interface GraphError {
  error?: { code?: number; message?: string; fbtrace_id?: string };
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  const err = (data as GraphError).error;
  if (!res.ok || err) {
    const code = err?.code ?? res.status;
    const message = err?.message ?? "Meta API error";
    const trace = err?.fbtrace_id;
    if (code === 190) throw new MetaTokenExpiredError(code, message, trace);
    if (code === 4 || code === 17 || code === 368)
      throw new MetaRateLimitError(code, message, trace);
    throw new MetaApiError(code, message, trace);
  }
  return data as T;
}

type SendResult = { recipient_id: string; message_id: string };

/** Private reply to a comment (the comment→DM). */
export async function sendPrivateReply(
  accessToken: string,
  igUserId: string,
  commentId: string,
  message: string
): Promise<SendResult> {
  const res = await fetch(`${IG_BASE}/${igUserId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text: message },
    }),
  });
  return handle(res);
}

export interface LinkButton {
  title: string;
  url: string;
}

function webUrlButtons(buttons: LinkButton[]) {
  return buttons
    .slice(0, 3)
    .map((b) => ({ type: "web_url", url: b.url, title: b.title.slice(0, 20) }));
}

/** Private reply to a comment as a button template (message + link buttons). */
export async function sendPrivateReplyWithButtons(
  accessToken: string,
  igUserId: string,
  commentId: string,
  text: string,
  buttons: LinkButton[]
): Promise<SendResult> {
  const res = await fetch(`${IG_BASE}/${igUserId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: text.slice(0, 640),
            buttons: webUrlButtons(buttons),
          },
        },
      },
    }),
  });
  return handle(res);
}

/** Direct message to a user id (inside the 24h messaging window). */
export async function sendDirectMessage(
  accessToken: string,
  igUserId: string,
  recipientId: string,
  message: string
): Promise<SendResult> {
  const res = await fetch(`${IG_BASE}/${igUserId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
    }),
  });
  return handle(res);
}

/** Public reply under a comment. */
export async function sendCommentReply(
  accessToken: string,
  commentId: string,
  message: string
): Promise<{ id: string }> {
  const res = await fetch(`${IG_BASE}/${commentId}/replies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ message }),
  });
  return handle(res);
}

/**
 * The follow gate: does `recipientId` follow the connected business account?
 * Returns null when Meta doesn't report it — callers fail open (send anyway) so
 * a real follower is never trapped.
 */
export async function getUserFollowStatus(
  accessToken: string,
  recipientId: string
): Promise<boolean | null> {
  try {
    const url = new URL(`${IG_BASE}/${recipientId}`);
    url.searchParams.set("fields", "is_user_follow_business");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.is_user_follow_business === "boolean"
      ? data.is_user_follow_business
      : null;
  } catch {
    return null;
  }
}

export interface InstagramUser {
  id: string;
  user_id?: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
}

/** The connected account's own profile. */
export async function getUserInfo(accessToken: string): Promise<InstagramUser> {
  const url = new URL(`${IG_BASE}/me`);
  url.searchParams.set(
    "fields",
    "id,user_id,username,name,profile_picture_url,followers_count"
  );
  url.searchParams.set("access_token", accessToken);
  return handle(await fetch(url.toString()));
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
}

/** Exchange a short-lived token for a long-lived one (~60 days). */
export async function getLongLivedToken(
  shortLivedToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL(`${IG_BASE}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", process.env.META_APP_SECRET ?? "");
  url.searchParams.set("access_token", shortLivedToken);
  const data = await handle<TokenResponse>(await fetch(url.toString()));
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 5184000 };
}

/** Refresh a long-lived token (extends another ~60 days). */
export async function refreshLongLivedToken(
  longLivedToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL(`${IG_BASE}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", longLivedToken);
  const data = await handle<TokenResponse>(await fetch(url.toString()));
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 5184000 };
}

/** Subscribe the account to comment + message webhooks. */
export async function subscribeToWebhooks(
  accessToken: string,
  igUserId: string
): Promise<{ success?: boolean }> {
  const res = await fetch(`${IG_BASE}/${igUserId}/subscribed_apps`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ subscribed_fields: ["comments", "messages"] }),
  });
  return handle(res);
}
