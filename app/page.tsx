import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  GitBranch,
  MessageSquare,
  Users,
  Radio,
  MessageCircle,
  Zap,
  CheckCircle,
  TrendingUp,
  Heart,
  Sparkles,
  ListOrdered,
  Link2,
  Globe,
} from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";
import { getDictionary } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/language-switcher";

const FEATURE_ICONS = [
  Globe,
  MessageCircle,
  GitBranch,
  Sparkles,
  MessageSquare,
  Users,
  Radio,
  ListOrdered,
  Zap,
];
const STEP_ICONS = [CheckCircle, GitBranch, TrendingUp];
const USE_CASE_ICONS = [Heart, TrendingUp, Users];

const PLATFORMS = [
  { name: "Instagram", platform: "instagram" },
  { name: "Facebook", platform: "facebook" },
  { name: "WhatsApp", platform: "whatsapp" },
  { name: "Telegram", platform: "telegram" },
  { name: "X / Twitter", platform: "twitter" },
  { name: "Bluesky", platform: "bluesky" },
  { name: "Reddit", platform: "reddit" },
];

export default async function Home() {
  const { hero, nav, footer, landing } = await getDictionary();

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="SpirChat" width={28} height={28} className="rounded-lg" />
            <span className="text-base font-bold text-gray-900">SpirChat</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-900"
            >
              {nav.login}
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {nav.getStarted}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-20 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-1.5">
            <span className="text-xs font-medium text-indigo-700">{hero.badge}</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            {hero.titleLead}{" "}
            <span className="bg-gradient-to-r from-violet-600 to-cyan-500 bg-clip-text text-transparent">
              {hero.titleHighlight}
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-gray-500">
            {hero.subtitle}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 sm:w-auto"
            >
              {hero.ctaPrimary}
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:w-auto"
            >
              {nav.login}
            </Link>
          </div>
          <p className="mt-4 text-xs text-gray-400">{hero.note}</p>
        </div>

        {/* Flow builder preview */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-xl">
            <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-red-300" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-300" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-300" />
              <span className="text-xs text-gray-400">{landing.previewFlow}</span>
            </div>
            <div
              className="relative flex min-h-[300px] flex-wrap items-center justify-center gap-4 p-8 sm:gap-6 sm:p-12"
              style={{
                backgroundImage: "radial-gradient(circle, #e5e7eb 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            >
              <div className="w-40 rounded-xl border-2 border-indigo-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50">
                    <MessageCircle className="h-3.5 w-3.5 text-indigo-600" />
                  </div>
                  <span className="text-xs font-semibold text-gray-900">{landing.features.items[1].title}</span>
                </div>
                <p className="text-[10px] text-gray-500">{landing.features.items[0].title}</p>
              </div>

              <div className="hidden h-0.5 w-6 bg-gray-300 sm:block" />

              <div className="hidden w-44 rounded-xl border-2 border-emerald-200 bg-white p-4 shadow-sm sm:block">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50">
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <span className="text-xs font-semibold text-gray-900">{landing.features.items[4].title}</span>
                </div>
                <p className="text-[10px] text-gray-500">{landing.features.items[3].title}</p>
              </div>

              <div className="hidden h-0.5 w-6 bg-gray-300 sm:block" />

              <div className="w-36 rounded-xl border-2 border-amber-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50">
                    <Users className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <span className="text-xs font-semibold text-gray-900">{landing.features.items[5].title}</span>
                </div>
                <p className="text-[10px] text-gray-500">{landing.features.items[7].title}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section className="border-y border-gray-100 bg-gray-50/60 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-gray-400">
            {landing.platformsNote}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {PLATFORMS.map((p) => (
              <span key={p.platform} className="inline-flex items-center gap-2 text-sm font-medium text-gray-500">
                <PlatformIcon platform={p.platform} size={18} />
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-100 bg-gray-50/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              {landing.features.heading}
            </h2>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-3">
            {landing.features.items.map((item, i) => {
              const Icon = FEATURE_ICONS[i] ?? Sparkles;
              return (
                <div key={item.title} className="bg-white p-6">
                  <Icon className="mb-3 h-5 w-5 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
            {landing.how.heading}
          </h2>
          <div className="mx-auto mt-14 grid max-w-3xl gap-10 sm:grid-cols-3">
            {landing.how.steps.map((item, i) => {
              const Icon = STEP_ICONS[i] ?? CheckCircle;
              return (
                <div key={item.title} className="text-center">
                  <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
                    <Icon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="border-t border-gray-100 bg-gray-50/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
            {landing.useCases.heading}
          </h2>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-3">
            {landing.useCases.items.map((item, i) => {
              const Icon = USE_CASE_ICONS[i] ?? Heart;
              return (
                <div key={item.title} className="rounded-xl border border-gray-200 bg-white p-6">
                  <Icon className="mb-3 h-5 w-5 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="rounded-2xl bg-indigo-600 p-10 sm:p-14">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                {landing.cta.heading}
              </h2>
              <p className="mt-3 text-sm text-indigo-100">{landing.cta.sub}</p>
              <div className="mt-8 flex justify-center">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-medium text-indigo-600 shadow-sm hover:bg-indigo-50"
                >
                  {landing.cta.primary}
                  <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm text-gray-400">SpirChat</span>
            <span className="hidden text-sm text-gray-400 sm:inline">{footer.tagline}</span>
            <Link
              href="https://zernio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-80"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/powered-by-zernio.svg" alt="Powered by Zernio" className="h-10" />
            </Link>
          </div>
          <p className="text-xs text-gray-400">{hero.badge}</p>
        </div>
      </footer>
    </div>
  );
}
