"use server";

import { getWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { encryptToken } from "@/lib/meta/oauth";
import { verifyPhoneNumber } from "@/lib/whatsapp-cloud";

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

  const check = await verifyPhoneNumber(token, phoneNumberId);
  if (!check.ok) return { error: `Could not verify: ${check.error}` };

  const service = await createServiceClient();
  const { error } = await service.from("whatsapp_credentials").upsert(
    {
      workspace_id: workspace.id,
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

  // Provision the whatsapp channel (idempotent) for inbound routing.
  const { data: existingChannel } = await service
    .from("channels")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("platform", "whatsapp")
    .eq("late_account_id", phoneNumberId)
    .maybeSingle();
  if (!existingChannel) {
    await service.from("channels").insert({
      workspace_id: workspace.id,
      platform: "whatsapp",
      late_account_id: phoneNumberId,
      display_name: check.verifiedName || "WhatsApp",
      is_active: true,
      widget_config: {},
    });
  }

  revalidatePath("/dashboard/settings");
  return {
    ok: true,
    displayNumber: check.displayNumber,
    verifiedName: check.verifiedName,
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
