// Conversation transcript export — turns a conversation's messages and internal
// notes into a plain-text/Markdown document an agent can download and archive.
// Pure formatting so it can be unit-tested and reused server- or client-side.

export interface TranscriptMessage {
  direction: "inbound" | "outbound";
  text: string | null;
  created_at: string;
}

export interface TranscriptNote {
  body: string;
  created_at: string;
}

export interface TranscriptMeta {
  contactName: string;
  agentName?: string;
  platform?: string;
  status?: string;
}

interface Entry {
  at: number;
  line: string;
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Stable, locale-independent: YYYY-MM-DD HH:MM (UTC).
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}

/**
 * Build a Markdown transcript. Messages and notes are interleaved by time;
 * inbound messages are attributed to the contact, outbound to the agent (or a
 * generic "Agent"), and internal notes are clearly marked as private.
 */
export function buildTranscript(
  meta: TranscriptMeta,
  messages: TranscriptMessage[],
  notes: TranscriptNote[] = []
): string {
  const contact = meta.contactName?.trim() || "Contact";
  const agent = meta.agentName?.trim() || "Agent";

  const header: string[] = [`# Conversation with ${contact}`, ""];
  const facts: string[] = [];
  if (meta.platform) facts.push(`Channel: ${meta.platform}`);
  if (meta.status) facts.push(`Status: ${meta.status}`);
  facts.push(`Exported: ${formatStamp(new Date().toISOString())}`);
  header.push(...facts, "");

  const entries: Entry[] = [];
  for (const m of messages) {
    const who = m.direction === "inbound" ? contact : agent;
    const text = (m.text ?? "").trim() || "(no text)";
    entries.push({
      at: new Date(m.created_at).getTime() || 0,
      line: `**${who}** · ${formatStamp(m.created_at)}\n${text}`,
    });
  }
  for (const n of notes) {
    const body = (n.body ?? "").trim();
    if (!body) continue;
    entries.push({
      at: new Date(n.created_at).getTime() || 0,
      line: `**[Internal note]** · ${formatStamp(n.created_at)}\n${body}`,
    });
  }

  entries.sort((a, b) => a.at - b.at);

  if (entries.length === 0) {
    return [...header, "_No messages in this conversation._", ""].join("\n");
  }

  return [...header, entries.map((e) => e.line).join("\n\n"), ""].join("\n");
}

/** Filename-safe slug for the downloaded transcript. */
export function transcriptFilename(contactName: string): string {
  const slug =
    (contactName || "conversation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "conversation";
  const date = new Date().toISOString().slice(0, 10);
  return `transcript-${slug}-${date}.md`;
}
