"use client";

import { useState } from "react";
import { Send, Check, Save, Loader2, Mail, MessageCircle } from "lucide-react";
import { updateCampaignProviders } from "@/lib/actions/campaign-providers";
import { useI18n } from "@/components/i18n-provider";

export interface ProvidersInitial {
  hasResend: boolean;
  campaignFromEmail: string;
  twilioAccountSid: string;
  hasTwilioAuth: boolean;
  twilioSmsFrom: string;
  twilioWhatsappFrom: string;
  telegramGatewayUrl: string;
  hasTelegramToken: boolean;
}

export function ProvidersSection({ initial }: { initial: ProvidersInitial }) {
  const { t } = useI18n();
  const p = t.dash.settings.providers;

  const [resendKey, setResendKey] = useState("");
  const [fromEmail, setFromEmail] = useState(initial.campaignFromEmail);
  const [twilioSid, setTwilioSid] = useState(initial.twilioAccountSid);
  const [twilioToken, setTwilioToken] = useState("");
  const [smsFrom, setSmsFrom] = useState(initial.twilioSmsFrom);
  const [waFrom, setWaFrom] = useState(initial.twilioWhatsappFrom);
  const [gatewayUrl, setGatewayUrl] = useState(initial.telegramGatewayUrl);
  const [gatewayToken, setGatewayToken] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const secretPlaceholder = (has: boolean) => (has ? p.secretSet : "");

  async function save() {
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    const res = await updateCampaignProviders({
      resendApiKey: resendKey,
      campaignFromEmail: fromEmail,
      twilioAccountSid: twilioSid,
      twilioAuthToken: twilioToken,
      twilioSmsFrom: smsFrom,
      twilioWhatsappFrom: waFrom,
      telegramGatewayUrl: gatewayUrl,
      telegramGatewayToken: gatewayToken,
    });
    setSaving(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setResendKey("");
    setTwilioToken("");
    setGatewayToken("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const inputCls =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <section>
      <div className="flex items-center gap-2">
        <Send className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{p.title}</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>

      <div className="mt-4 space-y-4">
        {/* Email (Resend) */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" /> {p.emailTitle}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-[11px] text-muted-foreground">{p.resendKey}</label>
              <input
                type="password"
                value={resendKey}
                onChange={(e) => setResendKey(e.target.value)}
                placeholder={secretPlaceholder(initial.hasResend)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{p.fromEmail}</label>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="you@yourdomain.com"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Twilio */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
            <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" /> {p.smsTitle}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-[11px] text-muted-foreground">{p.twilioSid}</label>
              <input
                value={twilioSid}
                onChange={(e) => setTwilioSid(e.target.value)}
                placeholder="ACxxxxxxxx"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{p.twilioToken}</label>
              <input
                type="password"
                value={twilioToken}
                onChange={(e) => setTwilioToken(e.target.value)}
                placeholder={secretPlaceholder(initial.hasTwilioAuth)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{p.smsFrom}</label>
              <input
                value={smsFrom}
                onChange={(e) => setSmsFrom(e.target.value)}
                placeholder="+15551234567"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{p.waFrom}</label>
              <input
                value={waFrom}
                onChange={(e) => setWaFrom(e.target.value)}
                placeholder="+15551234567"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Telegram */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
            <Send className="h-3.5 w-3.5 text-muted-foreground" /> {p.telegramTitle}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-[11px] text-muted-foreground">{p.gatewayUrl}</label>
              <input
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
                placeholder="https://…"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{p.gatewayToken}</label>
              <input
                type="password"
                value={gatewayToken}
                onChange={(e) => setGatewayToken(e.target.value)}
                placeholder={secretPlaceholder(initial.hasTelegramToken)}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saved ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" /> {t.dash.settings.saved}
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" /> {t.dash.settings.save}
              </>
            )}
          </button>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      </div>
    </section>
  );
}
