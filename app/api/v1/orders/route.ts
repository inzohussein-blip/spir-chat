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

  const { data: integration } = await supabase
    .from("integrations")
    .select("provider, config, is_active")
    .eq("workspace_id", contact.workspace_id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!integration) {
    return NextResponse.json({ orders: [], reason: "no-integration" });
  }

  const orders = await fetchOrdersForEmail(
    integration.provider as IntegrationProvider,
    (integration.config as Record<string, unknown>) ?? {},
    contact.email
  );
  return NextResponse.json({ orders, provider: integration.provider });
}
