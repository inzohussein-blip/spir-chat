"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Paperclip, Bot, User, MessageSquare, MessageSquareText, CheckCircle, Clock, RotateCcw, Loader2, StickyNote, UserPlus, UserCheck, PenLine, Smile, MousePointerClick, Zap, Sparkles, Download, Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resolveConversation } from "@/lib/actions/csat";
import { runMacro } from "@/lib/actions/macros";
import { snoozeConversation, scheduleMessage, setConversationPriority } from "@/lib/actions/conversations";
import { normalizePriority, type PriorityLevel } from "@/lib/priority";
import { assistReply } from "@/lib/actions/ai-compose";
import { notifyMentions } from "@/lib/actions/notes";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/platform-icon";
import { filterCannedResponses, isCannedShortcut, type CannedResponseItem } from "@/lib/canned";
import { LabelPicker } from "@/components/inbox/label-picker";
import { parseAttachments, isImageType, type MessageAttachment } from "@/lib/attachments";
import { parseRichContent, type RichButton } from "@/lib/rich-content";
import { avatarGradient } from "@/lib/avatar";
import { buildTranscript, transcriptFilename } from "@/lib/transcript";
import { useI18n } from "@/components/i18n-provider";
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

const EMOJIS = [
  "😀", "😂", "😍", "😊", "👍", "🙏", "🎉", "❤️",
  "🔥", "👋", "✅", "🤔", "😅", "🙌", "💯", "😢",
];


