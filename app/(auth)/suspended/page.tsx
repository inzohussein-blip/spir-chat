"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { reactivateSelf } from "@/lib/actions/team";
import { useI18n } from "@/components/i18n-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Lock } from "lucide-react";

export default function SuspendedPage() {
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setChecking(false);
    });
  }, [supabase, router]);

  async function reopen() {
    setLoading(true);
    setError(null);
    const res = await reactivateSelf();
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (checking) return null;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -top-32 start-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-destructive/20 blur-3xl" />
      <div className="relative w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <LanguageSwitcher />
        </div>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t.auth.suspendedTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.auth.suspendedDesc}</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="space-y-2">
          <button
            onClick={reopen}
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {t.auth.reopenAccount}
          </button>
          <button
            onClick={signOut}
            className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
          >
            {t.auth.signOut}
          </button>
        </div>
      </div>
    </div>
  );
}
