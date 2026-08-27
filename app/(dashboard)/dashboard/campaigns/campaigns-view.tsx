"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Plus, Send, Trash2, Loader2, Mail, MessageCircle } from "lucide-react";
import { createCampaign, sendCampaign, deleteCampaign } from "@/lib/actions/campaigns";
import { PageTitle } from "@/components/page-title";
import { cn } from "@/lib/utils";

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
  created_at: string;
}

const CHANNELS = [
  { value: "email", label: "Email", icon: Mail },
  { value: "sms", label: "SMS", icon: MessageCircle },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  sent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

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
  const [creating, setCreating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim() || !body.trim() || creating) return;
    setCreating(true);
    setError(null);
    const res = await createCampaign({ name, channel, subject, body, segmentId: segmentId || null });
    setCreating(false);
    if (res.error) return setError(res.error);
    setName("");
    setSubject("");
    setBody("");
    router.refresh();
  }

  async function handleSend(id: string) {
    setSendingId(id);
    setError(null);
    setNotice(null);
    const res = await sendCampaign(id);
    setSendingId(null);
    if (res.error) setError(res.error);
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
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Sends to subscribed contacts with {channel === "email" ? "an email" : "a phone number"}.
              </p>
              <button
                onClick={handleCreate}
                disabled={creating || !name.trim() || !body.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Create draft
              </button>
            </div>
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
                      <p className="truncate text-sm font-semibold">{c.name}</p>
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
                        Send
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
