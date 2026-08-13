import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { WIDGET_CORS_HEADERS } from "@/lib/widget";
import { authorizeWidgetConversation } from "@/lib/widget-server";
import {
  CHAT_BUCKET,
  buildAttachmentPath,
  validateUpload,
  type MessageAttachment,
} from "@/lib/attachments";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: WIDGET_CORS_HEADERS });
}

/**
 * POST /api/widget/[channelId]/upload  (multipart/form-data)
 * Fields: file, conversationId, visitorId.
 *
 * A visitor uploads a file for their conversation. We authorize the
 * conversation/visitor pair, store the file in the public bucket via the
 * service-role client, and return the attachment metadata. The widget then
 * posts a normal message carrying that metadata.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const supabase = await createServiceClient();

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const conversationId = form?.get("conversationId");
  const visitorId = form?.get("visitorId");

  const auth = await authorizeWidgetConversation(
    supabase,
    channelId,
    conversationId,
    visitorId
  );
  if (!auth) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: WIDGET_CORS_HEADERS }
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided" },
      { status: 400, headers: WIDGET_CORS_HEADERS }
    );
  }

  const invalid = validateUpload({ type: file.type, size: file.size });
  if (invalid) {
    return NextResponse.json(
      { error: invalid },
      { status: 400, headers: WIDGET_CORS_HEADERS }
    );
  }

  const path = buildAttachmentPath(conversationId as string, file.name);
  const { error: uploadError } = await supabase.storage
    .from(CHAT_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500, headers: WIDGET_CORS_HEADERS }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(CHAT_BUCKET).getPublicUrl(path);

  const attachment: MessageAttachment = {
    url: publicUrl,
    name: file.name,
    type: file.type,
    size: file.size,
  };

  return NextResponse.json(
    { attachment },
    { status: 201, headers: WIDGET_CORS_HEADERS }
  );
}
