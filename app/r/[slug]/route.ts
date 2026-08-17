import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hashClickIp, getRequestIp } from "@/lib/tracking";

export const dynamic = "force-dynamic";

/**
 * GET /r/[slug]  — public tracked-link redirect.
 * Records a click (hashed IP, UA, referrer) then 302s to the destination.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createServiceClient();

  const { data: link } = await supabase
    .from("tracked_links")
    .select("id, workspace_id, destination_url")
    .eq("slug", slug)
    .single();

  // Unknown slug → send them home rather than a dead end.
  if (!link) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Record the click after responding so the redirect stays fast.
  after(async () => {
    await supabase.from("link_clicks").insert({
      workspace_id: link.workspace_id,
      tracked_link_id: link.id,
      ip_hash: hashClickIp(getRequestIp(request)),
      user_agent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
      referrer: request.headers.get("referer")?.slice(0, 400) ?? null,
    });
  });

  return NextResponse.redirect(link.destination_url, 302);
}
