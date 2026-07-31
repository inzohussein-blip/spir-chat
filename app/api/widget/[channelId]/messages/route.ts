import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  WIDGET_CORS_HEADERS,
  isValidVisitorId,
  mapDbMessageToWidget,
  sanitizeWidgetText,
  visitorSenderId,
} from "@/lib/widget";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: WIDGET_CORS_HEADERS });
}

/**
 * Verify the (channelId, conversationId, visitorId) triple all belong together:
 * the conversation is on this website channel and the visitor owns its contact.
 * Returns the conversation's contact_id, or null when anything doesn't match.
 */
async function authorize(
  supabase: ServiceClient,
  channelId: string,
  conversationId: unknown,
  visitorId: unknown
): Promise<{ contactId: string } | null> {
  if (typeof conversationId !== "string" || !isValidVisitorId(visitorId)) {
    return null;
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, channel_id, contact_id, platform, channels(is_active)")
    .eq("id", conversationId)
    .single();

  const channel = conversation?.channels as { is_active: boolean } | null;
  if (
    !conversation ||
    conversation.channel_id !== channelId ||
    conversation.platform !== "website" ||
    !channel?.is_active
  ) {
    return null;
  }

  const { data: link } = await supabase
    .from("contact_channels")
    .select("contact_id")
    .eq("channel_id", channelId)
    .eq("platform_sender_id", visitorSenderId(visitorId))
    .maybeSingle();

  if (!link || link.contact_id !== conversation.contact_id) return null;
  return { contactId: conversation.contact_id };
}

/**
 * GET /api/widget/[channelId]/messages?conversationId=&visitorId=&since=
 * Polls for messages in the visitor's conversation (both directions).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const supabase = await createServiceClient();
  const q = request.nextUrl.searchParams;

  const auth = await authorize(
    supabase,
    channelId,
    q.get("conversationId"),
    q.get("visitorId")
  );
  if (!auth) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: WIDGET_CORS_HEADERS }
    );
  }

  let query = supabase
    .from("messages")
    .select("id, direction, text, created_at")
    .eq("conversation_id", q.get("conversationId") as string)
    .order("created_at", { ascending: true })
    .limit(200);

  const since = q.get("since");
  if (since) query = query.gt("created_at", since);

  const { data: rows } = await query;
  return NextResponse.json(
    { messages: (rows ?? []).map(mapDbMessageToWidget) },
    { headers: WIDGET_CORS_HEADERS }
  );
}

/**
 * POST /api/widget/[channelId]/messages
 * The visitor sends a message (inbound). Stored in Supabase and surfaced in the
 * agent inbox via the conversation's realtime update.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const supabase = await createServiceClient();
  const body = await request.json().catch(() => ({}));

  const auth = await authorize(
    supabase,
    channelId,
    body?.conversationId,
    body?.visitorId
  );
  if (!auth) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: WIDGET_CORS_HEADERS }
    );
  }

  const text = sanitizeWidgetText(body?.text);
  if (!text) {
    return NextResponse.json(
      { error: "Message text required" },
      { status: 400, headers: WIDGET_CORS_HEADERS }
    );
  }

  const conversationId = body.conversationId as string;

  const { data: message, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, direction: "inbound", text })
    .select("id, direction, text, created_at")
    .single();

  if (error || !message) {
    return NextResponse.json(
      { error: "Could not send message" },
      { status: 500, headers: WIDGET_CORS_HEADERS }
    );
  }

  // Bump the conversation so the agent inbox (subscribed to conversation
  // updates) refreshes, and mark it unread + open.
  await supabase.rpc("increment_unread", {
    conv_id: conversationId,
    preview: text.slice(0, 100),
  });
  await supabase
    .from("contacts")
    .update({ last_interaction_at: new Date().toISOString() })
    .eq("id", auth.contactId);

  return NextResponse.json(
    { message: mapDbMessageToWidget(message) },
    { status: 201, headers: WIDGET_CORS_HEADERS }
  );
}
