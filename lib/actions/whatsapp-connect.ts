"use server";

import { getWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { encryptToken, decryptToken } from "@/lib/meta/oauth";
import {
  verifyPhoneNumber,
  listMessageTemplates,
  resolveWorkspaceMeta,
} from "@/lib/whatsapp-cloud";

/**
 * Connect a workspace's official WhatsApp (Meta Cloud API) number. The token +
 * phone number id are verified against Graph API — which reads the number's
 * display fields ("recognizes" it) — then stored (token encrypted). A whatsapp
 * channel is provisioned so inbound messages land in the inbox.
 */
export async function connectWhatsAppCloud(input: {
  token: string;
  phoneNumberId: string;
  wabaId?: string;
}) {
  const { workspace } = await getWorkspace();
  const token = input.token.trim();
  const phoneNumberId = input.phoneNumberId.trim();
  if (!token || !phoneNumberId) return { error: "Token and phone number ID are required" };
  return storeConnection(workspace.id, { token, phoneNumberId, wabaId: input.wabaId });
}

/**
 * Finish Meta Embedded Signup: exchange the returned code for a business token,
 * then store the connection. `phoneNumberId`/`wabaId` come from the signup
 * session (the WA_EMBEDDED_SIGNUP browser event).
 */
export async function completeEmbeddedSignup(input: {
  code: string;
  phoneNumberId: string;
  wabaId?: string;
}) {
  const { workspace } = await getWorkspace();
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return { error: "Meta app credentials not configured" };
  if (!input.code || !input.phoneNumberId) return { error: "Missing signup data" };

  // Exchange the code for a business access token.
  let token = "";
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}` +
        `&client_secret=${appSecret}&code=${encodeURIComponent(input.code)}`,
      { signal: AbortSignal.timeout(12000) }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      return { error: data?.error?.message || "Token exchange failed" };
    }
    token = data.access_token as string;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Token exchange failed" };
  }

  return storeConnection(workspace.id, {
    token,
    phoneNumberId: input.phoneNumberId,
    wabaId: input.wabaId,
  });
}

/** Verify + persist a WhatsApp connection and provision its inbox channel. */
async function storeConnection(
  workspaceId: string,
  input: { token: string; phoneNumberId: string; wabaId?: string }
) {
  const token = input.token.trim();
  const phoneNumberId = input.phoneNumberId.trim();

  const check = await verifyPhoneNumber(token, phoneNumberId);
  if (!check.ok) return { error: `Could not verify: ${check.error}` };

  const service = await createServiceClient();
  const { error } = await service.from("whatsapp_credentials").upsert(
    {
      workspace_id: workspaceId,
      phone_number_id: phoneNumberId,
      waba_id: input.wabaId?.trim() || null,
      display_number: check.displayNumber,
      verified_name: check.verifiedName,
      access_token: encryptToken(token),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id" }
  );
  if (error) return { error: error.message };

  const { data: existingChannel } = await service
    .from("channels")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("platform", "whatsapp")
    .eq("late_account_id", phoneNumberId)
    .maybeSingle();
  if (!existingChannel) {
    await service.from("channels").insert({
      workspace_id: workspaceId,
      platform: "whatsapp",
      late_account_id: phoneNumberId,
      display_name: check.verifiedName || "WhatsApp",
      is_active: true,
      widget_config: {},
    });
  }

  revalidatePath("/dashboard/settings");
  return { ok: true, displayNumber: check.displayNumber, verifiedName: check.verifiedName };
}

/** Pull approved message templates from the workspace's WABA into the DB. */
export async function syncWhatsAppTemplates() {
  const { workspace } = await getWorkspace();
  const service = await createServiceClient();
  const { data: creds } = await service
    .from("whatsapp_credentials")
    .select("access_token, waba_id")
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!creds?.access_token) return { error: "WhatsApp isn't connected" };
  if (!creds.waba_id) {
    return { error: "Add your WABA ID (reconnect and fill 'WhatsApp Business Account ID')." };
  }

  let token: string;
  try {
    token = decryptToken(creds.access_token);
  } catch {
    return { error: "Stored token is invalid — reconnect." };
  }

  const res = await listMessageTemplates(token, creds.waba_id);
  if (!res.ok) return { error: res.error };

  const rows = res.templates.map((t) => ({
    workspace_id: workspace.id,
    name: t.name,
    language: t.language,
    status: t.status,
    category: t.category,
    synced_at: new Date().toISOString(),
  }));
  if (rows.length > 0) {
    await service
      .from("whatsapp_templates")
      .upsert(rows, { onConflict: "workspace_id,name,language" });
  }
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/outreach");
  const approved = res.templates.filter((t) => t.status === "APPROVED").length;
  return { ok: true, total: res.templates.length, approved };
}

/**
 * Live health check: verify the workspace's stored WhatsApp token still works by
 * reading the phone number from Graph. Returns healthy + the number, or the
 * Meta error (e.g. an expired/revoked token), so the UI can flag a real outage.
 */
export async function checkWhatsAppHealth() {
  const { workspace, supabase } = await getWorkspace();
  const creds = await resolveWorkspaceMeta(supabase, workspace.id);
  if (!creds) return { ok: false as const, error: "WhatsApp isn't connected" };
  const res = await verifyPhoneNumber(creds.token, creds.phoneNumberId);
  if (!res.ok) return { ok: false as const, error: res.error };
  return {
    ok: true as const,
    displayNumber: res.displayNumber,
    verifiedName: res.verifiedName,
  };
}

/** Disconnect the workspace's WhatsApp Cloud number. */
export async function disconnectWhatsAppCloud() {
  const { workspace } = await getWorkspace();
  const service = await createServiceClient();
  await service.from("whatsapp_credentials").delete().eq("workspace_id", workspace.id);
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
