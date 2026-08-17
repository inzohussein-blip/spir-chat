import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { decryptToken, encryptToken } from "@/lib/meta/oauth";
import { refreshLongLivedToken, sendDirectMessage } from "@/lib/meta/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/meta — daily: refresh Meta tokens nearing expiry and drain the
// DM retry queue. Protected by CRON_SECRET (Vercel Cron sends it).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const now = Date.now();

  // 1) Refresh tokens expiring within 10 days.
  const soon = new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString();
  const { data: creds } = await supabase
    .from("meta_credentials")
    .select("channel_id, access_token, token_expires_at")
    .lte("token_expires_at", soon);

  let refreshed = 0;
  for (const cred of creds ?? []) {
    try {
      const token = decryptToken(cred.access_token);
      const { accessToken, expiresIn } = await refreshLongLivedToken(token);
      await supabase
        .from("meta_credentials")
        .update({
          access_token: encryptToken(accessToken),
          token_expires_at: new Date(now + expiresIn * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("channel_id", cred.channel_id);
      refreshed++;
    } catch (err) {
      console.error("Meta token refresh failed:", err);
    }
  }

  // 2) Drain due DM retry jobs (best-effort, capped per run).
  const { data: jobs } = await supabase
    .from("dm_jobs")
    .select("id, channel_id, recipient_id, message, attempts")
    .eq("status", "pending")
    .lte("run_after", new Date(now).toISOString())
    .order("run_after", { ascending: true })
    .limit(100);

  let sent = 0;
  let failed = 0;
  for (const job of jobs ?? []) {
    const { data: cred } = await supabase
      .from("meta_credentials")
      .select("ig_user_id, access_token")
      .eq("channel_id", job.channel_id)
      .maybeSingle();
    if (!cred) {
      await supabase.from("dm_jobs").update({ status: "failed", last_error: "no credentials" }).eq("id", job.id);
      failed++;
      continue;
    }
    try {
      const token = decryptToken(cred.access_token);
      await sendDirectMessage(token, cred.ig_user_id, job.recipient_id, job.message);
      await supabase.from("dm_jobs").update({ status: "done" }).eq("id", job.id);
      sent++;
    } catch (err) {
      const attempts = job.attempts + 1;
      const done = attempts >= 3;
      await supabase
        .from("dm_jobs")
        .update({
          status: done ? "failed" : "pending",
          attempts,
          last_error: err instanceof Error ? err.message : String(err),
          run_after: new Date(now + 30 * 60 * 1000).toISOString(),
        })
        .eq("id", job.id);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, refreshed, sent, failed });
}
