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

export function WidgetChat({ channelId }: { channelId: string }) {
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Start/resume the session on mount.
  useEffect(() => {
    let cancelled = false;
    try {
      visitorId.current = localStorage.getItem(storageKey);
    } catch {
      // localStorage may be blocked in some embedding contexts.
    }

    (async () => {
      try {
        const res = await fetch(`/api/widget/${channelId}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId: visitorId.current }),
        });
        if (!res.ok) throw new Error("session");
        const data = await res.json();
        if (cancelled) return;
        visitorId.current = data.visitorId;
        conversationId.current = data.conversationId;
        try {
          localStorage.setItem(storageKey, data.visitorId);
        } catch {
          // ignore
        }
        setReady(true);
      } catch {
        if (!cancelled) setError("Chat is unavailable right now.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [channelId, storageKey]);

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

  // Keep the view pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

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
    <div className="flex h-screen flex-col bg-white text-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-3 text-white">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
          S
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">SpirChat</p>
          <p className="text-xs text-white/80 leading-tight">
            We typically reply shortly
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && !error && (
          <p className="mt-8 text-center text-sm text-gray-400">
            Send us a message and we&apos;ll get back to you.
          </p>
        )}
        {error && (
          <p className="mt-8 text-center text-sm text-red-500">{error}</p>
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
          placeholder="Type a message…"
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
    </div>
  );
}
