import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  WIDGET_CORS_HEADERS,
  isValidVisitorId,
  visitorSenderId,
} from "@/lib/widget";
import { randomUUID } from "crypto";

// Public endpoint embedded on third-party sites — never require auth here.
// Uses the service role and scopes strictly by channel + visitor.

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: WIDGET_CORS_HEADERS });
}

/**
 * POST /api/widget/[channelId]/session
 *
 * Starts or resumes a website-widget visitor session. Given an optional
 * visitorId (persisted in the visitor's localStorage), it ensures a contact +
 * conversation exist for that visitor on this website channel and returns the
 * ids the widget needs to send and poll messages.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const supabase = await createServiceClient();

  // The channel id is public (it lives in the embed snippet). It only unlocks
  // this one website inbox, so validate it points to an active website channel.
  const { data: channel } = await supabase
    .from("channels")
    .select("id, workspace_id, platform, is_active")
    .eq("id", channelId)
    .single();

  if (!channel || channel.platform !== "website" || !channel.is_active) {
    return NextResponse.json(
      { error: "Widget not found" },
      { status: 404, headers: WIDGET_CORS_HEADERS }
    );
  }

  const body = await request.json().catch(() => ({}));
  const visitorId = isValidVisitorId(body?.visitorId)
    ? (body.visitorId as string)
    : randomUUID();
  const senderId = visitorSenderId(visitorId);
  const displayName =
    typeof body?.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, 120)
      : "Website visitor";

  // Resume path: an existing contact_channel means we've seen this visitor.
  const { data: existingLink } = await supabase
    .from("contact_channels")
    .select("contact_id")
    .eq("channel_id", channel.id)
    .eq("platform_sender_id", senderId)
    .maybeSingle();

  let contactId = existingLink?.contact_id ?? null;

  if (!contactId) {
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .insert({ workspace_id: channel.workspace_id, display_name: displayName })
      .select("id")
      .single();
    if (contactError || !contact) {
      return NextResponse.json(
        { error: "Could not start session" },
        { status: 500, headers: WIDGET_CORS_HEADERS }
      );
    }
    contactId = contact.id;

    await supabase.from("contact_channels").insert({
      contact_id: contactId,
      channel_id: channel.id,
      platform_sender_id: senderId,
      platform_username: displayName,
    });
  }

  // One conversation per (channel, contact) — enforced by a unique constraint.
  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("channel_id", channel.id)
    .eq("contact_id", contactId)
    .maybeSingle();

  let conversationId = existingConv?.id ?? null;

  if (!conversationId) {
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .insert({
        workspace_id: channel.workspace_id,
        channel_id: channel.id,
        contact_id: contactId,
        platform: "website",
        status: "open",
      })
      .select("id")
      .single();
    if (convError || !conversation) {
      return NextResponse.json(
        { error: "Could not start session" },
        { status: 500, headers: WIDGET_CORS_HEADERS }
      );
    }
    conversationId = conversation.id;
  }

  return NextResponse.json(
    { visitorId, conversationId },
    { headers: WIDGET_CORS_HEADERS }
  );
}
