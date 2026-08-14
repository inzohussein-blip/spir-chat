import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/workspace";

// POST /api/push/subscribe   — register this browser's push subscription
// DELETE /api/push/subscribe — remove it (body: { endpoint })
export async function POST(request: NextRequest) {
  const { workspace, user, supabase } = await getWorkspace();
  const body = await request.json().catch(() => ({}));
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;

  if (
    typeof endpoint !== "string" ||
    typeof p256dh !== "string" ||
    typeof auth !== "string"
  ) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  // Upsert by endpoint so re-subscribing the same device is idempotent.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      workspace_id: workspace.id,
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { supabase } = await getWorkspace();
  const body = await request.json().catch(() => ({}));
  const endpoint = body?.endpoint;
  if (typeof endpoint !== "string") {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ success: true });
}
