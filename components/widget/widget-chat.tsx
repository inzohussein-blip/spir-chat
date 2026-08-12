"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

interface WidgetMessage {
  id: string;
  direction: "inbound" | "outbound";
  text: string | null;
  created_at: string;
}

const POLL_MS = 3000;

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
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-chat form fields
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [starting, setStarting] = useState(false);

  const visitorId = useRef<string | null>(null);
  const conversationId = useRef<string | null>(null);
  const lastAt = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const storageKey = `spirchat_visitor_${channelId}`;

  const merge = useCallback((incoming: WidgetMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const next = [...prev];
      for (const m of incoming) {
        if (!seen.has(m.id)) next.push(m);
      }
      lastAt.current = next[next.length - 1]?.created_at ?? lastAt.current;
      return next;
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

  async function submitPrechat() {
    if (!formName.trim() || starting) return;
    setStarting(true);
    await startSession(formName.trim(), formEmail.trim() || undefined);
  }

  async function send() {
    const text = input.trim();
    if (!text || !conversationId.current || !visitorId.current) return;
    setInput("");

    const optimistic: WidgetMessage = {
      id: `optimistic-${Date.now()}`,
      direction: "inbound",
      text,
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
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
          S
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">SpirChat</p>
          <p className="text-xs text-white/80 leading-tight">{s.subtitle}</p>
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
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
            {messages.length === 0 && !error && (
              <p className="mt-8 text-center text-sm text-gray-400">
                {greeting ?? s.empty}
              </p>
            )}
            {error && (
              <p className="mt-8 text-center text-sm text-red-500">{s.unavailable}</p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.direction === "inbound" ? "flex justify-end" : "flex justify-start"
                }
              >
                <div
                  className={
                    "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm " +
                    (m.direction === "inbound"
                      ? "bg-violet-600 text-white"
                      : "bg-gray-100 text-gray-900")
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Composer */}
          <div className="flex items-center gap-2 border-t border-gray-100 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
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
              onClick={send}
              disabled={!ready || !input.trim()}
              aria-label="Send"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
