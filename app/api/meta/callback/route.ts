import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";
import {
  verifyOAuthState,
  exchangeCodeForToken,
  encryptToken,
} from "@/lib/meta/oauth";
import {
  getLongLivedToken,
  getUserInfo,
  subscribeToWebhooks,
} from "@/lib/meta/client";

const CHANNELS = `${SITE_URL}/dashboard/channels`;

// GET /api/meta/callback — Instagram redirects here with ?code&state.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  if (q.get("error")) {
    return NextResponse.redirect(`${CHANNELS}?error=meta_denied`);
  }

  const state = verifyOAuthState(q.get("state"));
  const code = q.get("code");
  if (!state || !code) {
    return NextResponse.redirect(`${CHANNELS}?error=meta_state`);
  }

  try {
    const redirectUri = `${SITE_URL}/api/meta/callback`;
    const { accessToken: shortToken } = await exchangeCodeForToken(code, redirectUri);
    const { accessToken: longToken, expiresIn } = await getLongLivedToken(shortToken);
    const profile = await getUserInfo(longToken);
    const igUserId = profile.user_id || profile.id;

    const supabase = await createServiceClient();
    const lateAccountId = `meta:${igUserId}`;

    // One channels row per connected IG account; reuse it on reconnect.
    const { data: existing } = await supabase
      .from("channels")
      .select("id")
      .eq("workspace_id", state.workspaceId)
      .eq("late_account_id", lateAccountId)
      .maybeSingle();

    let channelId = existing?.id ?? null;
    if (!channelId) {
      const { data: channel, error } = await supabase
        .from("channels")
        .insert({
          workspace_id: state.workspaceId,
          platform: "instagram",
          late_account_id: lateAccountId,
          display_name: profile.username ?? "Instagram",
          username: profile.username ?? null,
          profile_picture: profile.profile_picture_url ?? null,
          is_active: true,
        })
        .select("id")
        .single();
      if (error || !channel) {
        return NextResponse.redirect(`${CHANNELS}?error=meta_channel`);
      }
      channelId = channel.id;
    } else {
      await supabase
        .from("channels")
        .update({
          display_name: profile.username ?? "Instagram",
          username: profile.username ?? null,
          profile_picture: profile.profile_picture_url ?? null,
          is_active: true,
        })
        .eq("id", channelId);
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    await supabase.from("meta_credentials").upsert(
      {
        channel_id: channelId,
        workspace_id: state.workspaceId,
        ig_user_id: igUserId,
        username: profile.username ?? null,
        access_token: encryptToken(longToken),
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "channel_id" }
    );

    // Subscribe to comment + message webhooks (best-effort).
    after(() => subscribeToWebhooks(longToken, igUserId).catch(() => {}));

    return NextResponse.redirect(`${CHANNELS}?connected=instagram`);
  } catch (err) {
    console.error("Meta callback failed:", err);
    return NextResponse.redirect(`${CHANNELS}?error=meta_failed`);
  }
}
