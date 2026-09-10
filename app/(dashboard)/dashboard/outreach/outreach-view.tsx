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
  CalendarClock,
  X,
  Clock,
  RotateCw,
  ChevronLeft,
} from "lucide-react";
import {
  sendOutreach,
  cancelOutreachBatch,
  getOutreachBatchDetail,
  retryFailedRecipients,
} from "@/lib/actions/outreach";
import { createOutreachTemplate, deleteOutreachTemplate } from "@/lib/actions/outreach-templates";
import { parseRecipients, COUNTRY_CODES, type OutreachChannel } from "@/lib/outreach";
import { parseCsv } from "@/lib/csv";
import { PageTitle } from "@/components/page-title";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  name: string;
  subject: string | null;
  body: string;
}
interface Batch {
  id: string;
  channel: string;
  message: string;
  total: number;
  sent_count: number;
  failed_count: number;
  status: string;
  scheduled_at: string | null;
  created_at: string;
}
interface RecipientRow {
  id: string;
  recipient: string;
  status: string;
  error: string | null;
}
interface BatchDetailData {
  batch: {
    id: string;
    channel: string;
    message: string;
    total: number;
    sent_count: number;
    failed_count: number;
    status: string;
  };
  recipients: RecipientRow[];
  counts: { pending: number; sent: number; failed: number };
}

