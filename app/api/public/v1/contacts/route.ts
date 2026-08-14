import { NextRequest, NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey, dispatchWebhook } from "@/lib/api-keys";

// Public REST API — authenticated with a workspace API key (Bearer token).
// GET  /api/public/v1/contacts?limit=&search=   list contacts
// POST /api/public/v1/contacts                  create a contact

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const q = request.nextUrl.searchParams;
  const limit = Math.min(Number(q.get("limit")) || 50, 200);
  const search = q.get("search")?.trim();

  let query = supabase
    .from("contacts")
    .select("id, display_name, email, is_subscribed, last_interaction_at, created_at")
    .eq("workspace_id", auth.workspaceId)
    .order("last_interaction_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (search) {
    // Escape LIKE metacharacters so % and _ match literally.
    const escaped = search.replace(/[\\%_]/g, (c) => `\\${c}`);
    query = query.ilike("display_name", `%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const displayName =
    typeof body?.display_name === "string" ? body.display_name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : null;
  if (!displayName && !email) {
    return NextResponse.json(
      { error: "display_name or email required" },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      workspace_id: auth.workspaceId,
      display_name: displayName || null,
      email,
    })
    .select("id, display_name, email, is_subscribed, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Could not create contact" }, { status: 500 });
  }

  after(() => dispatchWebhook(auth.workspaceId, "contact.created", data));
  return NextResponse.json({ data }, { status: 201 });
}
