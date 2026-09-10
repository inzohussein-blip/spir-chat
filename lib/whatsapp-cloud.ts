import "server-only";
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { decryptToken } from "@/lib/meta/oauth";

// Official Meta WhatsApp Cloud API integration. Credentials are resolved
// per-workspace (whatsapp_credentials table) with a fallback to a single
// deployment-wide env number:
//   META_WHATSAPP_TOKEN, META_PHONE_NUMBER_ID, META_WORKSPACE_ID
//   META_WEBHOOK_VERIFY_TOKEN (webhook challenge; META_VERIFY_TOKEN as a
//   legacy fallback), META_APP_SECRET (signature verify)
const GRAPH = "https://graph.facebook.com/v21.0";

type Client = SupabaseClient<Database>;

export interface MetaCreds {
  token: string;
  phoneNumberId: string;
}

function envCreds(): MetaCreds | null {
  if (process.env.META_WHATSAPP_TOKEN && process.env.META_PHONE_NUMBER_ID) {
    return {
      token: process.env.META_WHATSAPP_TOKEN,
      phoneNumberId: process.env.META_PHONE_NUMBER_ID,
    };
  }
  return null;
}

/** True when the deployment-wide env number is configured. */
export function metaConfigured(): boolean {
  return !!envCreds();
}

export function metaWorkspaceId(): string | null {
  return process.env.META_WORKSPACE_ID || null;
}

/** Resolve the WhatsApp Cloud credentials for a workspace (DB first, env fallback). */
export async function resolveWorkspaceMeta(
  supabase: Client,
  workspaceId: string
): Promise<MetaCreds | null> {
  const { data } = await supabase
    .from("whatsapp_credentials")
    .select("phone_number_id, access_token")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (data?.access_token) {
    try {
      return { token: decryptToken(data.access_token), phoneNumberId: data.phone_number_id };
    } catch {
      // fall through to env
    }
  }
  const env = envCreds();
  if (env && (!metaWorkspaceId() || metaWorkspaceId() === workspaceId)) return env;
  return null;
}

/** Whether a workspace can send via WhatsApp Cloud (its own number or env). */
export async function workspaceHasMeta(supabase: Client, workspaceId: string): Promise<boolean> {
  return (await resolveWorkspaceMeta(supabase, workspaceId)) !== null;
}

/** Map an inbound webhook's phone_number_id to the workspace that owns it. */
export async function workspaceForPhoneNumberId(
  supabase: Client,
  phoneNumberId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("whatsapp_credentials")
    .select("workspace_id")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  if (data) return data.workspace_id;
  if (envCreds() && metaWorkspaceId()) return metaWorkspaceId();
  return null;
}

export interface CloudSendResult {
  ok: boolean;
  error?: string;
  id?: string;
}

async function post(
  payload: Record<string, unknown>,
  creds: MetaCreds | null
): Promise<CloudSendResult> {
  const c = creds ?? envCreds();
  if (!c) return { ok: false, error: "WhatsApp Cloud not configured" };
  try {
    const res = await fetch(`${GRAPH}/${c.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.token}`,
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
export function sendCloudText(
  to: string,
  body: string,
  creds?: MetaCreds | null
): Promise<CloudSendResult> {
  return post({ to, type: "text", text: { preview_url: false, body } }, creds ?? null);
}

export interface TemplateExtras {
  /** A text header's {{1}} value. */
  headerText?: string;
  /** A media header. */
  headerMediaType?: "image" | "document" | "video";
  headerMediaUrl?: string;
  /** Dynamic URL-button suffix for button index 0. */
  buttonUrlParam?: string;
}

/**
 * An approved message template — the compliant way to start a conversation.
 * `params` fill the body {{1}}, {{2}}…; `extras` add a header (text or media)
 * and/or a dynamic URL button parameter.
 */
export function sendCloudTemplate(
  to: string,
  name: string,
  languageCode: string,
  params: string[] = [],
  creds?: MetaCreds | null,
  extras?: TemplateExtras | null
): Promise<CloudSendResult> {
  const components: Record<string, unknown>[] = [];

  if (extras?.headerText) {
    components.push({
      type: "header",
      parameters: [{ type: "text", text: extras.headerText }],
    });
  } else if (extras?.headerMediaUrl && extras.headerMediaType) {
    const mt = extras.headerMediaType;
    components.push({
      type: "header",
      parameters: [{ type: mt, [mt]: { link: extras.headerMediaUrl } }],
    });
  }

  if (params.length > 0) {
    components.push({ type: "body", parameters: params.map((text) => ({ type: "text", text })) });
  }

  if (extras?.buttonUrlParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: extras.buttonUrlParam }],
    });
  }

  return post(
    { to, type: "template", template: { name, language: { code: languageCode }, components } },
    creds ?? null
  );
}

/**
 * Verify a token + phone_number_id against Graph and read the number's display
 * fields — the "recognize the API" step used when connecting a workspace.
 */
export async function verifyPhoneNumber(
  token: string,
  phoneNumberId: string
): Promise<
  | { ok: true; displayNumber: string | null; verifiedName: string | null }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(
      `${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data as { error?: { message?: string } })?.error?.message;
      return { ok: false, error: msg || `Meta ${res.status}` };
    }
    const d = data as { display_phone_number?: string; verified_name?: string };
    return {
      ok: true,
      displayNumber: d.display_phone_number ?? null,
      verifiedName: d.verified_name ?? null,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "verify failed" };
  }
}

export interface WaTemplate {
  name: string;
  language: string;
  status: string | null;
  category: string | null;
}

/** List message templates on a WABA (approved + others). */
export async function listMessageTemplates(
  token: string,
  wabaId: string
): Promise<{ ok: true; templates: WaTemplate[] } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `${GRAPH}/${wabaId}/message_templates?fields=name,status,language,category&limit=200`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data as { error?: { message?: string } })?.error?.message;
      return { ok: false, error: msg || `Meta ${res.status}` };
    }
    const rows = (data as { data?: Record<string, string>[] }).data ?? [];
    const templates: WaTemplate[] = rows.map((r) => ({
      name: r.name,
      language: r.language,
      status: r.status ?? null,
      category: r.category ?? null,
    }));
    return { ok: true, templates };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "list failed" };
  }
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
