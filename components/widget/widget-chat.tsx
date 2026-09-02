"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Paperclip, Loader2, X, Smile } from "lucide-react";
import type { RichContent } from "@/lib/rich-content";
import { validateAnswer, type FormField } from "@/lib/forms";

interface WidgetForm {
  id: string;
  fields: FormField[];
  successMessage: string | null;
}

// A small, dependency-free set of common emojis for the composer picker.
const EMOJIS = [
  "😀", "😂", "😍", "😊", "👍", "🙏", "🎉", "❤️",
  "🔥", "👋", "✅", "🤔", "😅", "🙌", "💯", "😢",
];

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
  richContent?: RichContent | null;
  created_at: string;
}

// Renders link buttons / product-card carousels attached to an agent message.
function RichContentView({ rich }: { rich: RichContent }) {
  if (rich.type === "buttons") {
    return (
      <div className="mt-2 flex flex-col gap-1.5">
        {rich.buttons.map((b, i) => (
          <a
            key={i}
            href={b.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-center text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
          >
            {b.label}
          </a>
        ))}
      </div>
    );
  }
  return (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
      {rich.cards.map((c, i) => (
        <div
          key={i}
          className="w-44 flex-shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white"
        >
          {c.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.imageUrl} alt={c.title} className="h-24 w-full object-cover" />
          )}
          <div className="p-2">
            <p className="text-sm font-semibold text-gray-900">{c.title}</p>
            {c.subtitle && (
              <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{c.subtitle}</p>
            )}
            <div className="mt-2 flex flex-col gap-1">
              {c.buttons.map((b, j) => (
                <a
                  key={j}
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-violet-600 px-2 py-1 text-center text-xs font-medium text-white hover:bg-violet-700"
                >
                  {b.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function isImage(type: string): boolean {
  return typeof type === "string" && type.startsWith("image/");
}

const POLL_MS = 3000;

// Short HH:MM stamp in the visitor's locale, shown under each bubble.
function formatTime(iso: string, lang: "en" | "ar"): string {
  try {
    // Arabic locale but Latin digits (nu-latn) — keep numerals as 1,2,3.
    return new Date(iso).toLocaleTimeString(lang === "ar" ? "ar-u-nu-latn" : "en-US", {
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
    emoji: "Emoji",
    away: "We're away right now — leave a message.",
    typing: "typing…",
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
    emoji: "إيموجي",
    away: "نحن غير متواجدين حالياً — اترك رسالة وسنعاود التواصل.",
    typing: "يكتب…",
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

  // Conversational form flow (feature 5).
  const formRef = useRef<WidgetForm | null>(null);
  const [formActive, setFormActive] = useState(false);
  const [pendingForm, setPendingForm] = useState<WidgetForm | null>(null);
  const formIndex = useRef(0);
  const formAnswers = useRef<Record<string, string>>({});
  const formStarted = useRef(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [agentTyping, setAgentTyping] = useState(false);
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
  const [showEmoji, setShowEmoji] = useState(false);
  const textInputRef = useRef<HTMLInputElement>(null);

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

      // Load a conversational form for this widget, if any (only when the
      // visitor hasn't already completed it in this browser).
      try {
        let doneFlag = false;
        try {
          doneFlag = localStorage.getItem(`spirchat_form_${channelId}`) === "1";
        } catch {}
        if (!doneFlag) {
          const fr = await fetch(`/api/widget/${channelId}/form`);
          if (fr.ok) {
            const fd = await fr.json();
            if (fd?.form?.fields?.length) setPendingForm(fd.form);
          }
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
          setAgentTyping(data.agentTyping === true);
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

  // Start the conversational form once the session is live (chat phase).
  useEffect(() => {
    if (
      ready &&
      phase === "chat" &&
      pendingForm &&
      !formStarted.current &&
      !error
    ) {
      formStarted.current = true;
      startForm(pendingForm);
      setPendingForm(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, phase, pendingForm, error]);

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

  // Append a local-only chat bubble (used to drive the form flow client-side).
  function pushLocal(direction: "inbound" | "outbound", text: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        direction,
        text,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  function startForm(form: WidgetForm) {
    if (form.fields.length === 0) return;
    formRef.current = form;
    formIndex.current = 0;
    formAnswers.current = {};
    setFormActive(true);
    pushLocal("outbound", form.fields[0].label);
  }

  async function handleFormAnswer(value: string) {
    const form = formRef.current;
    if (!form) return;
    const field = form.fields[formIndex.current];
    const err = validateAnswer(field, value);
    pushLocal("inbound", value);
    if (err) {
      pushLocal("outbound", err);
      return; // re-ask the same field
    }
    formAnswers.current[field.key] = value.trim();
    formIndex.current += 1;

    if (formIndex.current < form.fields.length) {
      pushLocal("outbound", form.fields[formIndex.current].label);
      return;
    }

    // Completed — submit and leave form mode.
    setFormActive(false);
    try {
      localStorage.setItem(`spirchat_form_${channelId}`, "1");
    } catch {}
    if (form.successMessage) pushLocal("outbound", form.successMessage);
    try {
      await fetch(`/api/widget/${channelId}/form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId.current,
          visitorId: visitorId.current,
          formId: form.id,
          answers: formAnswers.current,
        }),
      });
    } catch {
      // best-effort; the visitor can still chat
    }
    formRef.current = null;
  }

  function insertEmoji(emoji: string) {
    const el = textInputRef.current;
    if (el) {
      const start = el.selectionStart ?? input.length;
      const end = el.selectionEnd ?? input.length;
      const next = input.slice(0, start) + emoji + input.slice(end);
      setInput(next);
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

  async function send(override?: string) {
    const text = (override ?? input).trim();

    // In form mode, the composer captures the answer to the current question.
    if (formActive) {
      if (!text) return;
      setInput("");
      await handleFormAnswer(text);
      return;
    }

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
                      {m.richContent && <RichContentView rich={m.richContent} />}
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
            {agentTyping && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                  <span className="ms-1 text-[10px] text-gray-400">{s.typing}</span>
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="relative border-t border-gray-100 bg-white p-3">
            {showEmoji && (
              <div className="absolute bottom-full end-3 mb-2 grid grid-cols-8 gap-1 rounded-xl border border-gray-100 bg-white p-2 shadow-lg">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => insertEmoji(e)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-gray-100"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
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
              <button
                onClick={() => setShowEmoji((v) => !v)}
                disabled={!ready}
                aria-label={s.emoji}
                title={s.emoji}
                className={
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-40 " +
                  (showEmoji ? "text-violet-600" : "text-gray-400 hover:text-gray-600")
                }
              >
                <Smile className="h-4 w-4" />
              </button>
              <input
                ref={textInputRef}
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
