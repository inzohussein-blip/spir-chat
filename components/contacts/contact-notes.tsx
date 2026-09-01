"use client";

import { useState } from "react";
import { StickyNote, Loader2, Trash2, Plus } from "lucide-react";
import { addContactNote, deleteContactNote } from "@/lib/actions/contact-notes";

interface Note {
  id: string;
  body: string;
  created_at: string;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContactNotes({
  contactId,
  initialNotes,
}: {
  contactId: string;
  initialNotes: Note[];
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    const res = await addContactNote(contactId, text);
    setBusy(false);
    if (res.ok && res.note) {
      setNotes((prev) => [res.note as Note, ...prev]);
      setBody("");
    }
  }

  async function remove(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await deleteContactNote(id);
  }

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
        <StickyNote className="h-3.5 w-3.5" />
        Notes
      </h2>
      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="flex gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") add();
            }}
            rows={2}
            placeholder="Add a private note about this contact…"
            className="min-w-0 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={add}
            disabled={busy || !body.trim()}
            className="inline-flex items-center gap-1.5 self-start rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </button>
        </div>

        {notes.length > 0 && (
          <ul className="mt-3 space-y-2">
            {notes.map((n) => (
              <li
                key={n.id}
                className="group rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-wrap break-words">{n.body}</p>
                  <button
                    onClick={() => remove(n.id)}
                    aria-label="Delete note"
                    className="flex-shrink-0 text-amber-600/60 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-amber-600/80 dark:text-amber-400/70">
                  {formatWhen(n.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
