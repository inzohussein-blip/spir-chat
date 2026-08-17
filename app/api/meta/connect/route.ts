import { NextResponse } from "next/server";
import { getWorkspace } from "@/lib/workspace";
import { SITE_URL } from "@/lib/site";
import {
  isMetaConfigured,
  createOAuthState,
  getAuthorizationUrl,
} from "@/lib/meta/oauth";

// GET /api/meta/connect — kick off Instagram Business Login for this workspace.
export async function GET() {
  const { workspace } = await getWorkspace();

  if (!isMetaConfigured()) {
    return NextResponse.redirect(
      `${SITE_URL}/dashboard/channels?error=meta_not_configured`
    );
  }

  const redirectUri = `${SITE_URL}/api/meta/callback`;
  const state = createOAuthState(workspace.id);
  return NextResponse.redirect(getAuthorizationUrl(redirectUri, state));
}