const CHANNELS: { value: OutreachChannel; label: string; icon: typeof Mail }[] = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "telegram", label: "Telegram", icon: Send },
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
  metaWhatsApp,
  waTemplates,
}: {
  templates: Template[];
  batches: Batch[];
  configured: Record<OutreachChannel, boolean>;
  metaWhatsApp: boolean;
  waTemplates: { name: string; language: string }[];
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<OutreachChannel>("whatsapp");
  const [countryCode, setCountryCode] = useState("964");
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [saveContacts, setSaveContacts] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  // WhatsApp Cloud approved-template mode.
  const [useTemplate, setUseTemplate] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplLang, setTplLang] = useState("ar");
  const [tplParams, setTplParams] = useState("");
  const [tplHeaderText, setTplHeaderText] = useState("");
  const [tplHeaderMediaType, setTplHeaderMediaType] = useState<"" | "image" | "document" | "video">("");
  const [tplHeaderMediaUrl, setTplHeaderMediaUrl] = useState("");
  const [tplButtonParam, setTplButtonParam] = useState("");
  const [showComponents, setShowComponents] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    scheduled?: boolean;
    count?: number;
    sent?: number;
    failed?: number;
    invalid?: number;
    queued?: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Campaign detail drawer (per-recipient status + retry failed).
  const [detail, setDetail] = useState<{
    batchId: string;
    loading: boolean;
    data?: BatchDetailData;
  } | null>(null);
  const [retrying, setRetrying] = useState(false);

  async function openDetail(batchId: string) {
    setDetail({ batchId, loading: true });
    const res = await getOutreachBatchDetail(batchId);
    if ("ok" in res && res.ok) {
      setDetail({
        batchId,
        loading: false,
        data: { batch: res.batch, recipients: res.recipients, counts: res.counts },
      });
    } else {
      setDetail(null);
    }
  }

  async function retry() {
    if (!detail?.data || retrying) return;
    setRetrying(true);
    await retryFailedRecipients(detail.batchId);
    setRetrying(false);
    await openDetail(detail.batchId);
    router.refresh();
  }

  const isEmail = channel === "email";
  const canTemplate = channel === "whatsapp" && metaWhatsApp;
  const templateMode = canTemplate && useTemplate;
  const parsed = useMemo(
    () => parseRecipients(recipientsRaw, channel, countryCode),
    [recipientsRaw, channel, countryCode]
  );

  const [savingTpl, setSavingTpl] = useState(false);

  function loadTemplate(t: Template) {
    setMessage(t.body);
    if (t.subject) setSubject(t.subject);
  }

  async function saveTemplate() {
    if (savingTpl || !message.trim()) return;
    const name = window.prompt("Template name");
    if (!name?.trim()) return;
    setSavingTpl(true);
    await createOutreachTemplate({ name, subject: isEmail ? subject : undefined, body: message });
    setSavingTpl(false);
    router.refresh();
  }

  async function removeTemplate(id: string) {
    await deleteOutreachTemplate(id);
    router.refresh();
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

  const canSend =
    parsed.valid.length > 0 &&
    (templateMode ? !!tplName.trim() && metaWhatsApp : !!message.trim() && configured[channel]);

  async function send() {
    if (sending || !canSend) return;
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
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      templateName: templateMode ? tplName : undefined,
      templateLang: templateMode ? tplLang : undefined,
      templateParams: templateMode
        ? tplParams.split(",").map((p) => p.trim()).filter(Boolean)
        : undefined,
      templateComponents: templateMode
        ? {
            headerText: tplHeaderText.trim() || undefined,
            headerMediaType: tplHeaderMediaType || undefined,
            headerMediaUrl: tplHeaderMediaUrl.trim() || undefined,
            buttonUrlParam: tplButtonParam.trim() || undefined,
          }
        : undefined,
    });
    setSending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    if ("ok" in res && res.ok) {
      setResult(
        "scheduled" in res && res.scheduled
          ? { scheduled: true, count: res.count, invalid: res.invalid }
          : { sent: res.sent, failed: res.failed, invalid: res.invalid, queued: res.queued }
      );
      setRecipientsRaw("");
      setScheduledAt("");
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
                {result.scheduled ? (
                  <span className="font-semibold">
                    Scheduled {result.count} recipient{result.count === 1 ? "" : "s"}.
                  </span>
                ) : (
                  <>
                    <span className="font-semibold">Sent {result.sent}</span>
                    {(result.failed ?? 0) > 0 && `, ${result.failed} failed`}
                    {(result.queued ?? 0) > 0 &&
                      ` · ${result.queued} queued for the next run`}
                  </>
                )}
                {(result.invalid ?? 0) > 0 && ` · ${result.invalid} skipped (invalid)`}
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              {/* Channel */}
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((c) => {
                  const Icon = c.icon;
                  const ok =
                    configured[c.value] || (c.value === "whatsapp" && metaWhatsApp);
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
              {!configured[channel] && !(channel === "whatsapp" && metaWhatsApp) && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  The {channel} provider isn&apos;t configured — add its API keys to send.
                </p>
              )}

              {/* WhatsApp Cloud approved-template mode */}
              {canTemplate && (
                <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                  <label className="flex items-start gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={useTemplate}
                      onChange={(e) => setUseTemplate(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border"
                    />
                    <span>
                      Send an approved template (Cloud API)
                      <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                        Required to start conversations with cold numbers. Approve the
                        template in WhatsApp Manager first.
                      </span>
                    </span>
                  </label>
                  {useTemplate && (
                    <div className="mt-3 space-y-2">
                      {waTemplates.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            const t = waTemplates.find((x) => x.name === e.target.value);
                            if (t) {
                              setTplName(t.name);
                              setTplLang(t.language);
                            }
                          }}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                        >
                          <option value="">Pick an approved template…</option>
                          {waTemplates.map((t) => (
                            <option key={t.name + t.language} value={t.name}>
                              {t.name} ({t.language})
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="flex gap-2">
                        <input
                          value={tplName}
                          onChange={(e) => setTplName(e.target.value)}
                          placeholder="Template name (e.g. welcome_message)"
                          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                        <input
                          value={tplLang}
                          onChange={(e) => setTplLang(e.target.value)}
                          placeholder="ar"
                          className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <input
                        value={tplParams}
                        onChange={(e) => setTplParams(e.target.value)}
                        placeholder="Body params for {{1}}, {{2}}… comma-separated ({{phone}} allowed)"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                      <button
                        onClick={() => setShowComponents((v) => !v)}
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        {showComponents ? "− Hide" : "+ Add"} header / button
                      </button>
                      {showComponents && (
                        <div className="space-y-2 rounded-lg border border-dashed border-border p-2">
                          <input
                            value={tplHeaderText}
                            onChange={(e) => setTplHeaderText(e.target.value)}
                            placeholder="Header text variable (if the template has a text header)"
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                          />
                          <div className="flex gap-2">
                            <select
                              value={tplHeaderMediaType}
                              onChange={(e) =>
                                setTplHeaderMediaType(e.target.value as typeof tplHeaderMediaType)
                              }
                              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                            >
                              <option value="">No media header</option>
                              <option value="image">Image</option>
                              <option value="document">Document</option>
                              <option value="video">Video</option>
                            </select>
                            <input
                              value={tplHeaderMediaUrl}
                              onChange={(e) => setTplHeaderMediaUrl(e.target.value)}
                              placeholder="Header media URL"
                              disabled={!tplHeaderMediaType}
                              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary disabled:opacity-50"
                            />
                          </div>
                          <input
                            value={tplButtonParam}
                            onChange={(e) => setTplButtonParam(e.target.value)}
                            placeholder="Dynamic URL button suffix (if the template has one)"
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Use only the components your approved template actually defines.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Recipients */}
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    Recipients{" "}
                    {isEmail
                      ? "(emails)"
                      : channel === "telegram"
                      ? "(@usernames or phone numbers)"
                      : "(phone numbers)"}
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
                      : channel === "telegram"
                      ? "@username or number — one per line"
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

              {/* Template + message (hidden in Cloud-template mode) */}
              <div className="mt-4" hidden={templateMode}>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Message</label>
                  <button
                    onClick={saveTemplate}
                    disabled={savingTpl || !message.trim()}
                    className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    Save as template
                  </button>
                </div>
                {templates.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {templates.map((t) => (
                      <span
                        key={t.id}
                        className="group inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs hover:border-primary/40"
                      >
                        <button onClick={() => loadTemplate(t)} className="font-medium">
                          {t.name}
                        </button>
                        <button
                          onClick={() => removeTemplate(t.id)}
                          aria-label={`Delete ${t.name}`}
                          className="text-muted-foreground/50 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
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

              {/* Schedule */}
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
                    className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {scheduledAt
                    ? "Delivered by the daily job at the scheduled time."
                    : "Sends immediately (up to 200 now; the rest by the daily job)."}
                </p>
                <button
                  onClick={send}
                  disabled={sending || !canSend}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : scheduledAt ? (
                    <CalendarClock className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {scheduledAt ? "Schedule" : "Send"} to {parsed.valid.length}
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
                {batches.map((b) => {
                  const done = b.sent_count + b.failed_count;
                  const pct = b.total > 0 ? Math.round((done / b.total) * 100) : 0;
                  return (
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
                      {b.status === "scheduled" ? (
                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-blue-600">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Scheduled{b.scheduled_at ? ` for ${formatDate(b.scheduled_at)}` : ""} ·{" "}
                            {b.total} recipients
                          </span>
                          <button
                            onClick={async () => {
                              if (!confirm("Cancel this scheduled campaign?")) return;
                              await cancelOutreachBatch(b.id);
                              router.refresh();
                            }}
                            className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" /> Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Delivery progress */}
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px]">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="h-3 w-3" /> {b.sent_count}
                              </span>
                              {b.failed_count > 0 && (
                                <span className="text-red-600">{b.failed_count} failed</span>
                              )}
                              <span className="text-muted-foreground">of {b.total}</span>
                            </div>
                            <button
                              onClick={() => openDetail(b.id)}
                              className="font-medium text-primary hover:underline"
                            >
                              Details
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Campaign detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setDetail(null)}
          />
          <div className="relative flex h-full w-full max-w-md flex-col border-s border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <button
                onClick={() => setDetail(null)}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" /> Close
              </button>
              {detail.data && detail.data.counts.failed > 0 && (
                <button
                  onClick={retry}
                  disabled={retrying}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {retrying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCw className="h-3.5 w-3.5" />
                  )}
                  Retry {detail.data.counts.failed} failed
                </button>
              )}
            </div>

            {detail.loading || !detail.data ? (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="flex-1 overflow-auto p-4">
                <p className="mb-3 line-clamp-3 rounded-lg bg-muted/50 p-2.5 text-xs text-foreground">
                  {detail.data.batch.message}
                </p>
                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-border p-2">
                    <p className="text-lg font-bold text-emerald-600">
                      {detail.data.counts.sent}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Sent</p>
                  </div>
                  <div className="rounded-lg border border-border p-2">
                    <p className="text-lg font-bold text-red-600">
                      {detail.data.counts.failed}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Failed</p>
                  </div>
                  <div className="rounded-lg border border-border p-2">
                    <p className="text-lg font-bold text-muted-foreground">
                      {detail.data.counts.pending}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Pending</p>
                  </div>
                </div>
                <div className="space-y-1">
                  {detail.data.recipients.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.recipient}</p>
                        {r.error && (
                          <p className="truncate text-[10px] text-red-500">{r.error}</p>
                        )}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          r.status === "sent"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : r.status === "failed"
                            ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {r.status}
                      </span>
                    </div>
                  ))}
                  {detail.data.recipients.length === 0 && (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No recipients recorded.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