function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(
  dateStr: string,
  labels: { today: string; yesterday: string }
): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return labels.today;
  if (diffDays === 1) return labels.yesterday;
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function NoteBubble({ note }: { note: Note }) {
  const { t } = useI18n();
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[85%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
          <StickyNote className="h-3 w-3" />
          {t.inbox.internalNoteLabel}
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
  const { t } = useI18n();
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
          {parseAttachments(message.attachments).map((a, i) =>
            isImageType(a.type) ? (
              <a
                key={i}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("block", message.text && "mt-2")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.url}
                  alt={a.name}
                  className="max-h-56 max-w-full rounded-lg object-cover"
                />
              </a>
            ) : (
              <a
                key={i}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs underline-offset-2 hover:underline",
                  message.text && "mt-2",
                  isInbound ? "bg-background/60" : "bg-white/15"
                )}
              >
                <Paperclip className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{a.name}</span>
              </a>
            )
          )}
          {(() => {
            const rich = parseRichContent(message.rich_content);
            if (!rich) return null;
            if (rich.type === "buttons") {
              return (
                <div className={cn("flex flex-col gap-1.5", message.text && "mt-2")}>
                  {rich.buttons.map((b, i) => (
                    <a
                      key={i}
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-white/15 px-3 py-1.5 text-center text-xs font-medium hover:bg-white/25"
                    >
                      {b.label}
                    </a>
                  ))}
                </div>
              );
            }
            return (
              <div className={cn("flex gap-2 overflow-x-auto pb-1", message.text && "mt-2")}>
                {rich.cards.map((c, i) => (
                  <div
                    key={i}
                    className="w-40 flex-shrink-0 overflow-hidden rounded-lg border border-white/20 bg-white/10"
                  >
                    {c.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt={c.title} className="h-20 w-full object-cover" />
                    )}
                    <div className="p-2">
                      <p className="text-xs font-semibold">{c.title}</p>
                      {c.subtitle && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] opacity-80">{c.subtitle}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
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
                ? t.inbox.delivered
                : message.status === "failed"
                ? t.inbox.failed
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
  currentUserId,
  currentUserName,
}: {
  conversation: Conversation | null;
  messages: Message[];
  cannedResponses?: CannedResponseItem[];
  workspaceId?: string;
  labels?: Label[];
  currentUserId?: string;
  currentUserName?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [showCanned, setShowCanned] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [showUndo, setShowUndo] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visitorTyping, setVisitorTyping] = useState(false);
  const typingClear = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMsgAt = useRef<string | null>(null);
  const [signing, setSigning] = useState(false);
  useEffect(() => {
    try {
      setSigning(localStorage.getItem("spirchat_sign") === "1");
    } catch {
      // ignore
    }
  }, []);
  function toggleSigning() {
    setSigning((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("spirchat_sign", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }
  const [assignedTo, setAssignedTo] = useState<string | null>(
    conversation?.assigned_to ?? null
  );

  // Attachments (website conversations only): staged files the agent has
  // uploaded and will send with the next reply.
  const isWebsite = conversation?.platform === "website";
  const [pendingAttachments, setPendingAttachments] = useState<
    MessageAttachment[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Link buttons the agent can attach to a website reply (feature 12).
  const [pendingButtons, setPendingButtons] = useState<RichButton[]>([]);
  const [showButtonBuilder, setShowButtonBuilder] = useState(false);
  const [btnLabel, setBtnLabel] = useState("");
  const [btnUrl, setBtnUrl] = useState("");

  function addButton() {
    const label = btnLabel.trim();
    const url = btnUrl.trim();
    if (!label || !/^https?:\/\/.+/.test(url) || pendingButtons.length >= 3) return;
    setPendingButtons((prev) => [...prev, { label, url }]);
    setBtnLabel("");
    setBtnUrl("");
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file || !conversation) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("conversationId", conversation.id);
      const res = await fetch("/api/v1/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.attachment) {
        setPendingAttachments((prev) => [...prev, data.attachment]);
      }
    } catch {
      // surfaced by the empty staging area; agent can retry
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    setAssignedTo(conversation?.assigned_to ?? null);
  }, [conversation?.id, conversation?.assigned_to]);

  async function toggleAssign() {
    if (!conversation || !currentUserId) return;
    const next = assignedTo === currentUserId ? null : currentUserId;
    setAssignedTo(next);
    await createClient()
      .from("conversations")
      .update({ assigned_to: next })
      .eq("id", conversation.id);
  }

  const cannedMatches = filterCannedResponses(cannedResponses, input);

  function insertCanned(content: string) {
    setInput(content);
    setShowCanned(false);
    textareaRef.current?.focus();
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart ?? input.length;
      const end = el.selectionEnd ?? input.length;
      setInput(input.slice(0, start) + emoji + input.slice(end));
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      setInput((v) => v + emoji);
    }
    setShowEmoji(false);
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
      // Notify any @mentioned teammates (fire-and-forget).
      if (body.includes("@")) void notifyMentions(conversation.id, body);
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

  async function runAssist(mode: string) {
    if (!input.trim() || aiBusy) return;
    setAiBusy(true);
    const res = await assistReply(mode, input);
    setAiBusy(false);
    setAiMenuOpen(false);
    if (res.error) {
      alert(res.error);
      return;
    }
    if (res.text) {
      setInput(res.text);
      requestAnimationFrame(autoResize);
    }
  }

  async function handleScheduleSend() {
    if (!conversation || !input.trim() || !scheduleAt) return;
    const res = await scheduleMessage(
      conversation.id,
      input,
      new Date(scheduleAt).toISOString()
    );
    if (res.error) {
      alert(res.error);
      return;
    }
    setInput("");
    setScheduleAt("");
    setShowSchedule(false);
  }

  async function resolve() {
    if (!conversation || statusUpdating) return;
    setStatusUpdating("closed");
    setShowUndo(true);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setShowUndo(false), 6000);
    try {
      // Closes the conversation and sends a CSAT survey when the workspace
      // has it enabled.
      await resolveConversation(conversation.id);
      router.refresh();
    } finally {
      setStatusUpdating(null);
    }
  }

  function undoResolve() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setShowUndo(false);
    updateConversationStatus("open");
  }

  function downloadTranscript() {
    if (!conversation) return;
    const name = conversation.contacts?.display_name ?? t.inbox.unknown;
    const md = buildTranscript(
      {
        contactName: name,
        platform: conversation.platform ?? undefined,
        status: conversation.status ?? undefined,
      },
      messages.map((m) => ({
        direction: m.direction === "inbound" ? "inbound" : "outbound",
        text: m.text,
        created_at: m.created_at,
      })),
      notes.map((n) => ({ body: n.body, created_at: n.created_at }))
    );
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = transcriptFilename(name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
      alert(t.inbox.updateStatusFailed);
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
    const convId = conversation.id;
    lastMsgAt.current = conversation.last_message_at;
    setVisitorTyping(false);

    const supabase = createClient();
    const channel = supabase
      .channel(`conversation-${convId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${convId}`,
        },
        async (payload) => {
          const conv = payload.new as
            | Database["public"]["Tables"]["conversations"]["Row"]
            | undefined;

          // Live "visitor is typing…" — show for a few seconds after each ping.
          if (conv?.visitor_typing_at) {
            setVisitorTyping(true);
            if (typingClear.current) clearTimeout(typingClear.current);
            typingClear.current = setTimeout(() => setVisitorTyping(false), 4000);
          }

          // Only refetch the thread when a new message actually arrived — not on
          // presence/typing heartbeats, which also update the conversation row.
          if (conv?.last_message_at && conv.last_message_at === lastMsgAt.current) {
            return;
          }
          if (conv?.last_message_at) lastMsgAt.current = conv.last_message_at;
          try {
            const res = await fetch(`/api/v1/messages?conversationId=${convId}`);
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
  }, [conversation?.id, conversation?.last_message_at]);

  async function handleSend() {
    if (!conversation || sending) return;
    const hasText = input.trim().length > 0;
    const attachments = pendingAttachments;
    const buttons = pendingButtons;
    const richContent =
      buttons.length > 0 ? { type: "buttons" as const, buttons } : null;
    if (!hasText && attachments.length === 0 && !richContent) return;

    const text = hasText
      ? signing && currentUserName
        ? `${input.trim()}\n\n— ${currentUserName}`
        : input.trim()
      : "";
    setInput("");
    setPendingAttachments([]);
    setPendingButtons([]);
    setShowButtonBuilder(false);
    setSending(true);

    // Optimistic update: add a temporary message immediately
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      conversation_id: conversation.id,
      direction: "outbound",
      text: text || null,
      attachments: attachments.length > 0 ? attachments : null,
      rich_content: richContent as never,
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
        body: JSON.stringify({
          conversationId: conversation.id,
          text,
          attachments: attachments.length > 0 ? attachments : undefined,
          rich_content: richContent ?? undefined,
        }),
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
          {t.inbox.selectConversation}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground/70">
          {t.inbox.selectConversationHint}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            {conversation.contacts?.avatar_url ? (
              <img
                src={conversation.contacts.avatar_url}
                alt=""
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white shadow-sm",
                  avatarGradient(conversation.contacts?.display_name ?? "Unknown")
                )}
              >
                {conversation.contacts?.display_name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div className="absolute -bottom-0.5 -end-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-card bg-card">
              <PlatformIcon
                platform={conversation.platform}
                className="h-2.5 w-2.5"
                size={10}
              />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">
              {conversation.contacts?.display_name ?? t.inbox.unknown}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentUserId && (
            <button
              onClick={toggleAssign}
              title={
                assignedTo === currentUserId
                  ? t.inbox.assignedToYou
                  : assignedTo
                  ? t.inbox.assignedTeammate
                  : t.inbox.assignToMe
              }
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                assignedTo === currentUserId
                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {assignedTo === currentUserId ? (
                <>
                  <UserCheck className="h-3.5 w-3.5" /> {t.inbox.you}
                </>
              ) : assignedTo ? (
                <>
                  <User className="h-3.5 w-3.5" /> {t.inbox.assigned}
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" /> {t.inbox.assignToMe}
                </>
              )}
            </button>
          )}
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
            {conversation.status === "closed"
              ? t.inbox.statusResolved
              : conversation.status === "snoozed"
              ? t.inbox.statusSnoozed
              : t.inbox.statusOpen}
          </span>
          {conversation.is_automation_paused && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
              {t.inbox.botPaused}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <PriorityMenu
              conversationId={conversation.id}
              current={normalizePriority(conversation.priority)}
              onDone={() => router.refresh()}
            />
            <button
              onClick={downloadTranscript}
              title={t.inbox.exportTranscript}
              aria-label={t.inbox.exportTranscript}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <MacroRunner conversationId={conversation.id} onRan={() => router.refresh()} />
            {conversation.status !== "closed" ? (
              <>
                {conversation.status !== "snoozed" && (
                  <SnoozeMenu
                    conversationId={conversation.id}
                    label={t.inbox.snooze}
                    onDone={() => router.refresh()}
                  />
                )}
                <button
                  onClick={resolve}
                  disabled={!!statusUpdating}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {statusUpdating === "closed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                  {t.inbox.resolve}
                </button>
              </>
            ) : (
              <button
                onClick={() => updateConversationStatus("open")}
                disabled={!!statusUpdating}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                {statusUpdating === "open" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                {t.inbox.reopen}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Resolve undo banner */}
      {showUndo && (
        <div className="flex items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" />
            {t.inbox.conversationResolved}
          </span>
          <button
            onClick={undoResolve}
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80"
          >
            <RotateCcw className="h-3 w-3" />
            {t.inbox.undo}
          </button>
        </div>
      )}

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
                      {formatDateSeparator(item.at, { today: t.inbox.today, yesterday: t.inbox.yesterday })}
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

      {/* Visitor typing indicator */}
      {visitorTyping && (
        <div className="flex items-center gap-1.5 px-4 pb-1 text-xs text-muted-foreground">
          <span className="flex gap-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
          </span>
          typing…
        </div>
      )}

      {/* Composer */}
      <div
        className={cn(
          "border-t border-border p-4",
          mode === "note" ? "bg-amber-50/60 dark:bg-amber-950/20" : "bg-card"
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
            {t.inbox.reply}
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
            {t.inbox.note}
          </button>
          {mode === "reply" && isWebsite && (
            <button
              type="button"
              onClick={() => setShowButtonBuilder((s) => !s)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                showButtonBuilder || pendingButtons.length > 0
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MousePointerClick className="h-3.5 w-3.5" />
              {t.inbox.buttonsLabel}{pendingButtons.length > 0 ? ` (${pendingButtons.length})` : ""}
            </button>
          )}
          {mode === "reply" && (
            <button
              type="button"
              onClick={() => setShowSchedule((s) => !s)}
              title="Schedule this message"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                showSchedule ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              Schedule
            </button>
          )}
          {mode === "reply" && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAiMenuOpen((o) => !o)}
                disabled={aiBusy || !input.trim()}
                title="AI writing assistant"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                  aiMenuOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                AI
              </button>
              {aiMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAiMenuOpen(false)} />
                  <div className="absolute bottom-full z-20 mb-1 w-44 rounded-lg border border-border bg-popover p-1 shadow-lg">
                    {[
                      { mode: "improve", label: "Improve writing" },
                      { mode: "shorten", label: "Make shorter" },
                      { mode: "friendly", label: "Friendlier tone" },
                      { mode: "translate_ar", label: "Translate → Arabic" },
                      { mode: "translate_en", label: "Translate → English" },
                    ].map((o) => (
                      <button
                        key={o.mode}
                        type="button"
                        onClick={() => runAssist(o.mode)}
                        className="block w-full rounded-md px-3 py-1.5 text-start text-sm hover:bg-accent"
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {mode === "reply" && currentUserName && (
            <button
              type="button"
              onClick={toggleSigning}
              title={signing ? `${t.inbox.signingAs} ${currentUserName}` : t.inbox.signTitle}
              className={cn(
                "ms-auto inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                signing
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <PenLine className="h-3.5 w-3.5" />
              {t.inbox.sign}
            </button>
          )}
        </div>

        {/* Button builder (website reply mode) */}
        {mode === "reply" && isWebsite && showButtonBuilder && (
          <div className="mx-auto mb-2 max-w-2xl rounded-lg border border-border bg-muted/40 p-3">
            {pendingButtons.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {pendingButtons.map((b, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs"
                  >
                    {b.label}
                    <button
                      type="button"
                      aria-label={t.inbox.removeButton}
                      onClick={() =>
                        setPendingButtons((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {pendingButtons.length < 3 && (
              <div className="flex items-center gap-2">
                <input
                  value={btnLabel}
                  onChange={(e) => setBtnLabel(e.target.value)}
                  placeholder={t.inbox.buttonLabelPlaceholder}
                  className="w-32 rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  value={btnUrl}
                  onChange={(e) => setBtnUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addButton())}
                  placeholder="https://…"
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={addButton}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  {t.inbox.add}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Staged attachments (website reply mode) */}
        {mode === "reply" && isWebsite && pendingAttachments.length > 0 && (
          <div className="mx-auto mb-2 flex max-w-2xl flex-wrap gap-2">
            {pendingAttachments.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2 py-1 text-xs"
              >
                {isImageType(a.type) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.name} className="h-6 w-6 rounded object-cover" />
                ) : (
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="max-w-[140px] truncate">{a.name}</span>
                <button
                  type="button"
                  aria-label={t.inbox.removeAttachment}
                  onClick={() =>
                    setPendingAttachments((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,.doc,.docx"
          onChange={handleFilePick}
        />

        {showSchedule && mode === "reply" && (
          <div className="mx-auto mb-2 flex max-w-2xl flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Send at
            </span>
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleScheduleSend}
              disabled={!input.trim() || !scheduleAt}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Schedule send
            </button>
          </div>
        )}

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
              aria-label={t.inbox.savedRepliesAria}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <MessageSquareText className="h-4 w-4" />
            </button>
          )}

          {mode === "reply" && isWebsite && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label={t.inbox.attachFileAria}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </button>
          )}

          <div className="relative shrink-0">
            {showEmoji && (
              <div className="absolute bottom-full mb-2 grid grid-cols-8 gap-1 rounded-lg border border-border bg-popover p-2 shadow-lg">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => insertEmoji(e)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-accent"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowEmoji((s) => !s)}
              aria-label={t.inbox.emojiAria}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg border border-input transition-colors hover:bg-accent hover:text-foreground",
                showEmoji ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Smile className="h-4 w-4" />
            </button>
          </div>

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
              placeholder={mode === "note" ? t.inbox.notePlaceholder : t.inbox.replyPlaceholder}
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
            disabled={
              sending ||
              (!input.trim() &&
                !(
                  mode === "reply" &&
                  (pendingAttachments.length > 0 || pendingButtons.length > 0)
                ))
            }
            aria-label={mode === "note" ? t.inbox.saveNoteAria : t.inbox.sendMessageAria}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              sending ||
                (!input.trim() &&
                  !(mode === "reply" && pendingAttachments.length > 0))
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

interface MacroSummary {
  id: string;
  name: string;
  actions: unknown;
}

function MacroRunner({
  conversationId,
  onRan,
}: {
  conversationId: string;
  onRan: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [macros, setMacros] = useState<MacroSummary[] | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && macros === null) {
      const { data } = await createClient()
        .from("macros")
        .select("id, name, actions")
        .order("name", { ascending: true });
      setMacros(data ?? []);
    }
  }

  async function run(id: string) {
    setRunning(id);
    try {
      await runMacro(id, conversationId);
      onRan();
    } finally {
      setRunning(null);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        title={t.inbox.runMacro}
        aria-label={t.inbox.runMacro}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
      >
        <Zap className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute end-0 z-20 mt-1 w-56 rounded-lg border border-border bg-popover p-1 shadow-lg">
            {macros === null ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">{t.inbox.loading}</div>
            ) : macros.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {t.inbox.noMacros}
              </div>
            ) : (
              macros.map((m) => (
                <button
                  key={m.id}
                  onClick={() => run(m.id)}
                  disabled={!!running}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-start text-sm hover:bg-accent disabled:opacity-50"
                >
                  {running === m.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span className="truncate">{m.name}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PriorityMenu({
  conversationId,
  current,
  onDone,
}: {
  conversationId: string;
  current: PriorityLevel;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const options: { level: PriorityLevel; label: string; dot: string }[] = [
    { level: 2, label: t.inbox.priorityUrgent, dot: "bg-red-500" },
    { level: 1, label: t.inbox.priorityHigh, dot: "bg-amber-500" },
    { level: 0, label: t.inbox.priorityNormal, dot: "bg-muted-foreground/40" },
  ];

  async function set(level: PriorityLevel) {
    if (busy) return;
    setBusy(true);
    try {
      await setConversationPriority(conversationId, level);
      onDone();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  const active = current > 0;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        title={t.inbox.setPriority}
        aria-label={t.inbox.setPriority}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50",
          current === 2
            ? "text-red-600"
            : current === 1
            ? "text-amber-600"
            : "text-muted-foreground"
        )}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Flag className={cn("h-3.5 w-3.5", active && "fill-current")} />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute end-0 z-20 mt-1 w-40 rounded-lg border border-border bg-popover p-1 shadow-lg">
            {options.map((o) => (
              <button
                key={o.level}
                onClick={() => set(o.level)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-start text-sm hover:bg-accent",
                  o.level === current && "font-semibold"
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", o.dot)} />
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SnoozeMenu({
  conversationId,
  label,
  onDone,
}: {
  conversationId: string;
  label: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");

  async function snooze(iso: string) {
    if (busy) return;
    setBusy(true);
    try {
      await snoozeConversation(conversationId, iso);
      onDone();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  function inHours(h: number): string {
    return new Date(Date.now() + h * 3600000).toISOString();
  }
  function tomorrowMorning(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }
  function nextWeek(): string {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }

  const options: { label: string; iso: () => string }[] = [
    { label: "In 1 hour", iso: () => inHours(1) },
    { label: "In 3 hours", iso: () => inHours(3) },
    { label: "Tomorrow morning", iso: tomorrowMorning },
    { label: "Next week", iso: nextWeek },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        title={label}
        aria-label={label}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute end-0 z-20 mt-1 w-52 rounded-lg border border-border bg-popover p-1 shadow-lg">
            {options.map((o) => (
              <button
                key={o.label}
                onClick={() => snooze(o.iso())}
                className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-start text-sm hover:bg-accent"
              >
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {o.label}
              </button>
            ))}
            <div className="border-t border-border p-2">
              <input
                type="datetime-local"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
              />
              <button
                onClick={() => custom && snooze(new Date(custom).toISOString())}
                disabled={!custom}
                className="mt-1.5 w-full rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                Snooze until…
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
