// Tracked links + message personalization.
// The URL/slug/click helpers are adapted from OpenReply (MIT-licensed):
// https://github.com/diwenne/openreply — lib/tracking/*.

import { createHash, randomBytes } from "node:crypto";
import { SITE_URL } from "@/lib/site";

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/i;

/** Short, URL-safe slug for a /r/<slug> tracked redirect. */
export function generateTrackedLinkSlug(): string {
  return randomBytes(7).toString("base64url");
}

/** Public URL a tracked link resolves to. */
export function buildTrackedUrl(slug: string, baseUrl: string = SITE_URL): string {
  return `${baseUrl.replace(/\/$/, "")}/r/${slug}`;
}

/** Hash a click's IP with the app secret so raw IPs are never stored. */
export function hashClickIp(ipAddress: string | null | undefined): string | null {
  if (!ipAddress) return null;
  const salt = process.env.NEXTAUTH_SECRET ?? process.env.CRON_SECRET ?? "spirchat-click-salt";
  return createHash("sha256").update(`${salt}:${ipAddress}`).digest("hex");
}

/** Best-effort client IP from proxy headers. */
export function getRequestIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? null;
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    null
  );
}

/** Extract the first http(s) URL from a message (trailing punctuation trimmed). */
export function extractFirstUrl(message: string): string | null {
  const match = message.match(URL_PATTERN);
  if (!match) return null;
  try {
    const url = match[0].replace(/[.,!?;:]+$/, "");
    return new URL(url).toString();
  } catch {
    return null;
  }
}

/** Basic https(‑or‑http) URL validity check. */
export function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Render a message for delivery: replace {username} with the recipient name and
 * substitute a {link} token (or an inline destination URL) with the tracked URL.
 */
export function renderMessageWithTracking({
  message,
  recipientName,
  trackedLink,
  baseUrl = SITE_URL,
}: {
  message: string;
  recipientName?: string | null;
  trackedLink?: { slug: string; destinationUrl: string } | null;
  baseUrl?: string;
}): string {
  let rendered = message.replace(/\{username\}/gi, recipientName ?? "there");
  if (!trackedLink) return rendered.replace(/\s*\{link\}\s*/gi, " ").trim();

  const trackedUrl = buildTrackedUrl(trackedLink.slug, baseUrl);
  if (/\{link\}/i.test(rendered)) {
    return rendered.replace(/\{link\}/gi, trackedUrl);
  }
  if (rendered.includes(trackedLink.destinationUrl)) {
    return rendered.replaceAll(trackedLink.destinationUrl, trackedUrl);
  }
  const withoutTrailingSlash = trackedLink.destinationUrl.replace(/\/$/, "");
  return rendered.replaceAll(withoutTrailingSlash, trackedUrl);
}
