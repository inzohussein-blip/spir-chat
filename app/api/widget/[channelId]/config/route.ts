import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { WIDGET_CORS_HEADERS, parseWidgetConfig } from "@/lib/widget";
import { parseBusinessHours, isOpenAt } from "@/lib/business-hours";

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
    .select("platform, is_active, widget_config, workspaces(business_hours)")
    .eq("id", channelId)
    .single();

  if (!channel || channel.platform !== "website" || !channel.is_active) {
    return NextResponse.json(
      { error: "Widget not found" },
      { status: 404, headers: WIDGET_CORS_HEADERS }
    );
  }

  const config = parseWidgetConfig(channel.widget_config);

  // Fold business hours into the widget's away state: when the workspace is
  // closed now, present as away (with the offline message) even if the manual
  // away toggle is off.
  const bh = parseBusinessHours(
    (channel.workspaces as { business_hours?: unknown } | null)?.business_hours
  );
  if (bh.enabled && !isOpenAt(bh)) {
    config.away = true;
    if (!config.awayMessage && bh.replyOffline) {
      config.awayMessage = bh.replyOffline;
    }
  }

  return NextResponse.json(config, {
    headers: WIDGET_CORS_HEADERS,
  });
}
