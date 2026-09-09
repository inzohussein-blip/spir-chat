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

export function WhatsAppSection({
  connection,
}: {
  connection: { displayNumber: string | null; verifiedName: string | null } | null;
}) {
  const router = useRouter();
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
    if (!confirm("Disconnect WhatsApp from this workspace?")) return;
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
      setNotice(`Synced ${res.total} templates (${res.approved} approved).`);
    router.refresh();
  }

  return (
    <section>
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">WhatsApp (Official — Meta Cloud API)</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Connect your own WhatsApp Business number. We verify it against Meta, then
        two-way chat lands in the Inbox and you can run template campaigns.
      </p>

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
                  {connection.verifiedName || "Connected"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {connection.displayNumber || "WhatsApp number connected"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={syncTemplates}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={busy ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Sync templates
              </button>
              <button
                onClick={disconnect}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                <Unplug className="h-3.5 w-3.5" /> Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <EmbeddedSignupButton />
            <input
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="Phone number ID (from Meta WhatsApp dashboard)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              placeholder="WhatsApp Business Account ID (for template sync — optional)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type="password"
              placeholder="Access token"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                Get these from developers.facebook.com → your app → WhatsApp → API Setup.
              </p>
              <button
                onClick={connect}
                disabled={busy || !token.trim() || !phoneNumberId.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                Verify &amp; connect
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
