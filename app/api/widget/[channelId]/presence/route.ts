import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { WIDGET_CORS_HEADERS, isValidVisitorId } from "@/lib/widget";

// Public heartbeat: the widget pings this every ~20s so the agent inbox can show
// which website visitors are online and what page they're on.

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: WIDGET_CORS_HEADERS });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const supabase = await createServiceClient();
  const body = await request.json().catch(() => ({}));

  const conversationId = body?.conversationId;
  if (typeof conversationId !== "string" || !isValidVisitorId(body?.visitorId)) {
    return NextResponse.json(
      { ok: false },
      { status: 400, headers: WIDGET_CORS_HEADERS }
    );
  }

  // Only accept presence for a website conversation on this channel.
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, channel_id, platform")
    .eq("id", conversationId)
    .single();

  if (
    !conversation ||
    conversation.channel_id !== channelId ||
    conversation.platform !== "website"
  ) {
    return NextResponse.json(
      { ok: false },
      { status: 404, headers: WIDGET_CORS_HEADERS }
    );
  }

  const page =
    typeof body?.page === "string" ? body.page.slice(0, 500) : null;

  await supabase
    .from("conversations")
    .update({
      visitor_last_seen_at: new Date().toISOString(),
      visitor_current_page: page,
    })
    .eq("id", conversationId);

  return NextResponse.json({ ok: true }, { headers: WIDGET_CORS_HEADERS });
}
