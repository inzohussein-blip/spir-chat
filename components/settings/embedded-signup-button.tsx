"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Facebook, Loader2 } from "lucide-react";
import { completeEmbeddedSignup } from "@/lib/actions/whatsapp-connect";
import { useI18n } from "@/components/i18n-provider";

const APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID;

/**
 * One-click WhatsApp onboarding via Meta Embedded Signup (Facebook JS SDK).
 * Renders nothing unless the public app id + config id are configured. On
 * success the popup emits the phone_number_id / waba_id, and FB.login returns a
 * code we exchange server-side.
 */
export function EmbeddedSignupButton() {
  const router = useRouter();
  const { t } = useI18n();
  const s = t.dash.settings;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = useRef<{ phoneNumberId?: string; wabaId?: string }>({});

  useEffect(() => {
    if (!APP_ID || !CONFIG_ID) return;
    if (document.getElementById("facebook-jssdk")) return;
    (window as any).fbAsyncInit = function () {
      (window as any).FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: false, version: "v21.0" });
    };
    const s = document.createElement("script");
    s.id = "facebook-jssdk";
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.async = true;
    s.defer = true;
    document.body.appendChild(s);
  }, []);

  // Capture the phone_number_id / waba_id the signup flow posts back.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.origin.endsWith("facebook.com")) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.data) {
          session.current = {
            phoneNumberId: data.data.phone_number_id,
            wabaId: data.data.waba_id,
          };
        }
      } catch {
        // not our message
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!APP_ID || !CONFIG_ID) return null;

  function launch() {
    const FB = (window as any).FB;
    if (!FB) {
      setError(s.wa.sdkLoading);
      return;
    }
    setError(null);
    FB.login(
      async (response: any) => {
        const code = response?.authResponse?.code;
        const { phoneNumberId, wabaId } = session.current;
        if (!code || !phoneNumberId) {
          setError(s.wa.signupCancelled);
          return;
        }
        setBusy(true);
        const res = await completeEmbeddedSignup({ code, phoneNumberId, wabaId });
        setBusy(false);
        if ((res as any)?.error) setError((res as any).error);
        else router.refresh();
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      }
    );
  }

  return (
    <div className="mb-3">
      <button
        onClick={launch}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Facebook className="h-4 w-4" />}
        {s.wa.connectFacebook}
      </button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      <p className="mt-1 text-[11px] text-muted-foreground">{s.wa.oneClick}</p>
    </div>
  );
}
