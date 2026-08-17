"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  GitBranch,
  MessageSquare,
  Users,
  Radio,
  Megaphone,
  Link2,
  ListOrdered,
  BarChart3,
  LineChart,
  Sprout,
  Globe,
  MessageSquareText,
  ClipboardList,
  BookOpen,
  Plug,
  Blocks,
  Code2,
  Settings,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { PushToggle } from "@/components/push-toggle";
import { useI18n } from "@/components/i18n-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { Database } from "@/lib/types/database";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];

interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  role: string;
}

function subscribeToThemeClass(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const navigation: {
  key: keyof Dictionary["sidebar"];
  href: string;
  icon: typeof GitBranch;
}[] = [
  { key: "flows", href: "/dashboard/flows", icon: GitBranch },
  { key: "inbox", href: "/dashboard/inbox", icon: MessageSquare },
  { key: "contacts", href: "/dashboard/contacts", icon: Users },
  { key: "broadcasts", href: "/dashboard/broadcasts", icon: Radio },
  { key: "campaigns", href: "/dashboard/campaigns", icon: Megaphone },
  { key: "links", href: "/dashboard/links", icon: Link2 },
  { key: "sequences", href: "/dashboard/sequences", icon: ListOrdered },
  { key: "analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { key: "reports", href: "/dashboard/reports", icon: LineChart },
  { key: "growth", href: "/dashboard/growth", icon: Sprout },
  { key: "website", href: "/dashboard/widgets", icon: Globe },
  { key: "savedReplies", href: "/dashboard/saved-replies", icon: MessageSquareText },
  { key: "forms", href: "/dashboard/forms", icon: ClipboardList },
  { key: "helpCenter", href: "/dashboard/help-center", icon: BookOpen },
  { key: "channels", href: "/dashboard/channels", icon: Plug },
  { key: "integrations", href: "/dashboard/integrations", icon: Blocks },
  { key: "developers", href: "/dashboard/developers", icon: Code2 },
  { key: "settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar({
  workspace,
  workspaces,
}: {
  workspace: Workspace;
  user: { id: string; email?: string };
  workspaces: WorkspaceItem[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();
  const dark = useSyncExternalStore(
    subscribeToThemeClass,
    () => document.documentElement.classList.contains("dark"),
    () => false
  );

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full w-60 flex-col border-e border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 text-sm font-bold text-white shadow-sm">
          S
        </div>
        <span className="text-base font-bold tracking-tight">SpirChat</span>
      </div>

      <div className="px-3 pt-2 pb-2">
        <WorkspaceSwitcher current={workspace} workspaces={workspaces} />
      </div>

      <nav className="flex-1 space-y-0.5 px-3 pb-3">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  isActive
                    ? "text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
                )}
              />
              {t.sidebar[item.key]}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-1">
        <PushToggle />
        <div className="px-1 pb-1">
          <LanguageSwitcher />
        </div>
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {dark ? t.sidebar.lightMode : t.sidebar.darkMode}
        </button>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {t.sidebar.signOut}
        </button>
      </div>
    </div>
  );
}
