import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchOrdersForEmail,
  type IntegrationProvider,
} from "@/lib/integrations/orders";

// GET /api/v1/orders?contactId=  — recent store orders for a contact's email.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contactId = request.nextUrl.searchParams.get("contactId");
  if (!contactId) {
    return NextResponse.json({ error: "contactId required" }, { status: 400 });
  }

  // RLS scopes both reads to the agent's workspace(s).
  const { data: contact } = await supabase
    .from("contacts")
    .select("email, workspace_id")
    .eq("id", contactId)
    .single();
  if (!contact?.email) {
    return NextResponse.json({ orders: [], reason: "no-email" });
  }

  const { data: integrations } = await supabase
    .from("integrations")
    .select("provider, config")
    .eq("workspace_id", contact.workspace_id)
    .eq("is_active", true)
    .order("provider", { ascending: true });
  if (!integrations || integrations.length === 0) {
    return NextResponse.json({ orders: [], reason: "no-integration" });
  }

  // Merge orders across every connected store, newest first, capped.
  const results = await Promise.all(
    integrations.map((i) =>
      fetchOrdersForEmail(
        i.provider as IntegrationProvider,
        (i.config as Record<string, unknown>) ?? {},
        contact.email as string
      )
    )
  );
  const orders = results
    .flat()
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 10);

  return NextResponse.json({ orders });
}
