import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { WIDGET_CORS_HEADERS, parseWidgetConfig } from "@/lib/widget";
import { authorizeWidgetConversation } from "@/lib/widget-server";
import { parseFormFields } from "@/lib/forms";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: WIDGET_CORS_HEADERS });
}

/**
 * GET /api/widget/[channelId]/form
 * Returns the active conversational form configured for this widget, if any.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const supabase = await createServiceClient();

  const { data: channel } = await supabase
    .from("channels")
    .select("platform, is_active, widget_config")
    .eq("id", channelId)
    .single();
  if (!channel || channel.platform !== "website" || !channel.is_active) {
    return NextResponse.json(
      { error: "Widget not found" },
      { status: 404, headers: WIDGET_CORS_HEADERS }
    );
  }

  const { formId } = parseWidgetConfig(channel.widget_config);
  if (!formId) {
    return NextResponse.json({ form: null }, { headers: WIDGET_CORS_HEADERS });
  }

  const { data: form } = await supabase
    .from("forms")
    .select("id, fields, success_message, is_active")
    .eq("id", formId)
    .single();
  if (!form || !form.is_active) {
    return NextResponse.json({ form: null }, { headers: WIDGET_CORS_HEADERS });
  }

  return NextResponse.json(
    {
      form: {
        id: form.id,
        fields: parseFormFields(form.fields),
        successMessage: form.success_message ?? null,
      },
    },
    { headers: WIDGET_CORS_HEADERS }
  );
}

/**
 * POST /api/widget/[channelId]/form
 * Body: { conversationId, visitorId, formId, answers: {key:value} }
 * Stores a form response, updates the contact name/email when present, and posts
 * a summary into the conversation so agents see it.
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

  const formId = typeof body?.formId === "string" ? body.formId : null;
  const answers =
    body?.answers && typeof body.answers === "object" ? body.answers : {};
  if (!formId) {
    return NextResponse.json(
      { error: "formId required" },
      { status: 400, headers: WIDGET_CORS_HEADERS }
    );
  }

  const { data: form } = await supabase
    .from("forms")
    .select("id, workspace_id, fields")
    .eq("id", formId)
    .single();
  if (!form) {
    return NextResponse.json(
      { error: "Form not found" },
      { status: 404, headers: WIDGET_CORS_HEADERS }
    );
  }

  const fields = parseFormFields(form.fields);
  // Keep only known keys, coerced to strings.
  const clean: Record<string, string> = {};
  for (const f of fields) {
    const v = answers[f.key];
    if (typeof v === "string" && v.trim()) clean[f.key] = v.trim().slice(0, 500);
  }

  await supabase.from("form_responses").insert({
    form_id: form.id,
    workspace_id: form.workspace_id,
    conversation_id: body.conversationId,
    contact_id: auth.contactId,
    answers: clean,
  });

  // Enrich the contact from common fields.
  const contactPatch: Record<string, string> = {};
  const nameField = fields.find((f) => f.key === "name");
  if (nameField && clean[nameField.key]) {
    contactPatch.display_name = clean[nameField.key];
  }
  const emailField = fields.find((f) => f.type === "email");
  if (emailField && clean[emailField.key]) {
    contactPatch.email = clean[emailField.key];
  }
  const phoneField = fields.find((f) => f.type === "phone" || f.key === "phone");
  if (phoneField && clean[phoneField.key]) {
    contactPatch.phone = clean[phoneField.key];
  }
  if (Object.keys(contactPatch).length > 0) {
    await supabase.from("contacts").update(contactPatch).eq("id", auth.contactId);
  }

  // Post a readable summary into the thread for the agent.
  const summary = fields
    .filter((f) => clean[f.key])
    .map((f) => `${f.label} ${clean[f.key]}`)
    .join("\n");
  if (summary) {
    await supabase.from("messages").insert({
      conversation_id: body.conversationId,
      direction: "inbound",
      text: `📋 Form submitted:\n${summary}`,
    });
    await supabase.rpc("increment_unread", {
      conv_id: body.conversationId,
      preview: "📋 Form submitted",
    });
  }

  return NextResponse.json(
    { success: true },
    { status: 201, headers: WIDGET_CORS_HEADERS }
  );
}
