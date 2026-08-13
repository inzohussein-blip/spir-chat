// Shared helpers for chat attachments (images / files) on website conversations.
//
// Files live in a public Supabase Storage bucket; uploads always go through a
// server route using the service-role client (so the bucket needs only public
// READ, no per-role INSERT policies). The attachment metadata is stored on the
// message row's `attachments` jsonb column and read back by both the agent
// inbox and the embedded visitor widget.

/** Public Storage bucket that holds chat attachments. Create it manually. */
export const CHAT_BUCKET = "chat-attachments";

/** Max upload size accepted from either the visitor widget or an agent. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

/** MIME types we accept — common images plus a few safe document types. */
export const ALLOWED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

/**
 * Metadata for one uploaded attachment, stored in messages.attachments[].
 * The index signature keeps it structurally assignable to the DB `Json` type.
 */
export interface MessageAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
  [key: string]: string | number;
}

/** Whether a MIME type is an image we can render inline in a bubble. */
export function isImageType(type: string): boolean {
  return typeof type === "string" && type.startsWith("image/");
}

/**
 * Strip a filename down to a safe basename for the storage path. Keeps the
 * extension, drops directory separators and anything unusual.
 */
export function sanitizeFileName(name: string): string {
  const base = (name || "file").split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^\w.\- ]+/g, "").trim();
  return cleaned.slice(0, 80) || "file";
}

/** Validate an uploaded file's type and size. Returns an error message or null. */
export function validateUpload(file: {
  type: string;
  size: number;
}): string | null {
  if (!file || typeof file.size !== "number" || file.size <= 0) {
    return "No file provided";
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return "File is too large (max 10 MB)";
  }
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type as never)) {
    return "Unsupported file type";
  }
  return null;
}

/** Object path inside the bucket for a conversation's attachment. */
export function buildAttachmentPath(
  conversationId: string,
  fileName: string
): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${conversationId}/${Date.now()}-${rand}-${sanitizeFileName(fileName)}`;
}

/**
 * Safely coerce a stored `attachments` jsonb value into a typed array for
 * rendering. Tolerates nulls, non-arrays, and malformed entries.
 */
export function parseAttachments(raw: unknown): MessageAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: MessageAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.url !== "string" || !o.url) continue;
    out.push({
      url: o.url,
      name: typeof o.name === "string" ? o.name : "file",
      type: typeof o.type === "string" ? o.type : "",
      size: typeof o.size === "number" ? o.size : 0,
    });
  }
  return out;
}
