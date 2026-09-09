import { NextRequest, NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  workspaceForPhoneNumberId,
  verifyMetaSignature,
} from "@/lib/whatsapp-cloud";
import { autoAssignConversation } from "@/lib/routing";
import { applyLabelRules } from "@/lib/auto-label";
import { sendPushToWorkspace } from "@/lib/push";

// Official Meta WhatsApp Cloud API webhook. Inbound customer messages land in
// the unified inbox (stored locally, like the website widget). Public endpoint —
// authenticity is enforced by the verify token (GET) and the app-secret
// signature (POST).

/** Webhook verification handshake (Meta calls this when you subscribe). */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const mode = q.get("hub.mode");
  const token = q.get("hub.verify_token");
  const challenge = q.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

type WaMessage = {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  image?: unknown;
  document?: unknown;
  audio?: unknown;
  video?: unknown;
};

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  after(async () => {
    try {
      await processWebhook(body);
    } catch (e) {
      console.error("WhatsApp Cloud webhook error:", e);
    }
  });
  return NextResponse.json({ ok: true });
}

function previewFor(m: WaMessage): string {
  if (m.text?.body) return m.text.body;
  if (m.image) return "📷 Photo";
  if (m.document) return "📎 Document";
  if (m.audio) return "🎤 Voice message";
  if (m.video) return "🎬 Video";
  return "Message";
}

async function processWebhook(body: unknown) {
  const supabase = await createServiceClient();

  const entries = (body as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value;
      if (!value) continue;

      // Delivery/read receipts: update the matching outbound message's status.
      const statuses =
        (value.statuses as
          | { id?: string; status?: string }[]
          | undefined) ?? [];
      for (const s of statuses) {
        if (s.id && s.status) await applyStatus(supabase, s.id, s.status);
      }

      const messages = (value.messages as WaMessage[] | undefined) ?? [];
      if (messages.length === 0) continue;

      const phoneNumberId =
        (value.metadata as { phone_number_id?: string } | undefined)?.phone_number_id;
      if (!phoneNumberId) continue;
      // Route to the workspace that owns this number (its own connection or env).
      const workspaceId = await workspaceForPhoneNumberId(supabase, phoneNumberId);
      if (!workspaceId) continue;
      const contacts =
        (value.contacts as { wa_id?: string; profile?: { name?: string } }[] | undefined) ?? [];
      const profileName = contacts[0]?.profile?.name ?? null;

      const channelId = await findOrCreateChannel(supabase, workspaceId, phoneNumberId);
      if (!channelId) continue;

      for (const m of messages) {
        if (!m.from) continue;
        await ingestMessage(supabase, workspaceId, channelId, m, profileName);
      }
    }
  }
}

// Map WhatsApp status → our MessageStatus.
function mapStatus(s: string): "sent" | "delivered" | "read" | "failed" | null {
  if (s === "sent") return "sent";
  if (s === "delivered") return "delivered";
  if (s === "read") return "read";
  if (s === "failed") return "failed";
  return null;
}

const STATUS_RANK: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
};

async function applyStatus(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  wamid: string,
  status: string
) {
  const mapped = mapStatus(status);
  if (!mapped) return;
  const { data: msg } = await supabase
    .from("messages")
    .select("id, status")
    .eq("platform_message_id", wamid)
    .maybeSingle();
  if (!msg) return;
  // Receipts can arrive out of order — never downgrade a message's status.
  if ((STATUS_RANK[mapped] ?? 0) <= (STATUS_RANK[msg.status] ?? 0)) return;
  await supabase.from("messages").update({ status: mapped }).eq("id", msg.id);
}

async function findOrCreateChannel(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  workspaceId: string,
  phoneNumberId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("channels")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("platform", "whatsapp")
    .eq("late_account_id", phoneNumberId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("channels")
    .insert({
      workspace_id: workspaceId,
      platform: "whatsapp",
      late_account_id: phoneNumberId,
      display_name: "WhatsApp",
      is_active: true,
      widget_config: {},
    })
    .select("id")
    .single();
  return created?.id ?? null;
}

async function ingestMessage(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  workspaceId: string,
  channelId: string,
  m: WaMessage,
  profileName: string | null
) {
  const phone = "+" + (m.from as string).replace(/\D/g, "");

  // Contact by phone (create if new).
  let contactId: string | null = null;
  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("phone", phone)
    .maybeSingle();
  if (existingContact) {
    contactId = existingContact.id;
    await supabase
      .from("contacts")
      .update({ last_interaction_at: new Date().toISOString() })
      .eq("id", contactId);
  } else {
    const { data: created } = await supabase
      .from("contacts")
      .insert({
        workspace_id: workspaceId,
        phone,
        display_name: profileName || phone,
        last_interaction_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    contactId = created?.id ?? null;
  }
  if (!contactId) return;

  // Conversation (one per channel+contact).
  const { data: conversation } = await supabase
    .from("conversations")
    .upsert(
      {
        workspace_id: workspaceId,
        channel_id: channelId,
        contact_id: contactId,
        platform: "whatsapp",
        status: "open",
      },
      { onConflict: "channel_id,contact_id" }
    )
    .select("id, assigned_to")
    .single();
  if (!conversation) return;

  const preview = previewFor(m);
  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    direction: "inbound",
    text: m.text?.body ?? preview,
    platform_message_id: m.id ?? null,
  });
  await supabase.rpc("increment_unread", {
    conv_id: conversation.id,
    preview: preview.slice(0, 100),
  });

  if (!conversation.assigned_to) {
    await autoAssignConversation(supabase, workspaceId, conversation.id);
  }
  await applyLabelRules(supabase, workspaceId, conversation.id, m.text?.body ?? null);
  await sendPushToWorkspace(workspaceId, {
    title: "New WhatsApp message",
    body: preview.slice(0, 120),
    url: "/dashboard/inbox",
    tag: `conv-${conversation.id}`,
  });
}
