"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Bell, LogOut, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// Quick-jump destinations, keyed by the same sidebar labels.
const DESTINATIONS: { key: keyof Dictionary["sidebar"]; href: string }[] = [
  { key: "home", href: "/dashboard/home" },
  { key: "inbox", href: "/dashboard/inbox" },
  { key: "contacts", href: "/dashboard/contacts" },
  { key: "savedReplies", href: "/dashboard/saved-replies" },
  { key: "macros", href: "/dashboard/macros" },
  { key: "flows", href: "/dashboard/flows" },
  { key: "sequences", href: "/dashboard/sequences" },
  { key: "igAutomations", href: "/dashboard/ig-automations" },
  { key: "broadcasts", href: "/dashboard/broadcasts" },
  { key: "campaigns", href: "/dashboard/campaigns" },
  { key: "segments", href: "/dashboard/segments" },
  { key: "growth", href: "/dashboard/growth" },
  { key: "links", href: "/dashboard/links" },
  { key: "forms", href: "/dashboard/forms" },
  { key: "helpCenter", href: "/dashboard/help-center" },
  { key: "website", href: "/dashboard/widgets" },
  { key: "analytics", href: "/dashboard/analytics" },
  { key: "reports", href: "/dashboard/reports" },
  { key: "channels", href: "/dashboard/channels" },
  { key: "integrations", href: "/dashboard/integrations" },
  { key: "developers", href: "/dashboard/developers" },
  { key: "settings", href: "/dashboard/settings" },
];

export function Topbar({
  userEmail,
  unreadCount,
}: {
  userEmail?: string;
  unreadCount: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [active, setActive] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = DESTINATIONS.map((d) => ({ ...d, label: t.sidebar[d.key] }));
    if (!q) return [];
    return all.filter((d) => d.label.toLowerCase().includes(q)).slice(0, 6);
  }, [query, t]);

  useEffect(() => setActive(0), [query]);

  // Close popovers on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(href: string) {
    setQuery("");
    setSearchOpen(false);
    router.push(href);
  }

  function onSearchKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      go(results[active].href);
    } else if (e.key === "Escape") {
      setSearchOpen(false);
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = (userEmail ?? "?").charAt(0).toUpperCase();

  return (
    <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-border bg-card/60 px-4 backdrop-blur">
      {/* Quick-jump search */}
      <div ref={searchRef} className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={onSearchKey}
          placeholder={t.topbar.searchPlaceholder}
          className="w-full rounded-lg border border-border bg-background py-2 ps-9 pe-3 text-sm outline-none focus:border-primary"
        />
        {searchOpen && query.trim() && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg">
            {results.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">{t.topbar.noResults}</p>
            ) : (
              results.map((r, i) => (
                <button
                  key={r.href}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r.href)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-start text-sm",
                    i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                  )}
                >
                  <span>{r.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="ms-auto flex items-center gap-1">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen((o) => !o);
              setUserOpen(false);
            }}
            aria-label={t.topbar.notifications}
            className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
              <div className="absolute end-0 z-40 mt-1 w-72 rounded-lg border border-border bg-popover p-1 shadow-lg">
                <p className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                  {t.topbar.notifications}
                </p>
                <div className="px-3 py-2 text-sm">
                  {unreadCount > 0 ? (
                    <span>
                      <span className="font-semibold text-foreground">{unreadCount}</span>{" "}
                      {t.topbar.unread}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t.topbar.allCaughtUp}</span>
                  )}
                </div>
                <Link
                  href="/dashboard/inbox"
                  onClick={() => setNotifOpen(false)}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-accent"
                >
                  {t.topbar.viewInbox}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => {
              setUserOpen((o) => !o);
              setNotifOpen(false);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 text-xs font-semibold text-white"
            aria-label={userEmail}
          >
            {initial}
          </button>
          {userOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setUserOpen(false)} />
              <div className="absolute end-0 z-40 mt-1 w-56 rounded-lg border border-border bg-popover p-1 shadow-lg">
                <p className="truncate px-3 py-2 text-xs text-muted-foreground">{userEmail}</p>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setUserOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
                >
                  {t.sidebar.settings}
                </Link>
                <button
                  onClick={signOut}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  {t.topbar.signOut}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
