"use client";

import { useState, useEffect, useRef } from "react";
import { Search, MessageSquare, Filter, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { avatarGradient } from "@/lib/avatar";
import { PlatformIcon } from "@/components/platform-icon";
import { useI18n } from "@/components/i18n-provider";
import { Bookmark, Plus, X, Check, CheckCircle, RotateCcw, Flag, UserPlus, Trash2 } from "lucide-react";
import { createInboxView, deleteInboxView } from "@/lib/actions/inbox-views";
import { searchMessages, type MessageSearchHit } from "@/lib/actions/search";
import { bulkUpdateConversations, bulkAddLabel, bulkDeleteConversations } from "@/lib/actions/conversations";
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
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return yesterdayLabel;
  if (diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ConversationList({
  conversations: initialConversations,
  workspaceId,
  selectedId,
  onSelect,
  onPrefetch,
  channels = [],
  currentUserId,
  agentNames = {},
  labels = [],
  slaMinutes = 0,
}: {
  conversations: Conversation[];
  workspaceId: string;
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
  onPrefetch?: (conversationId: string) => void;
  channels?: ChannelOption[];
  currentUserId?: string;
  agentNames?: Record<string, string>;
  labels?: { id: string; name: string }[];
  slaMinutes?: number;
}) {
  const { t } = useI18n();
  const [conversations, setConversations] = useState(initialConversations);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "all">("open");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [labelFilter, setLabelFilter] = useState("");
  const [convLabels, setConvLabels] = useState<Map<string, Set<string>>>(new Map());
  const [views, setViews] = useState<{ id: string; name: string; filters: Record<string, unknown> }[]>([]);
  const [historyHits, setHistoryHits] = useState<MessageSearchHit[] | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const isSelected = (id: string) => selected.has(id);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function deleteBulk() {
    if (bulkBusy || selected.size === 0) return;
    if (!window.confirm(t.inbox.confirmDelete)) return;
    setBulkBusy(true);
    const ids = [...selected];
    const res = await bulkDeleteConversations(ids);
    if (res.ok) {
      setConversations((prev) => prev.filter((c) => !selected.has(c.id)));
      exitSelectMode();
    }
    setBulkBusy(false);
  }

  async function applyBulkLabel(labelId: string) {
    if (bulkBusy || selected.size === 0 || !labelId) return;
    setBulkBusy(true);
    const res = await bulkAddLabel([...selected], labelId);
    if (res.ok) exitSelectMode();
    setBulkBusy(false);
  }

  async function runBulk(change: {
    status?: "open" | "closed";
    priority?: number;
    assignedTo?: string | null;
  }) {
    if (bulkBusy || selected.size === 0) return;
    setBulkBusy(true);
    const ids = [...selected];
    const res = await bulkUpdateConversations(ids, change);
    if (res.ok) {
      // Reflect the change locally so the list updates without a full refresh.
      // assignedTo maps to the row's assigned_to column.
      const localPatch: Partial<Conversation> = {};
      if (change.status) localPatch.status = change.status;
      if (change.priority !== undefined) localPatch.priority = change.priority;
      if (change.assignedTo !== undefined) localPatch.assigned_to = change.assignedTo;
      setConversations((prev) =>
        prev.map((c) => (selected.has(c.id) ? { ...c, ...localPatch } : c))
      );
      exitSelectMode();
    }
    setBulkBusy(false);
  }

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

  // Load which labels are on each loaded conversation, for the label filter.
  useEffect(() => {
    if (labels.length === 0) return;
    const ids = conversations.map((c) => c.id);
    if (ids.length === 0) {
      setConvLabels(new Map());
      return;
    }
    let cancelled = false;
    createClient()
      .from("conversation_labels")
      .select("conversation_id, label_id")
      .in("conversation_id", ids)
      .then(({ data }) => {
        if (cancelled) return;
        const map = new Map<string, Set<string>>();
        for (const row of data ?? []) {
          const set = map.get(row.conversation_id) ?? new Set<string>();
          set.add(row.label_id);
          map.set(row.conversation_id, set);
        }
        setConvLabels(map);
      });
    return () => {
      cancelled = true;
    };
    // Refetch when the set of conversations changes size (new/removed threads).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length, labels.length]);

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
      if (unassignedOnly && c.assigned_to !== null) return false;
      if (priorityOnly && normalizePriority(c.priority) === 0) return false;
      if (labelFilter && !convLabels.get(c.id)?.has(labelFilter)) return false;
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

  // Keyboard navigation (j/k or arrows to move, / to focus search). Kept in
  // refs so the global listener binds once and always sees the latest list.
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    function move(delta: number) {
      const list = filteredRef.current;
      if (list.length === 0) return;
      const idx = list.findIndex((c) => c.id === selectedIdRef.current);
      const next = idx < 0 ? 0 : Math.min(Math.max(idx + delta, 0), list.length - 1);
      onSelect(list[next]);
    }
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSelect]);

  return (
    <div className="flex h-full flex-col border-e border-border bg-card">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <h2 className="text-base font-bold tracking-tight">{t.inbox.title}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
              selectMode
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {selectMode ? t.inbox.cancelSelect : t.inbox.select}
          </button>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {filtered.length}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            placeholder={t.inbox.searchConversations}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runHistorySearch();
              if (e.key === "Escape") (e.target as HTMLInputElement).blur();
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
            onClick={() => setUnassignedOnly((u) => !u)}
            title={t.inbox.unassigned}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              unassignedOnly
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {t.inbox.unassigned}
          </button>
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

      {/* Label filter */}
      {labels.length > 0 && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Filter className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <select
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              className="w-full appearance-none rounded-lg border border-input bg-background py-2 ps-9 pe-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{t.inbox.allLabels}</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selectMode && (
        <div className="flex flex-wrap items-center gap-1.5 border-y border-border bg-muted/40 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            {selected.size} {t.inbox.selected}
          </span>
          <div className="ms-auto flex items-center gap-1">
            {labels.length > 0 && (
              <select
                value=""
                disabled={bulkBusy || selected.size === 0}
                onChange={(e) => {
                  applyBulkLabel(e.target.value);
                  e.target.value = "";
                }}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium outline-none focus:border-primary disabled:opacity-50"
              >
                <option value="">{t.inbox.addLabel}</option>
                {labels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            )}
            {currentUserId && (
              <button
                onClick={() => runBulk({ assignedTo: currentUserId })}
                disabled={bulkBusy || selected.size === 0}
                title={t.inbox.assignToMe}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" /> {t.inbox.assignToMe}
              </button>
            )}
            <button
              onClick={() => runBulk({ status: "closed" })}
              disabled={bulkBusy || selected.size === 0}
              title={t.inbox.resolve}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle className="h-3.5 w-3.5" /> {t.inbox.resolve}
            </button>
            <button
              onClick={() => runBulk({ status: "open" })}
              disabled={bulkBusy || selected.size === 0}
              title={t.inbox.reopen}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> {t.inbox.reopen}
            </button>
            <button
              onClick={() => runBulk({ priority: 2 })}
              disabled={bulkBusy || selected.size === 0}
              title={t.inbox.priorityUrgent}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
            >
              <Flag className="h-3.5 w-3.5" /> {t.inbox.priorityUrgent}
            </button>
            <button
              onClick={deleteBulk}
              disabled={bulkBusy || selected.size === 0}
              title={t.inbox.delete}
              aria-label={t.inbox.delete}
              className="inline-flex items-center justify-center rounded-md border border-border p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
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
              onClick={() =>
                selectMode ? toggleSelected(conversation.id) : onSelect(conversation)
              }
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
              {selectMode && (
                <span
                  className={cn(
                    "mt-3 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border",
                    isSelected(conversation.id)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border"
                  )}
                >
                  {isSelected(conversation.id) && <Check className="h-3 w-3" />}
                </span>
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
                  {conversation.assigned_to && (
                    <span
                      title={agentNames[conversation.assigned_to] ?? "Assigned"}
                      className={cn(
                        "ms-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[9px] font-bold text-white shadow-sm",
                        avatarGradient(agentNames[conversation.assigned_to] ?? "?")
                      )}
                    >
                      {(agentNames[conversation.assigned_to] ?? "?").charAt(0).toUpperCase()}
                    </span>
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
