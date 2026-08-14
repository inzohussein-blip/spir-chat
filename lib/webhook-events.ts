// Client-safe webhook event constants (no server-only imports), so both the
// dashboard UI and the server dispatcher can share them.

export const WEBHOOK_EVENTS = [
  "message.created",
  "conversation.created",
  "conversation.resolved",
  "contact.created",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
