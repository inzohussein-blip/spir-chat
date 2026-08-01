import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { WIDGET_CORS_HEADERS, parseWidgetConfig } from "@/lib/widget";

// Public: the widget fetches its own display config (pre-chat form + greeting)
// before starting a session, so it can decide whether to show the form.

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: WIDGET_CORS_HEADERS });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const supabase = await createServiceClient();

  const { data: channel } = await supabase
    .from("channels")
    .select("platform, is_active, widget_config")
    .eq("id", channelId)
    .single();

  if (!channel || channel.platform !== "website" || !channel.is_active) {
    return NextResponse.json(
      { error: "Widget not found" },
      { status: 404, headers: WIDGET_CORS_HEADERS }
    );
  }

  return NextResponse.json(parseWidgetConfig(channel.widget_config), {
    headers: WIDGET_CORS_HEADERS,
  });
}
