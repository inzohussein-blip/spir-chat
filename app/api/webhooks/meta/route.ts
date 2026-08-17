import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  verifyWebhookChallenge,
  verifyWebhookSignature,
  extractComments,
} from "@/lib/meta/webhook";
import { decryptToken } from "@/lib/meta/oauth";
import { processMetaComment } from "@/lib/meta/process-comment";

export const dynamic = "force-dynamic";

// GET — Meta's subscription verification handshake.
export async function GET(request: NextRequest) {
  const challenge = verifyWebhookChallenge(request.nextUrl.searchParams);
  if (challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// POST — comment/message events. Ack fast, process comments in the background.
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const comments = extractComments(body);
  if (comments.length === 0) return NextResponse.json({ ok: true });

  const supabase = await createServiceClient();

  after(async () => {
    for (const c of comments) {
      // Map the receiving IG account to its channel + credentials.
      const { data: cred } = await supabase
        .from("meta_credentials")
        .select("channel_id, ig_user_id, access_token")
        .eq("ig_user_id", c.igUserId)
        .maybeSingle();
      if (!cred) continue;

      const { data: channel } = await supabase
        .from("channels")
        .select("*")
        .eq("id", cred.channel_id)
        .eq("is_active", true)
        .single();
      if (!channel) continue;

      let accessToken: string;
      try {
        accessToken = decryptToken(cred.access_token);
      } catch {
        continue;
      }

      await processMetaComment({
        supabase,
        channel,
        credential: { igUserId: cred.ig_user_id, accessToken },
        comment: {
          id: c.commentId,
          postId: c.postId,
          text: c.text,
          author: { id: c.fromId, username: c.fromUsername },
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
