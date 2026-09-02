"use client";

import { useI18n } from "@/components/i18n-provider";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, RefreshCw, User, X } from "lucide-react";
import { ConversationList } from "@/components/inbox/conversation-list";
import { MessageThread } from "@/components/inbox/message-thread";
import { ContactPanel } from "@/components/inbox/contact-panel";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/types/database";

type Conversation = Database["public"]["Tables"]["conversations"]["Row"] & {
  contacts: Database["public"]["Tables"]["contacts"]["Row"] | null;
};
type Message = Database["public"]["Tables"]["messages"]["Row"];
type Label = Database["public"]["Tables"]["labels"]["Row"];
type CannedResponse = { id: string; short_code: string; content: string };
type ChannelOption = {
  id: string;
  platform: Database["public"]["Tables"]["channels"]["Row"]["platform"];
  display_name: string | null;
  username: string | null;
};

export function InboxView({
  conversations,
  workspaceId,
  currentUserId,
  currentUserName,
  agentNames = {},
  cannedResponses,
  labels,
  channels,
  slaMinutes,
}: {
  conversations: Conversation[];
  workspaceId: string;
  currentUserId: string;
  currentUserName: string;
  agentNames?: Record<string, string>;
  cannedResponses: CannedResponse[];
  labels: Label[];
  channels: ChannelOption[];
  slaMinutes: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showContactPanel, setShowContactPanel] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Global "?" opens the keyboard shortcuts cheat sheet; Escape closes it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable);
      if (e.key === "?" && !typing) {
        e.preventDefault();
        setShowShortcuts(true);
      } else if (e.key === "Escape") {
        setShowShortcuts(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Imports conversations that already exist in Zernio (e.g. from before the
  // webhook was registered), then refreshes the server-rendered list.
  async function handleSyncConversations() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/v1/channels/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        setSyncError(data.error || "Sync failed");
        return;
      }
      router.refresh();
    } catch {
      setSyncError("Failed to sync. Check your connection.");
    } finally {
      setSyncing(false);
    }
  }

  // Per-conversation message cache + in-flight dedup, so re-opening a thread is
  // instant and hovering a row can warm it up before the click.
  const messagesCache = useRef<Map<string, Message[]>>(new Map());
  const inflight = useRef<Map<string, Promise<Message[]>>>(new Map());

  const fetchMessages = useCallback(async (id: string): Promise<Message[]> => {
    const existing = inflight.current.get(id);
    if (existing) return existing;

    const p = (async () => {
      try {
        const res = await fetch(`/api/v1/messages?conversationId=${id}`);
        const msgs: Message[] = res.ok ? ((await res.json()) ?? []) : [];
        messagesCache.current.set(id, msgs);
        return msgs;
      } catch {
        return messagesCache.current.get(id) ?? [];
      } finally {
        inflight.current.delete(id);
      }
    })();

    inflight.current.set(id, p);
    return p;
  }, []);

  // Warm the cache for a conversation without touching the UI (hover / preload).
  const prefetch = useCallback(
    (id: string) => {
      if (messagesCache.current.has(id) || inflight.current.has(id)) return;
      void fetchMessages(id);
    },
    [fetchMessages]
  );

  const handleSelect = useCallback((c: Conversation) => {
    setSelected(c);
  }, []);

  // Load messages when a conversation is selected — show the cached copy
  // immediately (no spinner) and revalidate in the background.
  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    const id = selected.id;
    let cancelled = false;

    const cached = messagesCache.current.get(id);
    if (cached) {
      setMessages(cached);
      setLoadingMessages(false);
    } else {
      setLoadingMessages(true);
    }

    fetchMessages(id).then((msgs) => {
      if (cancelled) return;
      setMessages(msgs);
      setLoadingMessages(false);
    });

    // Mark as read
    if (selected.unread_count > 0) {
      createClient()
        .from("conversations")
        .update({ unread_count: 0 })
        .eq("id", id)
        .then(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [selected?.id, fetchMessages]);

  // Preload the top conversation so the first open is instant.
  useEffect(() => {
    if (conversations.length > 0) prefetch(conversations[0].id);
  }, [conversations, prefetch]);

  return (
    <div className="flex h-full">
      {/* Left panel: Conversation list */}
      <div className="w-80 flex-shrink-0">
        <ConversationList
          conversations={conversations}
          workspaceId={workspaceId}
          selectedId={selected?.id ?? null}
          onSelect={handleSelect}
          onPrefetch={prefetch}
          channels={channels}
          currentUserId={currentUserId}
          slaMinutes={slaMinutes}
        />
      </div>

      {/* Center panel: Message thread */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Toggle contact panel button */}
        {selected && !showContactPanel && (
          <div className="flex shrink-0 justify-end border-b border-border px-2 py-1">
            <button
              onClick={() => setShowContactPanel(true)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label={t.inbox.contactInfo}
            >
              <User className="h-3.5 w-3.5" />
              {t.inbox.contactInfo}
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1">
          {conversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                {t.inbox.noConversations}
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
                {t.inbox.syncHint}
              </p>
              <button
                onClick={handleSyncConversations}
                disabled={syncing}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
                {syncing ? t.inbox.syncing : t.inbox.syncConversations}
              </button>
              {syncError && (
                <p className="mt-2 text-xs text-destructive">{syncError}</p>
              )}
            </div>
          ) : loadingMessages && selected ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          ) : (
            <MessageThread
              conversation={selected}
              messages={messages}
              cannedResponses={cannedResponses}
              workspaceId={workspaceId}
              labels={labels}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              agentNames={agentNames}
            />
          )}
        </div>
      </div>

      {/* Right panel: Contact info */}
      {showContactPanel && selected?.contact_id && (
        <ContactPanel
          contactId={selected.contact_id}
          workspaceId={workspaceId}
          onClose={() => setShowContactPanel(false)}
        />
      )}

      {/* Keyboard shortcuts help overlay (press ?) */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t.inbox.shortcutsTitle}</h2>
              <button
                onClick={() => setShowShortcuts(false)}
                aria-label={t.inbox.close}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2 text-sm">
              {[
                { keys: ["J", "K"], label: t.inbox.shortcutNav },
                { keys: ["/"], label: t.inbox.shortcutSearch },
                { keys: ["E"], label: t.inbox.shortcutResolve },
                { keys: ["R"], label: t.inbox.shortcutReply },
                { keys: ["?"], label: t.inbox.shortcutHelp },
              ].map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="flex flex-shrink-0 gap-1">
                    {row.keys.map((k) => (
                      <kbd
                        key={k}
                        className="min-w-6 rounded border border-border bg-muted px-1.5 py-0.5 text-center text-xs font-semibold"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
