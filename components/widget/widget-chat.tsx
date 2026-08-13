"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Paperclip, Loader2, X } from "lucide-react";

interface WidgetAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

interface WidgetMessage {
  id: string;
  direction: "inbound" | "outbound";
  text: string | null;
  attachments?: WidgetAttachment[];
  created_at: string;
}

function isImage(type: string): boolean {
  return typeof type === "string" && type.startsWith("image/");
}

const POLL_MS = 3000;

// Short HH:MM stamp in the visitor's locale, shown under each bubble.
function formatTime(iso: string, lang: "en" | "ar"): string {
  try {
    return new Date(iso).toLocaleTimeString(lang === "ar" ? "ar" : "en", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// Self-contained strings: the widget is embedded cross-origin, so its language
// comes from the ?lang param (set by the loader from the visitor's site), not
// the app's locale cookie.
const WIDGET_STRINGS = {
  en: {
    subtitle: "We typically reply shortly",
    empty: "Send us a message and we'll get back to you.",
    unavailable: "Chat is unavailable right now.",
    placeholder: "Type a message…",
    prechatTitle: "Before we start",
    name: "Your name",
    email: "Email (optional)",
    start: "Start chat",
    attach: "Attach a file",
    away: "We're away right now — leave a message.",
  },
  ar: {
    subtitle: "نردّ عادةً خلال وقت قصير",
    empty: "أرسل لنا رسالة وسنعاود التواصل معك.",
    unavailable: "المحادثة غير متاحة حالياً.",
    placeholder: "اكتب رسالة…",
    prechatTitle: "قبل أن نبدأ",
    name: "اسمك",
    email: "البريد الإلكتروني (اختياري)",
    start: "ابدأ المحادثة",
    attach: "إرفاق ملف",
    away: "نحن غير متواجدين حالياً — اترك رسالة وسنعاود التواصل.",
  },
} as const;

type Phase = "loading" | "prechat" | "chat";

export function WidgetChat({
  channelId,
  lang = "en",
}: {
  channelId: string;
  lang?: "en" | "ar";
}) {
  const s = WIDGET_STRINGS[lang] ?? WIDGET_STRINGS.en;
  const dir = lang === "ar" ? "rtl" : "ltr";

  const [phase, setPhase] = useState<Phase>("loading");
  const [greeting, setGreeting] = useState<string | null>(null);
  const [starters, setStarters] = useState<string[]>([]);
  const [away, setAway] = useState(false);
  const [awayMessage, setAwayMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-chat form fields
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [starting, setStarting] = useState(false);

  // Attachment staged for the next message.
  const [pendingAttachment, setPendingAttachment] =
    useState<WidgetAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visitorId = useRef<string | null>(null);
  const conversationId = useRef<string | null>(null);
  const lastAt = useRef<string | null>(null);
  const lastTypingPing = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const unreadRef = useRef(0);

  // Tell the parent loader how many unread agent messages there are, so it can
  // show a badge on the launcher while the chat is closed.
  function postUnread(count: number) {
    try {
      window.parent?.postMessage(
        { source: "spirchat", type: "unread", count },
        "*"
      );
    } catch {
      // parent may be cross-origin restricted; badge is best-effort
    }
  }

  // Tell the agent inbox the visitor is typing (throttled to once per ~2s).
  function notifyTyping() {
    if (!conversationId.current || !visitorId.current) return;
    const now = Date.now();
    if (now - lastTypingPing.current < 2000) return;
    lastTypingPing.current = now;
    fetch(`/api/widget/${channelId}/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: conversationId.current,
        visitorId: visitorId.current,
        page: document.referrer || null,
        typing: true,
      }),
    }).catch(() => {});
  }

  const storageKey = `spirchat_visitor_${channelId}`;

  const merge = useCallback((incoming: WidgetMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const added = incoming.filter((m) => !seen.has(m.id));
      if (added.length === 0) return prev;
      lastAt.current =
        added[added.length - 1]?.created_at ?? lastAt.current;
      // Badge new agent replies that arrive while the widget is hidden/closed.
      if (typeof document !== "undefined" && document.hidden) {
        const agentReplies = added.filter(
          (m) => m.direction === "outbound"
        ).length;
        if (agentReplies > 0) {
          unreadRef.current += agentReplies;
          postUnread(unreadRef.current);
        }
      }
      return [...prev, ...added];
    });
  }, []);

  const startSession = useCallback(
    async (name?: string, email?: string) => {
      try {
        const res = await fetch(`/api/widget/${channelId}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId: visitorId.current, name, email }),
        });
        if (!res.ok) throw new Error("session");
        const data = await res.json();
        visitorId.current = data.visitorId;
        conversationId.current = data.conversationId;
        try {
          localStorage.setItem(storageKey, data.visitorId);
        } catch {
          // localStorage may be blocked in some embedding contexts
        }
        setReady(true);
        setPhase("chat");
      } catch {
        setError(s.unavailable);
        setPhase("chat");
      }
    },
    [channelId, storageKey, s.unavailable]
  );

  // Decide the initial phase: resume a known visitor, else show the pre-chat
  // form when the widget requires it, else start anonymously.
  useEffect(() => {
    let cancelled = false;
    try {
      visitorId.current = localStorage.getItem(storageKey);
    } catch {
      // ignore
    }

    (async () => {
      let prechat = false;
      try {
        const res = await fetch(`/api/widget/${channelId}/config`);
        if (res.ok) {
          const cfg = await res.json();
          prechat = cfg?.prechat === true;
          if (typeof cfg?.greeting === "string") setGreeting(cfg.greeting);
          if (Array.isArray(cfg?.starters)) setStarters(cfg.starters);
          if (cfg?.away === true) setAway(true);
          if (typeof cfg?.awayMessage === "string" && cfg.awayMessage)
            setAwayMessage(cfg.awayMessage);
        }
      } catch {
        // config is best-effort; fall through to anonymous start
      }
      if (cancelled) return;

      if (visitorId.current || !prechat) {
        await startSession();
      } else {
        setPhase("prechat");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [channelId, storageKey, startSession]);

  // Poll for new messages once the session is ready.
  useEffect(() => {
    if (!ready) return;
    let stop = false;

    async function poll() {
      if (stop || !conversationId.current || !visitorId.current) return;
      try {
        const q = new URLSearchParams({
          conversationId: conversationId.current,
          visitorId: visitorId.current,
        });
        if (lastAt.current) q.set("since", lastAt.current);
        const res = await fetch(`/api/widget/${channelId}/messages?${q}`);
        if (res.ok) {
          const data = await res.json();
          merge(data.messages ?? []);
        }
      } catch {
        // transient; try again next tick
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [ready, channelId, merge]);

  // Presence heartbeat: tell the agent inbox the visitor is online + which page
  // they're on (the parent page that embedded the widget).
  useEffect(() => {
    if (!ready) return;
    let stop = false;

    async function ping() {
      if (stop || !conversationId.current || !visitorId.current) return;
      try {
        await fetch(`/api/widget/${channelId}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: conversationId.current,
            visitorId: visitorId.current,
            page: document.referrer || null,
          }),
        });
      } catch {
        // best-effort
      }
    }

    ping();
    const id = setInterval(ping, 20000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [ready, channelId]);

  // Keep the view pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, phase]);

  // When the chat becomes visible again (the visitor opened the launcher, so
  // the hidden iframe is shown), clear the unread badge.
  useEffect(() => {
    function onVisibility() {
      if (!document.hidden) {
        unreadRef.current = 0;
        postUnread(0);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  async function submitPrechat() {
    if (!formName.trim() || starting) return;
    setStarting(true);
    await startSession(formName.trim(), formEmail.trim() || undefined);
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !conversationId.current || !visitorId.current) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("conversationId", conversationId.current);
      fd.append("visitorId", visitorId.current);
      const res = await fetch(`/api/widget/${channelId}/upload`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.attachment) setPendingAttachment(data.attachment);
    } catch {
      // best-effort; the visitor can retry
    } finally {
      setUploading(false);
    }
  }

  async function send(override?: string) {
    const text = (override ?? input).trim();
    const attachment = override ? null : pendingAttachment;
    if ((!text && !attachment) || !conversationId.current || !visitorId.current)
      return;
    if (!override) {
      setInput("");
      setPendingAttachment(null);
    }

    const optimistic: WidgetMessage = {
      id: `optimistic-${Date.now()}`,
      direction: "inbound",
      text: text || null,
      attachments: attachment ? [attachment] : undefined,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/widget/${channelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId.current,
          visitorId: visitorId.current,
          text,
          attachments: attachment ? [attachment] : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? data.message : m))
        );
        lastAt.current = data.message.created_at;
      }
    } catch {
      // leave the optimistic message; the next poll will reconcile
    }
  }

  return (
    <div dir={dir} className="flex h-screen flex-col bg-white text-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-3 text-white">
        <div className="relative">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold shadow-sm">
            S
          </div>
          <span
            className={
              "absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-violet-600 " +
              (away ? "bg-amber-400" : "bg-emerald-400")
            }
          />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">SpirChat</p>
          <p className="text-xs text-white/80 leading-tight">
            {away ? awayMessage ?? s.away : s.subtitle}
          </p>
        </div>
      </div>

      {phase === "prechat" ? (
        /* Pre-chat form */
        <div className="flex flex-1 flex-col justify-center gap-3 p-6">
          <p className="text-sm font-semibold text-gray-900">{s.prechatTitle}</p>
          {greeting && <p className="-mt-1 text-sm text-gray-500">{greeting}</p>}
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder={s.name}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
          <input
            type="email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            placeholder={s.email}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
          <button
            onClick={submitPrechat}
            disabled={!formName.trim() || starting}
            className="mt-1 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {s.start}
          </button>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4">
            {messages.length === 0 && !error && (
              <div className="mt-6 flex flex-col items-center gap-3">
                <p className="text-center text-sm text-gray-400">
                  {away && awayMessage ? awayMessage : greeting ?? s.empty}
                </p>
                {starters.length > 0 && (
                  <div className="flex w-full flex-col items-stretch gap-2 px-2">
                    {starters.map((st, i) => (
                      <button
                        key={i}
                        onClick={() => send(st)}
                        disabled={!ready}
                        className="rounded-full border border-violet-200 bg-white px-4 py-2 text-sm text-violet-700 shadow-sm transition-colors hover:bg-violet-50 disabled:opacity-50"
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {error && (
              <p className="mt-8 text-center text-sm text-red-500">{s.unavailable}</p>
            )}
            {messages.map((m, i) => {
              const isVisitor = m.direction === "inbound";
              // Group consecutive agent messages: only the last in a run shows
              // the avatar, so a burst of replies reads as one speaker.
              const nextSame =
                i < messages.length - 1 &&
                messages[i + 1].direction === m.direction;
              return (
                <div
                  key={m.id}
                  className={
                    "flex items-end gap-2 " +
                    (isVisitor ? "flex-row-reverse" : "flex-row")
                  }
                >
                  {!isVisitor && (
                    <div
                      className={
                        "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-[10px] font-bold text-white " +
                        (nextSame ? "opacity-0" : "")
                      }
                    >
                      S
                    </div>
                  )}
                  <div className={"flex max-w-[78%] flex-col " + (isVisitor ? "items-end" : "items-start")}>
                    <div
                      className={
                        "whitespace-pre-wrap break-words px-3.5 py-2 text-sm shadow-sm " +
                        (isVisitor
                          ? "rounded-2xl rounded-ee-md bg-violet-600 text-white"
                          : "rounded-2xl rounded-es-md bg-white text-gray-900")
                      }
                    >
                      {m.text}
                      {(m.attachments ?? []).map((a, ai) =>
                        isImage(a.type) ? (
                          <a
                            key={ai}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={m.text ? "mt-2 block" : "block"}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={a.url}
                              alt={a.name}
                              className="max-h-48 max-w-full rounded-lg object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            key={ai}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={
                              "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs underline-offset-2 hover:underline " +
                              (m.text ? "mt-2 " : "") +
                              (isVisitor ? "bg-white/15" : "bg-gray-100")
                            }
                          >
                            <Paperclip className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{a.name}</span>
                          </a>
                        )
                      )}
                    </div>
                    {!nextSame && (
                      <span className="mt-1 px-1 text-[10px] text-gray-400">
                        {formatTime(m.created_at, lang)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Composer */}
          <div className="border-t border-gray-100 bg-white p-3">
            {pendingAttachment && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5 text-xs text-gray-700">
                {isImage(pendingAttachment.type) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pendingAttachment.url}
                    alt={pendingAttachment.name}
                    className="h-7 w-7 rounded object-cover"
                  />
                ) : (
                  <Paperclip className="h-4 w-4 text-gray-400" />
                )}
                <span className="flex-1 truncate">{pendingAttachment.name}</span>
                <button
                  onClick={() => setPendingAttachment(null)}
                  aria-label="Remove"
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,.doc,.docx"
                onChange={handleFilePick}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!ready || uploading}
                aria-label={s.attach}
                title={s.attach}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </button>
              <input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (e.target.value.trim()) notifyTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                disabled={!ready}
                placeholder={s.placeholder}
                className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-violet-400 disabled:bg-gray-50"
              />
              <button
                onClick={() => send()}
                disabled={!ready || (!input.trim() && !pendingAttachment)}
                aria-label="Send"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
