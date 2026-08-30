"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Plus, Send, Trash2, Loader2, Mail, MessageCircle, CalendarClock, X } from "lucide-react";
import { createCampaign, sendCampaign, deleteCampaign, cancelSchedule } from "@/lib/actions/campaigns";
import { renderMergeVariables } from "@/lib/merge";
import { PageTitle } from "@/components/page-title";
import { cn } from "@/lib/utils";

// A stand-in contact so the composer can preview how merge variables render.
const SAMPLE_CONTACT = { display_name: "Ahmed Khaled", email: "ahmed@example.com", phone: "+201234567890" };

interface Campaign {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  status: string;
  sent_count: number;
  failed_count: number;
  sent_at: string | null;
  scheduled_at: string | null;
  created_at: string;
}

const CHANNELS = [
  { value: "email", label: "Email", icon: Mail },
  { value: "sms", label: "SMS", icon: MessageCircle },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  sending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  sent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

function formatSchedule(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CampaignsView({
  campaigns,
  segments,
}: {
  campaigns: Campaign[];
  segments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [abEnabled, setAbEnabled] = useState(false);
  const [bodyB, setBodyB] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim() || !body.trim() || creating) return;
    setCreating(true);
    setError(null);
    const res = await createCampaign({
      name,
      channel,
      subject,
      body,
      bodyB: abEnabled && bodyB.trim() ? bodyB : null,
      segmentId: segmentId || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      linkUrl: linkUrl.trim() || null,
    });
    setCreating(false);
    if (res.error) return setError(res.error);
    setName("");
    setSubject("");
    setBody("");
    setBodyB("");
    setAbEnabled(false);
    setScheduledAt("");
    setLinkUrl("");
    router.refresh();
  }

  async function handleSend(id: string) {
    setSendingId(id);
    setError(null);
    setNotice(null);
    const res = await sendCampaign(id);
    setSendingId(null);
    if ("error" in res) setError(res.error);
    else setNotice(`Sent to ${res.sent} contact(s)${res.failed ? `, ${res.failed} failed` : ""}.`);
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <PageTitle
          icon={Megaphone}
          title="Campaigns"
          subtitle="Broadcast to your contacts over email, SMS, or WhatsApp."
        />
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              {notice}
            </p>
          )}

          {/* Composer */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Campaign name"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={segmentId}
              onChange={(e) => setSegmentId(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">All subscribed contacts</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  Segment: {s.name}
                </option>
              ))}
            </select>
            {channel === "email" && (
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            )}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Message…"
              className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Personalize with{" "}
              <code className="rounded bg-muted px-1 py-0.5">{"{{first_name}}"}</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5">{"{{name}}"}</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5">{"{{email}}"}</code> — add a fallback like{" "}
              <code className="rounded bg-muted px-1 py-0.5">{"{{first_name|there}}"}</code>.
            </p>
            {body.includes("{{") && (
              <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Preview · {SAMPLE_CONTACT.display_name}
                </p>
                <p className="whitespace-pre-wrap text-sm">
                  {renderMergeVariables(body, SAMPLE_CONTACT).replace(/\s*\{link\}\s*/gi, " ").trim()}
                </p>
              </div>
            )}
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Tracked link URL (optional) — put {link} in the message"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {linkUrl.trim() && (
              <p className="mt-1 text-xs text-muted-foreground">
                {"{link}"} in the message becomes a tracked short link; clicks show on the campaign report.
              </p>
            )}

            <label className="mt-3 inline-flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={abEnabled}
                onChange={(e) => setAbEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              A/B test — send a second variant
            </label>
            {abEnabled && (
              <textarea
                value={bodyB}
                onChange={(e) => setBodyB(e.target.value)}
                rows={4}
                placeholder="Variant B message…"
                className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            )}
            {abEnabled && (
              <p className="mt-1 text-xs text-muted-foreground">
                Recipients are split ~50/50 between variant A and B. The campaign
                report breaks delivery down by variant.
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                Schedule
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
              {scheduledAt && (
                <button
                  onClick={() => setScheduledAt("")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
              <button
                onClick={handleCreate}
                disabled={creating || !name.trim() || !body.trim()}
                className="ms-auto inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : scheduledAt ? (
                  <CalendarClock className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {scheduledAt ? "Schedule" : "Create draft"}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Sends to subscribed contacts with {channel === "email" ? "an email" : "a phone number"}.
              {" "}Scheduled campaigns are delivered by the daily job (send time depends on cron frequency).
            </p>
          </div>

          {/* List */}
          <div className="space-y-2">
            {campaigns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Megaphone className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">No campaigns yet.</p>
              </div>
            ) : (
              campaigns.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/dashboard/campaigns/${c.id}`}
                        className="truncate text-sm font-semibold hover:underline"
                      >
                        {c.name}
                      </a>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                          STATUS_STYLE[c.status] ?? STATUS_STYLE.draft
                        )}
                      >
                        {c.status}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                        {c.channel}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {c.status === "sent"
                        ? `${c.sent_count} sent${c.failed_count ? `, ${c.failed_count} failed` : ""}`
                        : c.status === "scheduled" && c.scheduled_at
                        ? `Scheduled for ${formatSchedule(c.scheduled_at)}`
                        : c.body}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {c.status !== "sent" && c.status !== "sending" && (
                      <button
                        onClick={() => handleSend(c.id)}
                        disabled={sendingId === c.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {sendingId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        {c.status === "scheduled" ? "Send now" : "Send"}
                      </button>
                    )}
                    {c.status === "scheduled" && (
                      <button
                        onClick={async () => {
                          await cancelSchedule(c.id);
                          router.refresh();
                        }}
                        title="Cancel schedule"
                        aria-label="Cancel schedule"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        await deleteCampaign(c.id);
                        router.refresh();
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete campaign"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
