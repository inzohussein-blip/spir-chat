import Link from "next/link";
import { getWorkspace } from "@/lib/workspace";
import {
  Inbox,
  MessageSquare,
  Users,
  Send,
  ArrowUpRight,
  GitBranch,
  Megaphone,
  Radio,
  Plug,
  Sparkles,
  Clock,
} from "lucide-react";
import { avatarGradient } from "@/lib/avatar";
import { cn } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const QUICK_ACTIONS = [
  { href: "/dashboard/inbox", label: "Open inbox", icon: Inbox },
  { href: "/dashboard/flows", label: "Build a flow", icon: GitBranch },
  { href: "/dashboard/campaigns", label: "New campaign", icon: Megaphone },
  { href: "/dashboard/broadcasts", label: "Send a broadcast", icon: Radio },
];

export default async function HomePage() {
  const { workspace, user, supabase } = await getWorkspace();
  const wsId = workspace.id;
  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();

  const convBase = () =>
    supabase.from("conversations").select("*", { count: "exact", head: true }).eq("workspace_id", wsId);

  const [
    { count: openCount },
    { count: totalConv },
    { count: contactsCount },
    { count: repliesWeek },
    { count: channelsCount },
    { data: recent },
  ] = await Promise.all([
    convBase().eq("status", "open"),
    convBase(),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("workspace_id", wsId),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "outbound")
      .gte("created_at", weekAgo),
    supabase.from("channels").select("*", { count: "exact", head: true }).eq("workspace_id", wsId),
    supabase
      .from("conversations")
      .select("id, platform, status, unread_count, last_message_preview, last_message_at, contacts(display_name)")
      .eq("workspace_id", wsId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(6),
  ]);

  const greetName = (user.email ?? "there").split("@")[0];

  const stats = [
    { label: "Open conversations", value: openCount ?? 0, icon: Inbox, href: "/dashboard/inbox", tone: "text-emerald-600" },
    { label: "Total conversations", value: totalConv ?? 0, icon: MessageSquare, href: "/dashboard/reports", tone: "text-violet-600" },
    { label: "Contacts", value: contactsCount ?? 0, icon: Users, href: "/dashboard/contacts", tone: "text-blue-600" },
    { label: "Replies sent (7d)", value: repliesWeek ?? 0, icon: Send, href: "/dashboard/reports", tone: "text-cyan-600" },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Greeting banner */}
      <div className="border-b border-border bg-gradient-to-br from-violet-600 to-cyan-500 px-8 py-8 text-white">
        <div className="flex items-center gap-2 text-sm font-medium text-white/80">
          <Sparkles className="h-4 w-4" />
          {workspace.name}
        </div>
        <h1 className="mt-1 text-2xl font-bold capitalize tracking-tight">
          Welcome back, {greetName}
        </h1>
        <p className="mt-1 text-sm text-white/80">
          Here&apos;s what&apos;s happening across your workspace today.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Stat tiles */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="group rounded-xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <s.icon className={cn("h-4 w-4", s.tone)} />
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <p className="text-3xl font-bold">{s.value}</p>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                </div>
              </Link>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Recent conversations */}
            <div className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Recent conversations</h2>
                <Link href="/dashboard/inbox" className="text-xs font-medium text-primary hover:underline">
                  View all
                </Link>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-card">
                {(recent ?? []).length === 0 ? (
                  <div className="p-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                      <MessageSquare className="h-7 w-7 text-primary" />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      No conversations yet. Connect a channel to get started.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {(recent ?? []).map((c) => {
                      const contact = c.contacts as { display_name: string | null } | null;
                      const name = contact?.display_name || "Unknown contact";
                      return (
                        <li key={c.id}>
                          <Link
                            href="/dashboard/inbox"
                            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
                          >
                            <span
                              className={cn(
                                "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white",
                                avatarGradient(name)
                              )}
                            >
                              {name.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium">{name}</p>
                                {(c.unread_count ?? 0) > 0 && (
                                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                    {c.unread_count}
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-xs text-muted-foreground">
                                {c.last_message_preview || "No messages yet"}
                              </p>
                            </div>
                            <span className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {timeAgo(c.last_message_at)}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Quick actions + setup */}
            <div className="space-y-6">
              <div>
                <h2 className="mb-3 text-sm font-semibold">Quick actions</h2>
                <div className="grid grid-cols-2 gap-3">
                  {QUICK_ACTIONS.map((a) => (
                    <Link
                      key={a.href}
                      href={a.href}
                      className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <a.icon className="h-5 w-5" />
                      </span>
                      <span className="text-xs font-medium">{a.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <Link
                href="/dashboard/channels"
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Plug className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {channelsCount ? `${channelsCount} channel${channelsCount !== 1 ? "s" : ""} connected` : "Connect a channel"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {channelsCount ? "Manage your channels" : "Link Instagram, WhatsApp, and more"}
                  </p>
                </div>
                <ArrowUpRight className="ms-auto h-4 w-4 flex-shrink-0 text-muted-foreground/40" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
