"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageCircle,
  Check,
  Loader2,
  Plug,
  Unplug,
  RefreshCw,
  Copy,
  ExternalLink,
  CheckCircle2,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import {
  connectWhatsAppCloud,
  disconnectWhatsAppCloud,
  syncWhatsAppTemplates,
  checkWhatsAppHealth,
} from "@/lib/actions/whatsapp-connect";
import { EmbeddedSignupButton } from "@/components/settings/embedded-signup-button";
import { CampaignPreview } from "@/components/outreach/campaign-preview";
import { PageTitle } from "@/components/page-title";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

interface Tpl {
  name: string;
  language: string;
  status: string;
  category: string | null;
}

export function WhatsAppPageView({
  connection,
  templates,
  callbackUrl,
  verifyTokenSet,
}: {
  connection: { displayNumber: string | null; verifiedName: string | null; hasWaba: boolean } | null;
  templates: Tpl[];
  callbackUrl: string;
  verifyTokenSet: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const wp = t.dash.whatsappPage;
  const wa = t.dash.settings.wa;

  const [token, setToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedTpl, setSelectedTpl] = useState<Tpl | null>(templates[0] ?? null);
  const [health, setHealth] = useState<
    { state: "idle" | "checking" } | { state: "ok"; number: string | null } | { state: "error"; error: string }
  >({ state: "idle" });

  async function runHealthCheck() {
    setHealth({ state: "checking" });
    const res = await checkWhatsAppHealth();
    if (res.ok) setHealth({ state: "ok", number: res.displayNumber });
    else setHealth({ state: "error", error: res.error });
  }

  async function connect() {
    if (busy || !token.trim() || !phoneNumberId.trim()) return;
    setBusy(true);
    setError(null);
    const res = await connectWhatsAppCloud({ token, phoneNumberId, wabaId });
    setBusy(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setToken("");
    setPhoneNumberId("");
    router.refresh();
  }

  async function disconnect() {
    if (!confirm(wa.disconnectConfirm)) return;
    setBusy(true);
    await disconnectWhatsAppCloud();
    setBusy(false);
    router.refresh();
  }

  async function syncTemplates() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await syncWhatsAppTemplates();
    setBusy(false);
    if ("error" in res && res.error) setError(res.error);
    else if ("ok" in res && res.ok)
      setNotice(
        wa.templatesSynced
          .replace("{total}", String(res.total))
          .replace("{approved}", String(res.approved))
      );
    router.refresh();
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    });
  }

  const requirements = [wp.req1, wp.req2, wp.req3, wp.req4];
  const steps = [wp.step1, wp.step2, wp.step3, wp.step4, wp.step5];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <PageTitle icon={MessageCircle} title={wp.title} subtitle={wp.subtitle} />
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
              {notice}
            </p>
          )}

          {/* Status hero */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl",
                  connection
                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {connection ? <Check className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {connection ? connection.verifiedName || wa.connected : wp.statusNotConnected}
                </p>
                <p className="text-xs text-muted-foreground">
                  {connection
                    ? connection.displayNumber || wa.numberConnected
                    : wp.subtitle}
                </p>
              </div>
            </div>
            {connection && (
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {/* Live health result */}
                {health.state === "ok" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {wp.healthy}
                  </span>
                )}
                {health.state === "error" && (
                  <span
                    title={health.error}
                    className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    {wp.unhealthy}
                  </span>
                )}
                <button
                  onClick={runHealthCheck}
                  disabled={health.state === "checking"}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  {health.state === "checking" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  )}
                  {wp.checkHealth}
                </button>
                <button
                  onClick={syncTemplates}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  <RefreshCw className={busy ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                  {wa.syncTemplates}
                </button>
                <button
                  onClick={disconnect}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  <Unplug className="h-3.5 w-3.5" />
                  {wa.disconnect}
                </button>
              </div>
            )}
          </div>

          {/* Connect (only when not connected) */}
          {!connection && (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold">{wp.connectTitle}</h2>
              <EmbeddedSignupButton />
              <div className="space-y-2">
                <input
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder={wa.phoneIdPlaceholder}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <input
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  placeholder={wa.wabaIdPlaceholder}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  type="password"
                  placeholder={wa.tokenPlaceholder}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">{wa.credsHint}</p>
                  <button
                    onClick={connect}
                    disabled={busy || !token.trim() || !phoneNumberId.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                    {wa.verifyConnect}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Requirements + steps */}
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="mb-3 flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">{wp.requirementsTitle}</h2>
              </div>
              <ul className="space-y-2">
                {requirements.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold">{wp.stepsTitle}</h2>
              <ol className="space-y-2">
                {steps.map((st, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <span>{st}</span>
                  </li>
                ))}
              </ol>
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {wp.guideOpen}
                <ExternalLink className="h-3 w-3" />
              </a>
            </section>
          </div>

          {/* Webhook configuration */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="text-sm font-semibold">{wp.webhookTitle}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{wp.webhookDesc}</p>
            <div className="mt-3 space-y-2">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  {wp.callbackUrl}
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                    {callbackUrl}
                  </code>
                  <button
                    onClick={() => copy(callbackUrl, "url")}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-xs font-medium hover:bg-muted"
                  >
                    {copied === "url" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" /> {wp.copied}
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> {wp.copy}
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  {wp.verifyTokenLabel}
                </label>
                <p
                  className={cn(
                    "mt-1 rounded-lg border px-3 py-2 text-xs",
                    verifyTokenSet
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
                  )}
                >
                  {verifyTokenSet ? (
                    <span className="inline-flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> {wa.connected}
                    </span>
                  ) : (
                    wp.verifyTokenUnset
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* Approved templates */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{wp.templatesTitle}</h2>
              {connection && (
                <button
                  onClick={syncTemplates}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  <RefreshCw className={busy ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
                  {wa.syncTemplates}
                </button>
              )}
            </div>
            <p className="mb-3 text-xs text-muted-foreground">{wp.templatesHint}</p>
            {templates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                {wp.templatesEmpty}
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Selectable template rows */}
                <div className="space-y-1.5">
                  {templates.map((tpl) => {
                    const active =
                      selectedTpl?.name === tpl.name && selectedTpl?.language === tpl.language;
                    return (
                      <button
                        key={tpl.name + tpl.language}
                        onClick={() => setSelectedTpl(tpl)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-start text-xs transition-colors",
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        <div className="min-w-0">
                          <span className="font-medium">{tpl.name}</span>
                          <span className="ms-2 text-muted-foreground">
                            {tpl.language}
                            {tpl.category ? ` · ${tpl.category}` : ""}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                            tpl.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {tpl.status}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Live chat preview of the selected template */}
                {selectedTpl && (
                  <div className="md:sticky md:top-2 md:self-start">
                    <CampaignPreview
                      channel="whatsapp"
                      templateMode
                      message=""
                      subject=""
                      sampleRecipient={connection?.displayNumber ?? null}
                      template={{
                        name: selectedTpl.name,
                        lang: selectedTpl.language,
                        params: [],
                        headerText: "",
                        headerMediaType: "",
                        headerMediaUrl: "",
                        buttonParam: "",
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
