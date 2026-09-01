"use client";

import { useState, useEffect } from "react";
import { Search, MessageSquare, Filter, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { avatarGradient } from "@/lib/avatar";
import { PlatformIcon } from "@/components/platform-icon";
import { useI18n } from "@/components/i18n-provider";
import { Bookmark, Plus, X } from "lucide-react";
import { createInboxView, deleteInboxView } from "@/lib/actions/inbox-views";
import { searchMessages, type MessageSearchHit } from "@/lib/actions/search";
import { comparePriority, normalizePriority, PRIORITY_BADGE, PRIORITY_LABEL } from "@/lib/priority";
import type { Database, Platform, ConversationStatus } from "@/lib/types/database";

type Conversation = Database["public"]["Tables"]["conversations"]["Row"] & {
  contacts: Database["public"]["Tables"]["contacts"]["Row"] | null;
};
type ChannelOption = {
  id: string;
  platform: Platform;
  display_name: string | null;
  username: string | null;
};

function channelLabel(c: ChannelOption): string {
  return c.display_name || c.username || c.platform;
}

function formatTime(dateStr: string | null, yesterdayLabel: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return yesterdayLabel;
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ConversationList({
  conversations: initialConversations,
  workspaceId,
  selectedId,
  onSelect,
  onPrefetch,
  channels = [],
  currentUserId,
  slaMinutes = 0,
}: {
  conversations: Conversation[];
  workspaceId: string;
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
  onPrefetch?: (conversationId: string) => void;
  channels?: ChannelOption[];
  currentUserId?: string;
  slaMinutes?: number;
}) {
  const { t } = useI18n();
  const [conversations, setConversations] = useState(initialConversations);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "all">("open");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [views, setViews] = useState<{ id: string; name: string; filters: Record<string, unknown> }[]>([]);
  const [historyHits, setHistoryHits] = useState<MessageSearchHit[] | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);

  async function runHistorySearch() {
    if (historyBusy || search.trim().length < 2) return;
    setHistoryBusy(true);
    const res = await searchMessages(search);
    setHistoryBusy(false);
    setHistoryHits(res.hits);
  }

  async function openHit(hit: MessageSearchHit) {
    const { data } = await createClient()
      .from("conversations")
      .select("*, contacts(*)")
      .eq("id", hit.conversationId)
      .single();
    if (data) {
      onSelect(data as Conversation);
      setHistoryHits(null);
    }
  }

  // A change to the query invalidates any prior history results.
  useEffect(() => {
    setHistoryHits(null);
  }, [search]);

  // Load saved inbox views (shared across the workspace).
  useEffect(() => {
    createClient()
      .from("inbox_views")
      .select("id, name, filters")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setViews((data as typeof views) ?? []));
  }, [workspaceId]);

  function applyView(f: Record<string, unknown>) {
    setStatusFilter((f.status as ConversationStatus | "all") ?? "all");
    setChannelFilter((f.channel as string) ?? "all");
    setMineOnly(f.mine === true);
    setSearch((f.search as string) ?? "");
  }

  async function saveCurrentView() {
    const name = window.prompt("Name this view");
    if (!name?.trim()) return;
    const res = await createInboxView(name, {
      status: statusFilter,
      channel: channelFilter,
      mine: mineOnly,
      search,
    });
    if (res.view) setViews((prev) => [...prev, res.view as (typeof views)[number]]);
  }

  async function removeView(id: string) {
    await deleteInboxView(id);
    setViews((prev) => prev.filter((v) => v.id !== id));
  }
  // Relative timestamps depend on the client's clock/locale, which differ from the
  // server's during SSR and trigger a hydration mismatch (React #418, which crashes
  // the inbox in production). Defer time rendering until after mount so the server
  // and the first client render agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Re-evaluate "online" status periodically so a visitor's dot turns off once
  // their heartbeats stop, even without a new realtime event.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  function isOnline(c: Conversation): boolean {
    if (!c.visitor_last_seen_at) return false;
    return Date.now() - new Date(c.visitor_last_seen_at).getTime() < 45000;
  }

  function isTyping(c: Conversation): boolean {
    if (!c.visitor_typing_at) return false;
    return Date.now() - new Date(c.visitor_typing_at).getTime() < 4000;
  }

  // SLA breach: an open conversation with an unanswered visitor message whose
  // last activity is older than the workspace's first-response target.
  function slaBreached(c: Conversation): boolean {
    if (slaMinutes <= 0 || c.status !== "open" || c.unread_count <= 0) return false;
    const at = c.last_message_at ?? c.created_at;
    return Date.now() - new Date(at).getTime() > slaMinutes * 60000;
  }

  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  // Subscribe to conversation updates via Realtime
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("conversations-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        async (payload) => {
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Database["public"]["Tables"]["conversations"]["Row"];
            setConversations((prev) =>
              prev
                .map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
                .sort((a, b) => {
                  const aTime = a.last_message_at ?? a.created_at;
                  const bTime = b.last_message_at ?? b.created_at;
                  return new Date(bTime).getTime() - new Date(aTime).getTime();
                })
            );
          } else if (payload.eventType === "INSERT") {
            const inserted = payload.new as Database["public"]["Tables"]["conversations"]["Row"];
            // Fetch full conversation with contact
            const { data } = await supabase
              .from("conversations")
              .select("*, contacts(*)")
              .eq("id", inserted.id)
              .single();
            if (data) {
              setConversations((prev) => [data as Conversation, ...prev]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  const channelMap = new Map(channels.map((c) => [c.id, channelLabel(c)]));

  const filtered = conversations
    .filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (channelFilter !== "all" && c.channel_id !== channelFilter) return false;
      if (mineOnly && c.assigned_to !== currentUserId) return false;
      if (priorityOnly && normalizePriority(c.priority) === 0) return false;
      if (search) {
        const name = c.contacts?.display_name?.toLowerCase() ?? "";
        const preview = c.last_message_preview?.toLowerCase() ?? "";
        const q = search.toLowerCase();
        if (!name.includes(q) && !preview.includes(q)) return false;
      }
      return true;
    })
    // High/urgent float to the top, then most recent activity.
    .sort((a, b) =>
      comparePriority(
        { priority: a.priority, at: a.last_message_at ?? a.created_at },
        { priority: b.priority, at: b.last_message_at ?? b.created_at }
      )
    );

  return (
    <div className="flex h-full flex-col border-e border-border bg-card">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <h2 className="text-base font-bold tracking-tight">{t.inbox.title}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {filtered.length}
        </span>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t.inbox.searchConversations}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runHistorySearch();
            }}
            className="w-full rounded-lg border border-input bg-background py-2 ps-9 pe-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {search.trim().length >= 2 && (
          <button
            onClick={runHistorySearch}
            disabled={historyBusy}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
          >
            {historyBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            {t.inbox.searchHistory}
          </button>
        )}
        {historyHits !== null && (
          <div className="mt-2 rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t.inbox.searchHistoryResults} · {historyHits.length}
              </span>
              <button
                onClick={() => setHistoryHits(null)}
                aria-label="Close"
                className="text-muted-foreground/60 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {historyHits.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">
                {t.inbox.noResults}
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto p-1">
                {historyHits.map((h) => (
                  <button
                    key={h.conversationId}
                    onClick={() => openHit(h)}
                    className="flex w-full flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-start hover:bg-accent"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <PlatformIcon platform={h.platform} className="h-3 w-3" size={12} />
                      {h.contactName}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {h.snippet}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Saved views */}
      <div className="flex flex-wrap items-center gap-1 px-3 pb-2">
        {views.map((v) => (
          <span
            key={v.id}
            className="group inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium hover:border-primary/40"
          >
            <button onClick={() => applyView(v.filters)} className="inline-flex items-center gap-1">
              <Bookmark className="h-3 w-3 text-primary" />
              {v.name}
            </button>
            <button
              onClick={() => removeView(v.id)}
              aria-label={`Delete view ${v.name}`}
              className="text-muted-foreground/50 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          onClick={saveCurrentView}
          title="Save current filters as a view"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Save view
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-1 px-3 pb-2">
        {(["all", "open", "closed", "snoozed"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              statusFilter === status
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {status === "all"
              ? t.inbox.filterAll
              : status === "open"
              ? t.inbox.filterOpen
              : status === "closed"
              ? t.inbox.filterResolved
              : t.inbox.filterSnoozed}
          </button>
        ))}
        <div className="ms-auto flex gap-1">
          <button
            onClick={() => setPriorityOnly((p) => !p)}
            title={t.inbox.priorityFilter}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              priorityOnly
                ? "bg-red-600 text-white"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {t.inbox.priorityFilter}
          </button>
          {currentUserId && (
            <button
              onClick={() => setMineOnly((m) => !m)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                mineOnly
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {t.inbox.mine}
            </button>
          )}
        </div>
      </div>

      {/* Channel filter */}
      {channels.length > 0 && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Filter className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="w-full appearance-none rounded-lg border border-input bg-background py-2 ps-9 pe-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">{t.inbox.allChannels}</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {channelLabel(c)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">{t.inbox.noResults}</p>
          </div>
        ) : (
          filtered.map((conversation) => {
            const name = conversation.contacts?.display_name ?? t.inbox.unknown;
            const unread = conversation.unread_count > 0;
            const selected = selectedId === conversation.id;
            return (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation)}
              onMouseEnter={() => onPrefetch?.(conversation.id)}
              onFocus={() => onPrefetch?.(conversation.id)}
              className={cn(
                "relative flex w-full items-start gap-3 rounded-xl p-2.5 text-start transition-colors",
                selected
                  ? "bg-accent"
                  : "hover:bg-muted"
              )}
            >
              {selected && (
                <span className="absolute inset-y-2 start-0 w-1 rounded-full bg-primary" />
              )}
              {/* Avatar with platform badge */}
              <div className="relative flex-shrink-0">
                {conversation.contacts?.avatar_url ? (
                  <img
                    src={conversation.contacts.avatar_url}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white shadow-sm",
                      avatarGradient(name)
                    )}
                  >
                    {name[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <div className="absolute -bottom-0.5 -end-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-card bg-card">
                  <PlatformIcon
                    platform={conversation.platform}
                    className="h-3 w-3"
                    size={12}
                  />
                </div>
                {isOnline(conversation) && (
                  <span
                    title="Online now"
                    className="absolute -top-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-card bg-green-500"
                  />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("truncate text-sm", unread ? "font-bold" : "font-medium")}>
                    {name}
                  </p>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    {normalizePriority(conversation.priority) > 0 && (
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                          PRIORITY_BADGE[normalizePriority(conversation.priority)]
                        )}
                      >
                        {PRIORITY_LABEL[normalizePriority(conversation.priority)]}
                      </span>
                    )}
                    {mounted && slaBreached(conversation) && (
                      <span
                        title="First-response SLA exceeded"
                        className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-700 dark:bg-red-950/50 dark:text-red-300"
                      >
                        SLA
                      </span>
                    )}
                    <span
                      suppressHydrationWarning
                      className="text-[11px] text-muted-foreground"
                    >
                      {mounted ? formatTime(conversation.last_message_at, t.inbox.yesterday) : ""}
                    </span>
                  </div>
                </div>
                {channels.length > 1 && conversation.channel_id && channelMap.get(conversation.channel_id) && (
                  <p className="truncate text-[10px] text-muted-foreground/80">
                    {channelMap.get(conversation.channel_id)}
                  </p>
                )}
                <div className="flex items-center justify-between gap-2">
                  {isTyping(conversation) ? (
                    <p className="mt-0.5 truncate text-xs font-medium text-green-600">
                      {t.inbox.typing}
                    </p>
                  ) : (
                    <p
                      className={cn(
                        "mt-0.5 truncate text-xs",
                        unread ? "font-medium text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {conversation.last_message_preview ?? t.inbox.noMessages}
                    </p>
                  )}
                  {unread && (
                    <span className="ms-2 flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shadow-sm">
                      {conversation.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
            );
          })
        )}
      </div>
    </div>
  );
}
