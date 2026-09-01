import { NextRequest, NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  WIDGET_CORS_HEADERS,
  mapDbMessageToWidget,
  sanitizeWidgetText,
} from "@/lib/widget";
import { authorizeWidgetConversation } from "@/lib/widget-server";
import { parseAttachments } from "@/lib/attachments";
import { parseBusinessHours, isOpenAt } from "@/lib/business-hours";
import { dispatchWebhook } from "@/lib/api-keys";
import { sendPushToWorkspace } from "@/lib/push";
import { applyLabelRules } from "@/lib/auto-label";
import { generateHelpCenterAnswer } from "@/lib/ai/answer";
import { applyAiClassification } from "@/lib/ai/classify";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: WIDGET_CORS_HEADERS });
}

/**
 * GET /api/widget/[channelId]/messages?conversationId=&visitorId=&since=
 * Polls for messages in the visitor's conversation (both directions).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const supabase = await createServiceClient();
  const q = request.nextUrl.searchParams;

  const auth = await authorizeWidgetConversation(
    supabase,
    channelId,
    q.get("conversationId"),
    q.get("visitorId")
  );
  if (!auth) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: WIDGET_CORS_HEADERS }
    );
  }

  let query = supabase
    .from("messages")
    .select("id, direction, text, attachments, rich_content, created_at")
    .eq("conversation_id", q.get("conversationId") as string)
    .order("created_at", { ascending: true })
    .limit(200);

  const since = q.get("since");
  if (since) query = query.gt("created_at", since);

  const { data: rows } = await query;
  return NextResponse.json(
    { messages: (rows ?? []).map(mapDbMessageToWidget) },
    { headers: WIDGET_CORS_HEADERS }
  );
}

/**
 * POST /api/widget/[channelId]/messages
 * The visitor sends a message (inbound). Stored in Supabase and surfaced in the
 * agent inbox via the conversation's realtime update.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const supabase = await createServiceClient();
  const body = await request.json().catch(() => ({}));

  const auth = await authorizeWidgetConversation(
    supabase,
    channelId,
    body?.conversationId,
    body?.visitorId
  );
  if (!auth) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: WIDGET_CORS_HEADERS }
    );
  }

  const text = sanitizeWidgetText(body?.text);
  const attachments = parseAttachments(body?.attachments);
  // A message needs either text or at least one attachment.
  if (!text && attachments.length === 0) {
    return NextResponse.json(
      { error: "Message text required" },
      { status: 400, headers: WIDGET_CORS_HEADERS }
    );
  }

  const conversationId = body.conversationId as string;

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      direction: "inbound",
      text,
      attachments: attachments.length > 0 ? attachments : null,
    })
    .select("id, direction, text, attachments, created_at")
    .single();

  if (error || !message) {
    return NextResponse.json(
      { error: "Could not send message" },
      { status: 500, headers: WIDGET_CORS_HEADERS }
    );
  }

  // Bump the conversation so the agent inbox (subscribed to conversation
  // updates) refreshes, and mark it unread + open.
  const preview = text || `📎 ${attachments[0]?.name ?? "Attachment"}`;
  await supabase.rpc("increment_unread", {
    conv_id: conversationId,
    preview: preview.slice(0, 100),
  });
  // A fresh visitor message re-arms the follow-up for the next idle period.
  await supabase
    .from("conversations")
    .update({ followup_sent_at: null })
    .eq("id", conversationId);
  await supabase
    .from("contacts")
    .update({ last_interaction_at: new Date().toISOString() })
    .eq("id", auth.contactId);

  // Offline auto-reply (business hours): on a visitor's first message, if the
  // workspace is currently closed, post the offline auto-reply once.
  await maybeSendOfflineAutoReply(supabase, channelId, conversationId);

  // Post-response work (webhook, push, AI classification). `after` keeps it
  // running past the response without being killed by the serverless freeze.
  after(async () => {
    const { data: ch } = await supabase
      .from("channels")
      .select("workspace_id")
      .eq("id", channelId)
      .single();
    if (ch?.workspace_id) {
      await applyLabelRules(supabase, ch.workspace_id, conversationId, message.text);
      await dispatchWebhook(ch.workspace_id, "message.created", {
        conversation_id: conversationId,
        direction: "inbound",
        text: message.text,
        created_at: message.created_at,
      });
      await sendPushToWorkspace(ch.workspace_id, {
        title: "New website message",
        body: (message.text || "📎 Attachment").slice(0, 120),
        url: "/dashboard/inbox",
        tag: `conv-${conversationId}`,
      });

      // AI intent classification on the visitor's first message only.
      if (message.text) {
        const { count: inboundCount } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conversationId)
          .eq("direction", "inbound");
        if ((inboundCount ?? 0) === 1) {
          await applyAiClassification(
            supabase,
            ch.workspace_id,
            conversationId,
            message.text
          );
        }
      }

      // AI auto-reply from the Help Center: only when enabled, the conversation
      // is unassigned and automation isn't paused, and the model is confident.
      if (message.text) {
        const { data: ws } = await supabase
          .from("workspaces")
          .select("ai_replies_enabled, ai_api_key")
          .eq("id", ch.workspace_id)
          .single();
        const { data: convState } = await supabase
          .from("conversations")
          .select("assigned_to, is_automation_paused")
          .eq("id", conversationId)
          .single();
        if (
          ws?.ai_replies_enabled &&
          convState &&
          !convState.assigned_to &&
          !convState.is_automation_paused
        ) {
          const res = await generateHelpCenterAnswer(
            supabase,
            ch.workspace_id,
            ws.ai_api_key ?? undefined,
            message.text
          );
          if (res?.confident) {
            await supabase.from("messages").insert({
              conversation_id: conversationId,
              direction: "outbound",
              text: res.answer,
            });
            await supabase
              .from("conversations")
              .update({
                last_message_at: new Date().toISOString(),
                last_message_preview: res.answer.slice(0, 100),
              })
              .eq("id", conversationId);
          }
        }
      }
    }
  });

  return NextResponse.json(
    { message: mapDbMessageToWidget(message) },
    { status: 201, headers: WIDGET_CORS_HEADERS }
  );
}

async function maybeSendOfflineAutoReply(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  channelId: string,
  conversationId: string
): Promise<void> {
  try {
    const { data: channel } = await supabase
      .from("channels")
      .select("workspaces(business_hours)")
      .eq("id", channelId)
      .single();
    const bh = parseBusinessHours(
      (channel?.workspaces as { business_hours?: unknown } | null)?.business_hours
    );
    if (!bh.enabled || !bh.replyOffline || isOpenAt(bh)) return;

    // Atomically claim the one-time auto-reply: only the request that flips
    // auto_reply_sent_at from NULL proceeds, so concurrent first messages can't
    // both send. `select` returns the affected rows — empty means someone else
    // already claimed (or already sent) it.
    const { data: claimed } = await supabase
      .from("conversations")
      .update({ auto_reply_sent_at: new Date().toISOString() })
      .eq("id", conversationId)
      .is("auto_reply_sent_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) return;

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      direction: "outbound",
      text: bh.replyOffline,
    });
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: bh.replyOffline.slice(0, 100),
      })
      .eq("id", conversationId);
  } catch {
    // Auto-reply is best-effort; never fail the visitor's send because of it.
  }
}
