// Meta comment → DM processor with the follow gate. Reuses the shared claim /
// dedup / rate-limit / logging helpers, but sends via the Instagram Graph API
// (and applies is_user_follow_business) instead of the Zernio flow engine.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import {
  matchCommentTrigger,
  getActiveCommentTriggers,
  claimComment,
  finalizeComment,
  isChannelDmRateLimited,
  type IncomingComment,
} from "@/lib/comment-processor";
import { renderMessageWithTracking } from "@/lib/tracking";
import {
  sendPrivateReply,
  sendCommentReply,
  getUserFollowStatus,
  MetaRateLimitError,
} from "@/lib/meta/client";

type Channel = Database["public"]["Tables"]["channels"]["Row"];

interface MetaCommentConfig {
  replyText?: string;
  /** DM body sent as the private reply; supports {username} and {link}. */
  dmMessage?: string;
  /** Require the commenter to follow before the DM (the follow gate). */
  requireFollow?: boolean;
  /** DM shown when the follow gate blocks (defaults to a follow prompt). */
  followMessage?: string;
}

const DEFAULT_FOLLOW_MESSAGE =
  "Thanks! Give us a follow and comment again and we'll send it right over. 💛";

export interface MetaCredential {
  igUserId: string;
  accessToken: string; // already decrypted
}

/** Process one Instagram comment delivered via the Meta webhook. */
export async function processMetaComment({
  supabase,
  channel,
  credential,
  comment,
}: {
  supabase: SupabaseClient<Database>;
  channel: Channel;
  credential: MetaCredential;
  comment: IncomingComment;
}): Promise<{ status: string }> {
  // Never DM yourself — Meta rejects it and it would loop.
  if (comment.author.id && comment.author.id === credential.igUserId) {
    return { status: "self" };
  }

  const claim = await claimComment({ supabase, channel, comment });
  if (claim === "duplicate") return { status: "already_processed" };

  const triggers = await getActiveCommentTriggers(supabase, {
    channelId: channel.id,
    workspaceId: channel.workspace_id,
  });
  const trigger = matchCommentTrigger(triggers, comment);
  if (!trigger) {
    await finalizeComment({ supabase, channel, comment, triggerId: null, status: "no_match" });
    return { status: "no_match" };
  }

  const config = trigger.config as unknown as MetaCommentConfig;
  const commenterName = comment.author.username || comment.author.name || null;

  try {
    // Upsert the contact + channel link so the DM shows up in the inbox too.
    const senderId = comment.author.id || `comment_${comment.id}`;
    await upsertCommentContact(supabase, channel, senderId, commenterName);

    // Public reply (best-effort).
    let replySent = false;
    if (config.replyText) {
      try {
        await sendCommentReply(credential.accessToken, comment.id, config.replyText);
        replySent = true;
      } catch (err) {
        console.error("Meta comment reply failed:", err);
      }
    }

    // No DM configured → we're done after the public reply.
    if (!config.dmMessage) {
      await finalizeComment({
        supabase, channel, comment, triggerId: trigger.id, replySent,
        status: replySent ? "reply_only" : "no_match",
      });
      return { status: replySent ? "reply_only" : "no_match" };
    }

    // Per-account hourly DM cap.
    if (await isChannelDmRateLimited(supabase, channel.id)) {
      await enqueueRetry(supabase, channel, comment, senderId, config, commenterName);
      await finalizeComment({
        supabase, channel, comment, triggerId: trigger.id, replySent,
        status: "skipped_rate_limit",
      });
      return { status: "skipped_rate_limit" };
    }

    // Follow gate: block the link until they follow. Fail open when Meta does
    // not report follow status, so a real follower is never trapped.
    if (config.requireFollow && comment.author.id) {
      const follows = await getUserFollowStatus(credential.accessToken, comment.author.id);
      if (follows === false) {
        try {
          await sendPrivateReply(
            credential.accessToken,
            credential.igUserId,
            comment.id,
            config.followMessage || DEFAULT_FOLLOW_MESSAGE
          );
        } catch (err) {
          console.error("Meta follow-gate DM failed:", err);
        }
        await finalizeComment({
          supabase, channel, comment, triggerId: trigger.id, replySent,
          status: "skipped_follow_gate",
        });
        return { status: "skipped_follow_gate" };
      }
    }

    // Send the DM (private reply to the comment).
    const message = renderMessageWithTracking({
      message: config.dmMessage,
      recipientName: commenterName,
    });
    await sendPrivateReply(credential.accessToken, credential.igUserId, comment.id, message);

    await finalizeComment({
      supabase, channel, comment, triggerId: trigger.id, dmSent: true, replySent,
      status: "sent",
    });
    return { status: "sent" };
  } catch (err) {
    // On a Meta rate-limit error, queue a retry; otherwise mark failed.
    const senderId = comment.author.id || `comment_${comment.id}`;
    if (err instanceof MetaRateLimitError) {
      await enqueueRetry(supabase, channel, comment, senderId, config, commenterName);
      await finalizeComment({
        supabase, channel, comment, triggerId: trigger.id, status: "skipped_rate_limit",
      });
      return { status: "skipped_rate_limit" };
    }
    const message = err instanceof Error ? err.message : String(err);
    await finalizeComment({
      supabase, channel, comment, triggerId: trigger.id, status: "failed", error: message,
    });
    return { status: "failed" };
  }
}

async function upsertCommentContact(
  supabase: SupabaseClient<Database>,
  channel: Channel,
  senderId: string,
  name: string | null
): Promise<void> {
  const { data: link } = await supabase
    .from("contact_channels")
    .select("contact_id")
    .eq("channel_id", channel.id)
    .eq("platform_sender_id", senderId)
    .maybeSingle();
  if (link) return;

  const { data: contact } = await supabase
    .from("contacts")
    .insert({
      workspace_id: channel.workspace_id,
      display_name: name ?? "Instagram user",
      last_interaction_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (!contact) return;

  await supabase.from("contact_channels").insert({
    contact_id: contact.id,
    channel_id: channel.id,
    platform_sender_id: senderId,
    platform_username: name,
  });
}

async function enqueueRetry(
  supabase: SupabaseClient<Database>,
  channel: Channel,
  comment: IncomingComment,
  recipientId: string,
  config: MetaCommentConfig,
  commenterName: string | null
): Promise<void> {
  if (!config.dmMessage) return;
  const message = renderMessageWithTracking({
    message: config.dmMessage,
    recipientName: commenterName,
  });
  await supabase.from("dm_jobs").insert({
    channel_id: channel.id,
    workspace_id: channel.workspace_id,
    comment_id: comment.id,
    recipient_id: recipientId,
    message,
    run_after: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
}
