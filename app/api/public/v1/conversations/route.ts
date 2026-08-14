import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-keys";
import type { ConversationStatus } from "@/lib/types/database";

// GET /api/public/v1/conversations?status=&limit=  list conversations
export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const q = request.nextUrl.searchParams;
  const limit = Math.min(Number(q.get("limit")) || 50, 200);
  const status = q.get("status");

  let query = supabase
    .from("conversations")
    .select(
      "id, platform, status, unread_count, last_message_at, last_message_preview, created_at, contacts(display_name, email)"
    )
    .eq("workspace_id", auth.workspaceId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (status) query = query.eq("status", status as ConversationStatus);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}
