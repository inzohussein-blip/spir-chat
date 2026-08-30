import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspace } from "@/lib/workspace";
import {
  ArrowLeft,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";
import { CustomFieldsEditor } from "@/components/contacts/custom-fields-editor";
import { ContactTimeline, type TimelineEvent } from "@/components/contacts/contact-timeline";
import { MergeContact } from "@/components/contacts/merge-contact";
import { avatarGradient } from "@/lib/avatar";
import { cn } from "@/lib/utils";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = await params;
  const { workspace, supabase } = await getWorkspace();

  const [contactRes, channelsRes, conversationsRes, customFieldsRes, fieldDefsRes] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("*, contact_tags(tag_id, tags(*))")
        .eq("id", contactId)
        .eq("workspace_id", workspace.id)
        .single(),
      supabase
        .from("contact_channels")
        .select("*, channels(platform, username, display_name)")
        .eq("contact_id", contactId),
      supabase
        .from("conversations")
        .select("id, platform, status, last_message_at, last_message_preview")
        .eq("contact_id", contactId)
        .eq("workspace_id", workspace.id)
        .order("last_message_at", { ascending: false }),
      supabase
        .from("contact_custom_fields")
        .select("field_id, value")
        .eq("contact_id", contactId),
      supabase
        .from("custom_field_definitions")
        .select("id, name, type")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: true }),
    ]);

  if (!contactRes.data) notFound();

  const contact = contactRes.data;
  const channels = channelsRes.data ?? [];
  const conversations = conversationsRes.data ?? [];
  const fieldDefs = fieldDefsRes.data ?? [];
  const fieldValues: Record<string, string> = {};
  for (const cf of customFieldsRes.data ?? []) {
    fieldValues[cf.field_id] = cf.value;
  }

  // Activity timeline sources.
  const [campaignRcptsRes, enrollmentsRes, surveysRes] = await Promise.all([
    supabase
      .from("campaign_recipients")
      .select("status, created_at, campaigns(name)")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("sequence_enrollments")
      .select("enrolled_at, status, sequences(name)")
      .eq("contact_id", contactId)
      .order("enrolled_at", { ascending: false })
      .limit(50),
    supabase
      .from("csat_surveys")
      .select("status, rating, created_at, responded_at")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const events: TimelineEvent[] = [];
  events.push({ at: contact.created_at, kind: "created", title: "Contact created" });
  for (const c of conversations) {
    events.push({
      at: c.last_message_at ?? contact.created_at,
      kind: "conversation",
      title: `Conversation on ${c.platform}`,
      detail: c.last_message_preview ?? undefined,
    });
  }
  for (const r of campaignRcptsRes.data ?? []) {
    const name = (r.campaigns as unknown as { name?: string } | null)?.name ?? "a campaign";
    events.push({
      at: r.created_at,
      kind: "campaign",
      title: `Campaign: ${name}`,
      detail: r.status === "sent" ? "Delivered" : "Failed",
    });
  }
  for (const en of enrollmentsRes.data ?? []) {
    const name = (en.sequences as unknown as { name?: string } | null)?.name ?? "a sequence";
    events.push({
      at: en.enrolled_at ?? contact.created_at,
      kind: "sequence",
      title: `Enrolled in ${name}`,
      detail: en.status,
    });
  }
  for (const s of surveysRes.data ?? []) {
    events.push({
      at: s.responded_at ?? s.created_at,
      kind: "csat",
      title: s.status === "responded" ? `Rated ${s.rating}/5` : "Survey sent",
    });
  }
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // Other contacts, for the merge picker.
  const { data: otherContactsRaw } = await supabase
    .from("contacts")
    .select("id, display_name, email")
    .eq("workspace_id", workspace.id)
    .neq("id", contactId)
    .order("last_interaction_at", { ascending: false, nullsFirst: false })
    .limit(200);
  const otherContacts = (otherContactsRaw ?? []).map((c) => ({
    id: c.id,
    label: c.display_name || c.email || "Unknown contact",
  }));
  const tags = contact.contact_tags
    .map((ct: { tags: unknown }) => ct.tags)
    .filter(Boolean) as { id: string; name: string; color: string | null }[];

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <Link
          href="/dashboard/contacts"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to contacts
        </Link>
        <div className="flex items-center gap-4">
          {contact.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={contact.avatar_url}
              alt={contact.display_name || "Contact"}
              className="h-12 w-12 flex-shrink-0 rounded-full object-cover shadow-sm"
            />
          ) : (
            <div
              className={cn(
                "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-lg font-semibold text-white shadow-sm",
                avatarGradient(contact.display_name ?? "Unknown")
              )}
            >
              {contact.display_name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">
              {contact.display_name ?? "Unknown"}
            </h1>
            <div className="mt-0.5 flex items-center gap-3 text-sm text-muted-foreground">
              {contact.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {contact.email}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Last active {formatDate(contact.last_interaction_at)}
              </span>
              {contact.is_subscribed ? (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Subscribed
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Unsubscribed
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex rounded-full border border-border px-2.5 py-0.5 text-xs font-medium"
                style={
                  tag.color
                    ? {
                        backgroundColor: `${tag.color}20`,
                        borderColor: `${tag.color}40`,
                        color: tag.color,
                      }
                    : undefined
                }
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Connected channels */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
              Connected Channels
            </h2>
            {channels.length === 0 ? (
              <p className="text-sm text-muted-foreground/60">No channels</p>
            ) : (
              <div className="space-y-2">
                {channels.map((cc) => {
                  const ch = cc.channels as {
                    platform?: string;
                    display_name?: string;
                    username?: string;
                  } | null;
                  return (
                    <div
                      key={cc.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-card"
                    >
                      <PlatformIcon
                        platform={ch?.platform ?? ""}
                        className="h-4 w-4"
                        size={16}
                      />
                      <div>
                        <p className="text-sm font-medium">
                          {ch?.display_name ?? ch?.username ?? "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ch?.platform} ·{" "}
                          {cc.platform_username
                            ? `@${cc.platform_username}`
                            : cc.platform_sender_id}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Conversations */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
              Conversations
            </h2>
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground/60">
                No conversations
              </p>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <Link
                    key={conv.id}
                    href="/dashboard/inbox"
                    className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 shadow-card transition-colors hover:bg-accent/50"
                  >
                    <PlatformIcon
                      platform={conv.platform}
                      className="mt-0.5 h-4 w-4"
                      size={16}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium capitalize text-muted-foreground">
                          {conv.platform} · {conv.status}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60">
                          {formatDate(conv.last_message_at)}
                        </p>
                      </div>
                      <p className="mt-0.5 truncate text-sm">
                        {conv.last_message_preview || "No messages"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Custom fields */}
          <CustomFieldsEditor
            contactId={contactId}
            definitions={fieldDefs}
            values={fieldValues}
          />

          {/* Activity timeline */}
          <ContactTimeline events={events} />

          {/* Merge duplicate */}
          <MergeContact primaryId={contactId} others={otherContacts} />
        </div>
      </div>
    </div>
  );
}
