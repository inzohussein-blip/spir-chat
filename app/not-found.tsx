"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";

export default function NotFound() {
  const { t } = useI18n();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -top-32 start-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 text-2xl font-bold text-white shadow-lg shadow-primary/30">
          S
        </div>
        <div>
          <p className="text-5xl font-bold text-muted-foreground/40">404</p>
          <h1 className="mt-3 text-2xl font-bold">{t.errors.notFoundTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.errors.notFoundDesc}</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          {t.errors.goHome}
        </Link>
      </div>
    </div>
  );
}
