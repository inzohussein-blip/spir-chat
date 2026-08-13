import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  CHAT_BUCKET,
  buildAttachmentPath,
  validateUpload,
  type MessageAttachment,
} from "@/lib/attachments";

/**
 * POST /api/v1/upload  (multipart/form-data)
 * Fields: file, conversationId.
 *
 * An authenticated agent uploads a file for a conversation. RLS (via the
 * user-scoped client) confirms the agent can see the conversation; the file is
 * then stored via the service-role client and its metadata returned. The caller
 * includes that metadata when POSTing the reply to /api/v1/messages.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const conversationId = form?.get("conversationId");

  if (typeof conversationId !== "string") {
    return NextResponse.json(
      { error: "conversationId required" },
      { status: 400 }
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const invalid = validateUpload({ type: file.type, size: file.size });
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  // RLS scopes this to conversations in the agent's workspace(s).
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .single();
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const service = await createServiceClient();
  const path = buildAttachmentPath(conversationId, file.name);
  const { error: uploadError } = await service.storage
    .from(CHAT_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = service.storage.from(CHAT_BUCKET).getPublicUrl(path);

  const attachment: MessageAttachment = {
    url: publicUrl,
    name: file.name,
    type: file.type,
    size: file.size,
  };

  return NextResponse.json({ attachment }, { status: 201 });
}
