"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Paperclip, Bot, User, MessageSquare, MessageSquareText, CheckCircle, Clock, RotateCcw, Loader2, StickyNote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/platform-icon";
import { filterCannedResponses, isCannedShortcut, type CannedResponseItem } from "@/lib/canned";
import { LabelPicker } from "@/components/inbox/label-picker";
import type { Database, ConversationStatus } from "@/lib/types/database";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type Label = Database["public"]["Tables"]["labels"]["Row"];
type Note = Database["public"]["Tables"]["conversation_notes"]["Row"];
type Conversation = Database["public"]["Tables"]["conversations"]["Row"] & {
  contacts: Database["public"]["Tables"]["contacts"]["Row"] | null;
};

type TimelineItem =
  | { kind: "message"; at: string; message: Message }
  | { kind: "note"; at: string; note: Note };

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function NoteBubble({ note }: { note: Note }) {
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[85%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
          <StickyNote className="h-3 w-3" />
          Internal note · only your team can see this
        </div>
        <p className="whitespace-pre-wrap break-words">{note.body}</p>
        <p className="mt-1 text-[10px] text-amber-600/80 dark:text-amber-400/70">
          {formatMessageTime(note.created_at)}
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isInbound = message.direction === "inbound";
  const isBot = message.sent_by_flow_id !== null;

  return (
    <div
      className={cn(
        "flex gap-2",
        isInbound ? "justify-start" : "justify-end"
      )}
    >
      {isInbound && (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}

      <div className="max-w-[70%]">
        <div
          className={cn(
            "rounded-2xl px-4 py-2 text-sm",
            isInbound
              ? "rounded-tl-md bg-muted text-foreground"
              : "rounded-tr-md bg-primary text-primary-foreground"
          )}
        >
          {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
          {message.attachments && (
            <div className="mt-1">
              <Paperclip className="inline h-3 w-3" />
              <span className="ml-1 text-xs opacity-70">Attachment</span>
            </div>
          )}
        </div>
        <div
          className={cn(
            "mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground",
            isInbound ? "justify-start" : "justify-end"
          )}
        >
          {isBot && (
            <Bot className="h-3 w-3" />
          )}
          <span>{formatMessageTime(message.created_at)}</span>
          {!isInbound && message.status !== "sent" && (
            <span className="capitalize">
              {message.status === "delivered"
                ? "Delivered"
                : message.status === "failed"
                ? "Failed"
                : ""}
            </span>
          )}
        </div>
      </div>

      {!isInbound && !isBot && (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      {!isInbound && isBot && (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
    </div>
  );
}

export function MessageThread({
  conversation,
  messages: initialMessages,
  cannedResponses = [],
  workspaceId,
  labels = [],
}: {
  conversation: Conversation | null;
  messages: Message[];
  cannedResponses?: CannedResponseItem[];
  workspaceId?: string;
  labels?: Label[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [showCanned, setShowCanned] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [mode, setMode] = useState<"reply" | "note">("reply");

  const cannedMatches = filterCannedResponses(cannedResponses, input);

  function insertCanned(content: string) {
    setInput(content);
    setShowCanned(false);
    textareaRef.current?.focus();
  }

  // Load internal notes for the selected conversation. Notes live in their own
  // table (not messages), so they work for social and website threads alike.
  useEffect(() => {
    if (!conversation) {
      setNotes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await createClient()
        .from("conversation_notes")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });
      if (!cancelled) setNotes(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation?.id]);

  async function addNote() {
    const body = input.trim();
    if (!conversation || !body || sending) return;
    setInput("");
    setSending(true);

    const optimistic: Note = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversation.id,
      workspace_id: conversation.workspace_id,
      author_id: null,
      body,
      created_at: new Date().toISOString(),
    };
    setNotes((prev) => [...prev, optimistic]);

    const { data, error } = await createClient()
      .from("conversation_notes")
      .insert({
        conversation_id: conversation.id,
        workspace_id: conversation.workspace_id,
        body,
      })
      .select("*")
      .single();

    if (!error && data) {
      setNotes((prev) => prev.map((n) => (n.id === optimistic.id ? data : n)));
    }
    setSending(false);
  }

  // Merge messages + notes into one chronological timeline.
  const timeline: TimelineItem[] = [
    ...messages.map((m) => ({ kind: "message" as const, at: m.created_at, message: m })),
    ...notes.map((n) => ({ kind: "note" as const, at: n.created_at, note: n })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  function submit() {
    if (mode === "note") addNote();
    else handleSend();
  }
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateConversationStatus = useCallback(async (status: ConversationStatus) => {
    if (!conversation || statusUpdating) return;
    setStatusUpdating(status);
    try {
      const { error } = await createClient()
        .from("conversations")
        .update({ status })
        .eq("id", conversation.id);
      if (error) throw error;
      router.refresh();
    } catch {
      alert(`Failed to update conversation status`);
    } finally {
      setStatusUpdating(null);
    }
  }, [conversation, statusUpdating, router]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, []);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Listen for conversation updates (last_message_at changes when a new message arrives)
  // and re-fetch messages from Zernio API.
  useEffect(() => {
    if (!conversation) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`conversation-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversation.id}`,
        },
        async () => {
          try {
            const res = await fetch(
              `/api/v1/messages?conversationId=${conversation.id}`
            );
            if (res.ok) {
              const freshMessages = await res.json();
              setMessages((prev) => {
                const optimistic = prev.filter((m) => m.id.startsWith("optimistic-"));
                return [...freshMessages, ...optimistic];
              });
            }
          } catch (err) {
            console.error("Failed to refresh messages:", err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id]);

  async function handleSend() {
    if (!input.trim() || !conversation || sending) return;

    const text = input.trim();
    setInput("");
    setSending(true);

    // Optimistic update: add a temporary message immediately
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      conversation_id: conversation.id,
      direction: "outbound",
      text,
      attachments: null,
      quick_reply_payload: null,
      postback_payload: null,
      callback_data: null,
      platform_message_id: null,
      sent_by_flow_id: null,
      sent_by_node_id: null,
      sent_by_user_id: null,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const res = await fetch("/api/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversation.id, text }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Send failed (${res.status})`);
      }

      const confirmedMessage: Message = await res.json();

      // Replace optimistic message with confirmed one
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? confirmedMessage : m))
      );
    } catch (err) {
      console.error("Failed to send message:", err);
      // Mark optimistic message as failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticId ? { ...m, status: "failed" as const } : m
        )
      );
    } finally {
      setSending(false);
    }
  }

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
        <h3 className="mt-4 text-sm font-medium text-muted-foreground">
          Select a conversation
        </h3>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Choose a conversation from the list to view messages
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            {conversation.contacts?.avatar_url ? (
              <img
                src={conversation.contacts.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                {conversation.contacts?.display_name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-background">
              <PlatformIcon
                platform={conversation.platform}
                className="h-2.5 w-2.5"
                size={10}
              />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">
              {conversation.contacts?.display_name ?? "Unknown"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
              conversation.status === "open"
                ? "bg-green-100 text-green-700"
                : conversation.status === "snoozed"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-muted text-muted-foreground"
            )}
          >
            {conversation.status}
          </span>
          {conversation.is_automation_paused && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
              Bot paused
            </span>
          )}
          <div className="flex items-center gap-1">
            {conversation.status !== "closed" && (
              <button
                onClick={() => updateConversationStatus("closed")}
                disabled={!!statusUpdating}
                title="Close conversation"
                aria-label="Close conversation"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
              >
                {statusUpdating === "closed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              </button>
            )}
            {conversation.status !== "snoozed" && (
              <button
                onClick={() => updateConversationStatus("snoozed")}
                disabled={!!statusUpdating}
                title="Snooze conversation"
                aria-label="Snooze conversation"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
              >
                {statusUpdating === "snoozed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
              </button>
            )}
            {conversation.status !== "open" && (
              <button
                onClick={() => updateConversationStatus("open")}
                disabled={!!statusUpdating}
                title="Reopen conversation"
                aria-label="Reopen conversation"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
              >
                {statusUpdating === "open" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Labels */}
      {workspaceId && (
        <div className="border-b border-border px-4 py-2">
          <LabelPicker
            key={conversation.id}
            conversationId={conversation.id}
            workspaceId={workspaceId}
            allLabels={labels}
          />
        </div>
      )}

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {timeline.map((item, i) => {
            const prev = timeline[i - 1];
            const showSep =
              !prev ||
              new Date(item.at).toDateString() !== new Date(prev.at).toDateString();
            const key = item.kind === "message" ? item.message.id : `note-${item.note.id}`;
            return (
              <div key={key}>
                {showSep && (
                  <div className="my-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateSeparator(item.at)}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                {item.kind === "message" ? (
                  <MessageBubble message={item.message} />
                ) : (
                  <NoteBubble note={item.note} />
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div
        className={cn(
          "border-t border-border p-4",
          mode === "note" && "bg-amber-50/60 dark:bg-amber-950/20"
        )}
      >
        {/* Reply / Note toggle */}
        <div className="mx-auto mb-2 flex max-w-2xl gap-1">
          <button
            type="button"
            onClick={() => setMode("reply")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors",
              mode === "reply" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Reply
          </button>
          <button
            type="button"
            onClick={() => setMode("note")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors",
              mode === "note"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <StickyNote className="h-3.5 w-3.5" />
            Note
          </button>
        </div>

        <div className="relative mx-auto flex max-w-2xl items-end gap-2">
          {/* Saved-replies picker (reply mode only) */}
          {mode === "reply" && showCanned && cannedMatches.length > 0 && (
            <div className="absolute inset-x-0 bottom-full mb-2 max-h-64 overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
              {cannedMatches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => insertCanned(c.content)}
                  className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-start hover:bg-accent"
                >
                  <span className="font-mono text-xs text-primary">/{c.short_code}</span>
                  <span className="line-clamp-2 text-sm text-muted-foreground">{c.content}</span>
                </button>
              ))}
            </div>
          )}

          {mode === "reply" && cannedResponses.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCanned((s) => !s)}
              aria-label="Saved replies"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <MessageSquareText className="h-4 w-4" />
            </button>
          )}

          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                const value = e.target.value;
                setInput(value);
                autoResize();
                setShowCanned(
                  mode === "reply" && cannedResponses.length > 0 && isCannedShortcut(value)
                );
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowCanned(false);
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={
                mode === "note"
                  ? "Add an internal note (only your team sees this)…"
                  : "Type a message…  (use / for saved replies)"
              }
              rows={1}
              className={cn(
                "w-full resize-none rounded-lg border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2",
                mode === "note"
                  ? "border-amber-300 focus:ring-amber-300 dark:border-amber-800"
                  : "border-input focus:ring-ring"
              )}
              style={{ maxHeight: 150 }}
            />
          </div>
          <button
            onClick={submit}
            disabled={!input.trim() || sending}
            aria-label={mode === "note" ? "Save note" : "Send message"}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              !input.trim() || sending
                ? "bg-muted text-muted-foreground"
                : mode === "note"
                ? "bg-amber-500 text-white hover:opacity-90"
                : "bg-primary text-primary-foreground hover:opacity-90"
            )}
          >
            {mode === "note" ? <StickyNote className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
