"use client";

import { useState } from "react";
import { Building2, Check, Pencil, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Inline editor for a contact's company/organization. */
export function ContactCompany({
  contactId,
  initialCompany,
}: {
  contactId: string;
  initialCompany: string | null;
}) {
  const [company, setCompany] = useState(initialCompany ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(company);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    const value = draft.trim();
    await createClient()
      .from("contacts")
      .update({ company: value || null })
      .eq("id", contactId);
    setCompany(value);
    setBusy(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <Building2 className="h-3 w-3" />
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setDraft(company);
              setEditing(false);
            }
          }}
          placeholder="Company"
          className="w-32 rounded border border-border bg-background px-1.5 py-0.5 text-xs outline-none focus:border-primary"
        />
        <button onClick={save} disabled={busy} aria-label="Save" className="text-primary">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(company);
        setEditing(true);
      }}
      className="group flex items-center gap-1 hover:text-foreground"
    >
      <Building2 className="h-3 w-3" />
      {company || <span className="italic">Add company</span>}
      <Pencil className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-60" />
    </button>
  );
}
