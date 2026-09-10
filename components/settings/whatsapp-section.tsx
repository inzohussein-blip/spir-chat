"use client";

import { useState } from "react";
import { MessageCircle, Check, Loader2, Plug, Unplug, RefreshCw } from "lucide-react";
import {
  connectWhatsAppCloud,
  disconnectWhatsAppCloud,
  syncWhatsAppTemplates,
} from "@/lib/actions/whatsapp-connect";
import { useRouter } from "next/navigation";
import { EmbeddedSignupButton } from "@/components/settings/embedded-signup-button";
import { useI18n } from "@/components/i18n-provider";

export function WhatsAppSection({
  connection,
}: {
  connection: { displayNumber: string | null; verifiedName: string | null } | null;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const s = t.dash.settings;
  const [token, setToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    if (!confirm(s.wa.disconnectConfirm)) return;
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
        s.wa.templatesSynced
          .replace("{total}", String(res.total))
          .replace("{approved}", String(res.approved))
      );
    router.refresh();
  }

  return (
    <section>
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{s.wa.title}</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{s.wa.desc}</p>

      {notice && (
        <p className="mt-2 text-xs text-emerald-600">{notice}</p>
      )}
      <div className="mt-4 rounded-xl border border-border bg-card p-5 shadow-card">
        {connection ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40">
                <Check className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium">
                  {connection.verifiedName || s.wa.connected}
                </p>
                <p className="text-xs text-muted-foreground">
                  {connection.displayNumber || s.wa.numberConnected}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={syncTemplates}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={busy ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> {s.wa.syncTemplates}
              </button>
              <button
                onClick={disconnect}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                <Unplug className="h-3.5 w-3.5" /> {s.wa.disconnect}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <EmbeddedSignupButton />
            <input
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder={s.wa.phoneIdPlaceholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              placeholder={s.wa.wabaIdPlaceholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type="password"
              placeholder={s.wa.tokenPlaceholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">{s.wa.credsHint}</p>
              <button
                onClick={connect}
                disabled={busy || !token.trim() || !phoneNumberId.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                {s.wa.verifyConnect}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
