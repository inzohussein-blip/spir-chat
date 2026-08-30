"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Merge, Loader2 } from "lucide-react";
import { mergeContacts } from "@/lib/actions/contacts";

export function MergeContact({
  primaryId,
  others,
}: {
  primaryId: string;
  others: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [dupId, setDupId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (others.length === 0) return null;

  async function merge() {
    if (!dupId || busy) return;
    const label = others.find((o) => o.id === dupId)?.label ?? "this contact";
    if (!confirm(`Merge "${label}" into this contact? The duplicate is deleted and its history moves here. This can't be undone.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await mergeContacts(primaryId, dupId);
    setBusy(false);
    if (res.error) return setError(res.error);
    setDupId("");
    router.refresh();
  }

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
        <Merge className="h-3.5 w-3.5" />
        Merge duplicate
      </h2>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4 shadow-card">
        <select
          value={dupId}
          onChange={(e) => setDupId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">Choose a contact to merge in…</option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          onClick={merge}
          disabled={!dupId || busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
          Merge in
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Conversations, tags, custom fields, and history from the chosen contact
        move into this one; the duplicate is removed.
      </p>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
