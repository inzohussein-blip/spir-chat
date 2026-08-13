// Shared helpers for the website live-chat widget.
//
// The widget is embedded on third-party sites and talks to /api/widget/*.
// These endpoints are public (no auth) and scoped by a channel id + an opaque
// per-visitor id, so keep the surface small and validate everything.

import type { MessageDirection } from "@/lib/types/database";
import { parseAttachments, type MessageAttachment } from "@/lib/attachments";

export const WIDGET_MAX_TEXT_LENGTH = 4000;

/** CORS headers for the public widget endpoints (embedded cross-origin). */
export const WIDGET_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

/** The minimal, safe message shape exposed to the embedded widget. */
export interface WidgetMessage {
  id: string;
  direction: MessageDirection;
  text: string | null;
  attachments: MessageAttachment[];
  created_at: string;
}

/**
 * Normalize visitor-supplied message text. Returns the trimmed text, or null
 * when it is empty or not a string. Over-long input is truncated rather than
 * rejected so a visitor never loses a long message to a hard error.
 */
export function sanitizeWidgetText(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, WIDGET_MAX_TEXT_LENGTH);
}

/** Visitor ids are opaque UUIDs minted client-side and kept in localStorage. */
export function isValidVisitorId(id: unknown): id is string {
  return (
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );
}

/** The platform_sender_id stored for a website visitor's contact_channel. */
export function visitorSenderId(visitorId: string): string {
  return `web:${visitorId}`;
}

/** Per-widget configuration (pre-chat form, greeting, proactive message). */
export interface WidgetConfig {
  prechat: boolean;
  greeting: string | null;
  /** Proactive teaser shown after a delay to prompt the visitor (Tidio-style). */
  proactive: string | null;
  /** Seconds to wait before showing the proactive teaser. */
  proactiveDelay: number;
  /** Clickable quick-reply prompts shown when the chat is empty (Tidio-style). */
  starters: string[];
  /** When on, the widget shows an "away" state instead of "online". */
  away: boolean;
  /** Message shown to visitors while away (falls back to a built-in default). */
  awayMessage: string | null;
}

export const DEFAULT_PROACTIVE_DELAY = 15;
export const MAX_STARTERS = 4;

/** Safely read a channel's widget_config jsonb into a typed WidgetConfig. */
export function parseWidgetConfig(raw: unknown): WidgetConfig {
  const o =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const greeting =
    typeof o.greeting === "string" && o.greeting.trim()
      ? o.greeting.trim().slice(0, 300)
      : null;
  const proactive =
    typeof o.proactive === "string" && o.proactive.trim()
      ? o.proactive.trim().slice(0, 300)
      : null;
  const proactiveDelay =
    typeof o.proactiveDelay === "number" && o.proactiveDelay > 0
      ? Math.min(Math.round(o.proactiveDelay), 600)
      : DEFAULT_PROACTIVE_DELAY;
  const starters = Array.isArray(o.starters)
    ? o.starters
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim().slice(0, 80))
        .slice(0, MAX_STARTERS)
    : [];
  const awayMessage =
    typeof o.awayMessage === "string" && o.awayMessage.trim()
      ? o.awayMessage.trim().slice(0, 200)
      : null;
  return {
    prechat: o.prechat === true,
    greeting,
    proactive,
    proactiveDelay,
    starters,
    away: o.away === true,
    awayMessage,
  };
}

/** Basic email sanity check for the optional pre-chat email field. */
export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Project a raw messages row down to the fields the widget may see. */
export function mapDbMessageToWidget(row: {
  id: string;
  direction: MessageDirection;
  text: string | null;
  attachments?: unknown;
  created_at: string;
}): WidgetMessage {
  return {
    id: row.id,
    direction: row.direction,
    text: row.text,
    attachments: parseAttachments(row.attachments),
    created_at: row.created_at,
  };
}
