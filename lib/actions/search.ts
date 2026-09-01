"use server";

import { getWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";

export interface MessageSearchHit {
  conversationId: string;
  snippet: string;
  contactName: string;
  platform: string;
  at: string;
}

/**
 * Full-text-ish search over message bodies in the caller's workspace. Returns
 * the most recent matching message per conversation so an agent can find an
 * old conversation by something that was said in it — not just what's loaded
 * in the inbox list. Scoped to the workspace via the joined conversation.
 */
export async function searchMessages(query: string): Promise<{ hits: MessageSearchHit[] }> {
  const q = query.trim();
  if (q.length < 2) return { hits: [] };

  const { workspace } = await getWorkspace();
  const supabase = await createServiceClient();

  // Escape LIKE wildcards so user input is matched literally.
  const escaped = q.replace(/[\\%_]/g, (m) => `\\${m}`);

  const { data } = await supabase
    .from("messages")
    .select(
      "conversation_id, text, created_at, conversations!inner(workspace_id, platform, contacts(display_name))"
    )
    .eq("conversations.workspace_id", workspace.id)
    .ilike("text", `%${escaped}%`)
    .order("created_at", { ascending: false })
    .limit(60);

  const seen = new Set<string>();
  const hits: MessageSearchHit[] = [];
  for (const row of data ?? []) {
    const convId = row.conversation_id as string;
    if (!convId || seen.has(convId)) continue;
    seen.add(convId);
    const conv = row.conversations as unknown as {
      platform?: string;
      contacts?: { display_name?: string | null } | null;
    } | null;
    hits.push({
      conversationId: convId,
      snippet: makeSnippet(row.text ?? "", q),
      contactName: conv?.contacts?.display_name || "Unknown",
      platform: conv?.platform || "",
      at: row.created_at as string,
    });
    if (hits.length >= 20) break;
  }
  return { hits };
}

/** A short window of text around the first match of the query. */
function makeSnippet(text: string, q: string): string {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text.slice(0, 120);
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + q.length + 60);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}
