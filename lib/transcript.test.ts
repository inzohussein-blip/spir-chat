import { describe, it, expect } from "vitest";
import {
  buildTranscript,
  transcriptFilename,
  type TranscriptMessage,
  type TranscriptNote,
} from "./transcript";

const msgs: TranscriptMessage[] = [
  { direction: "inbound", text: "Hi, I need help", created_at: "2026-01-01T10:00:00Z" },
  { direction: "outbound", text: "Happy to help!", created_at: "2026-01-01T10:05:00Z" },
];

describe("buildTranscript", () => {
  it("attributes inbound to the contact and outbound to the agent", () => {
    const out = buildTranscript({ contactName: "Sara", agentName: "Omar" }, msgs);
    expect(out).toContain("# Conversation with Sara");
    expect(out).toContain("**Sara**");
    expect(out).toContain("Hi, I need help");
    expect(out).toContain("**Omar**");
    expect(out).toContain("Happy to help!");
  });

  it("interleaves notes in time order and marks them internal", () => {
    const notes: TranscriptNote[] = [
      { body: "VIP customer", created_at: "2026-01-01T10:02:00Z" },
    ];
    const out = buildTranscript({ contactName: "Sara" }, msgs, notes);
    const iContact = out.indexOf("Hi, I need help");
    const iNote = out.indexOf("VIP customer");
    const iReply = out.indexOf("Happy to help!");
    expect(iContact).toBeLessThan(iNote);
    expect(iNote).toBeLessThan(iReply);
    expect(out).toContain("[Internal note]");
  });

  it("includes channel and status facts when given", () => {
    const out = buildTranscript(
      { contactName: "Sara", platform: "whatsapp", status: "open" },
      msgs
    );
    expect(out).toContain("Channel: whatsapp");
    expect(out).toContain("Status: open");
  });

  it("handles an empty conversation", () => {
    const out = buildTranscript({ contactName: "Sara" }, [], []);
    expect(out).toContain("No messages in this conversation");
  });

  it("skips blank notes and shows a placeholder for empty message text", () => {
    const out = buildTranscript({ contactName: "Sara" }, [
      { direction: "inbound", text: "", created_at: "2026-01-01T10:00:00Z" },
    ], [{ body: "   ", created_at: "2026-01-01T10:01:00Z" }]);
    expect(out).toContain("(no text)");
    expect(out).not.toContain("[Internal note]");
  });
});

describe("transcriptFilename", () => {
  it("slugifies the contact name and ends in .md", () => {
    const f = transcriptFilename("Sara Ali!");
    expect(f).toMatch(/^transcript-sara-ali-\d{4}-\d{2}-\d{2}\.md$/);
  });

  it("falls back for an empty name", () => {
    expect(transcriptFilename("")).toMatch(/^transcript-conversation-/);
  });
});
