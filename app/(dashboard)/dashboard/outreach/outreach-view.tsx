"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Loader2,
  Upload,
  Mail,
  MessageCircle,
  Users,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { sendOutreach } from "@/lib/actions/outreach";
import { parseRecipients, COUNTRY_CODES, type OutreachChannel } from "@/lib/outreach";
import { parseCsv } from "@/lib/csv";
import { PageTitle } from "@/components/page-title";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  short_code: string;
  content: string;
}
interface Batch {
  id: string;
  channel: string;
  message: string;
  total: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

const CHANNELS: { value: OutreachChannel; label: string; icon: typeof Mail }[] = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "sms", label: "SMS", icon: MessageCircle },
  { value: "email", label: "Email", icon: Mail },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OutreachView({
  templates,
  batches,
  configured,
}: {
  templates: Template[];
  batches: Batch[];
  configured: Record<OutreachChannel, boolean>;
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<OutreachChannel>("whatsapp");
  const [countryCode, setCountryCode] = useState("964");
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [saveContacts, setSaveContacts] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    sent: number;
    failed: number;
    invalid: number;
    capped: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isEmail = channel === "email";
  const parsed = useMemo(
    () => parseRecipients(recipientsRaw, channel, countryCode),
    [recipientsRaw, channel, countryCode]
  );

  function loadTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (t) setMessage(t.content);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    // Pull the first non-empty cell from each row (skips an obvious header row).
    const values: string[] = [];
    rows.forEach((row, i) => {
      const cell = row.find((c) => c.trim());
      if (!cell) return;
      if (i === 0 && /name|phone|email|number|mobile/i.test(cell)) return; // header
      values.push(cell.trim());
    });
    setRecipientsRaw((prev) => (prev ? prev + "\n" : "") + values.join("\n"));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function send() {
    if (sending || parsed.valid.length === 0 || !message.trim()) return;
    setSending(true);
    setError(null);
    setResult(null);
    const res = await sendOutreach({
      channel,
      countryCode,
      recipientsRaw,
      message,
      subject,
      saveContacts,
    });
    setSending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    if ("ok" in res && res.ok) {
      setResult({ sent: res.sent, failed: res.failed, invalid: res.invalid, capped: res.capped });
      setRecipientsRaw("");
      router.refresh();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <PageTitle
          icon={Send}
          title="Direct campaigns"
          subtitle="Paste or upload a list of numbers or emails, pick a template, and send now."
        />
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Composer */}
          <div className="space-y-4">
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            {result && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                <span className="font-semibold">Sent {result.sent}</span>
                {result.failed > 0 && `, ${result.failed} failed`}
                {result.invalid > 0 && ` · ${result.invalid} skipped (invalid)`}
                {result.capped > 0 && ` · ${result.capped} over the per-send cap were not sent`}
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              {/* Channel */}
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((c) => {
                  const Icon = c.icon;
                  const ok = configured[c.value];
                  return (
                    <button
                      key={c.value}
                      onClick={() => setChannel(c.value)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                        channel === c.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {c.label}
                      {!ok && (
                        <span
                          title="Provider not configured"
                          className="ms-1 h-1.5 w-1.5 rounded-full bg-amber-500"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              {!configured[channel] && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  The {channel} provider isn&apos;t configured — add its API keys to send.
                </p>
              )}

              {/* Recipients */}
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    Recipients {isEmail ? "(emails)" : "(phone numbers)"}
                  </label>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Upload className="h-3 w-3" /> Upload CSV
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.tsv,text/csv"
                    onChange={handleFile}
                    className="hidden"
                  />
                </div>
                {!isEmail && (
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code + c.label} value={c.code}>
                        {c.flag} {c.label} (+{c.code})
                      </option>
                    ))}
                  </select>
                )}
                <textarea
                  value={recipientsRaw}
                  onChange={(e) => setRecipientsRaw(e.target.value)}
                  rows={5}
                  placeholder={
                    isEmail
                      ? "one email per line, or comma-separated"
                      : "one number per line — local (07…) or international (+964…)"
                  }
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <div className="mt-1 flex items-center gap-3 text-xs">
                  <span className="font-medium text-emerald-600">
                    {parsed.valid.length} valid
                  </span>
                  {parsed.invalid.length > 0 && (
                    <span className="text-amber-600">{parsed.invalid.length} invalid</span>
                  )}
                  {!isEmail && parsed.valid[0] && (
                    <span className="text-muted-foreground">e.g. {parsed.valid[0]}</span>
                  )}
                </div>
              </div>

              {/* Template + message */}
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Message</label>
                  {templates.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) loadTemplate(e.target.value);
                        e.target.value = "";
                      }}
                      value=""
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                    >
                      <option value="">Load a template…</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          /{t.short_code}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {isEmail && (
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject"
                    className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                )}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Your message… use {{phone}} or {{email}} to personalize."
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>

              <label className="mt-3 inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={saveContacts}
                  onChange={(e) => setSaveContacts(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  Save recipients as contacts
                </span>
              </label>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Sends immediately. Up to 200 per send.
                </p>
                <button
                  onClick={send}
                  disabled={
                    sending ||
                    parsed.valid.length === 0 ||
                    !message.trim() ||
                    !configured[channel]
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send to {parsed.valid.length}
                </button>
              </div>
            </div>
          </div>

          {/* History */}
          <div>
            <h2 className="mb-2 text-sm font-semibold">Recent sends</h2>
            {batches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No direct campaigns yet.
              </div>
            ) : (
              <div className="space-y-2">
                {batches.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-border bg-card p-3 shadow-card"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                        {b.channel}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(b.created_at)}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs text-foreground">{b.message}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> {b.sent_count}
                      </span>
                      {b.failed_count > 0 && (
                        <span className="text-red-600">{b.failed_count} failed</span>
                      )}
                      <span className="text-muted-foreground">of {b.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
