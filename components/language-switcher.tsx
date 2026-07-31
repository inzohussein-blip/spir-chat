"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { setLocale } from "@/lib/i18n/actions";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

/**
 * Toggles between the available locales. Persists the choice server-side then
 * refreshes so server components re-render (and <html dir/lang> flips).
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border p-0.5 text-xs",
        className
      )}
    >
      <Languages className="mx-1 h-3.5 w-3.5 text-muted-foreground" />
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => choose(l)}
          disabled={pending}
          className={cn(
            "rounded-md px-2 py-1 font-medium transition-colors disabled:opacity-60",
            l === locale
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
