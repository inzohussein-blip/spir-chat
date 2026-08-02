"use client";

import { useEffect, useRef, useState } from "react";
import { Tag, Plus, X, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type Label = Database["public"]["Tables"]["labels"]["Row"];

const PALETTE = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#06b6d4", "#8b5cf6", "#ef4444", "#3b82f6",
];

export function LabelPicker({
  conversationId,
  workspaceId,
  allLabels,
}: {
  conversationId: string;
  workspaceId: string;
  allLabels: Label[];
}) {
  const [labels, setLabels] = useState<Label[]>(allLabels);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setLabels(allLabels), [allLabels]);

  // Load the labels assigned to this conversation.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await createClient()
        .from("conversation_labels")
        .select("label_id")
        .eq("conversation_id", conversationId);
      if (!cancelled) setAssigned(new Set((data ?? []).map((r) => r.label_id)));
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // Close the popover on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function toggle(labelId: string) {
    const supabase = createClient();
    const isOn = assigned.has(labelId);
    setAssigned((prev) => {
      const next = new Set(prev);
      if (isOn) next.delete(labelId);
      else next.add(labelId);
      return next;
    });
    if (isOn) {
      await supabase
        .from("conversation_labels")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("label_id", labelId);
    } else {
      await supabase
        .from("conversation_labels")
        .insert({ conversation_id: conversationId, label_id: labelId });
    }
  }

  async function createAndAssign() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    const color = PALETTE[labels.length % PALETTE.length];
    const { data, error } = await createClient()
      .from("labels")
      .insert({ workspace_id: workspaceId, name, color })
      .select("*")
      .single();
    if (!error && data) {
      setLabels((prev) => [...prev, data]);
      setNewName("");
      await toggle(data.id);
    }
    setBusy(false);
  }

  const assignedLabels = labels.filter((l) => assigned.has(l.id));

  return (
    <div ref={boxRef} className="relative flex flex-wrap items-center gap-1.5">
      {assignedLabels.map((l) => (
        <span
          key={l.id}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
          style={{ backgroundColor: l.color }}
        >
          {l.name}
          <button
            onClick={() => toggle(l.id)}
            aria-label={`Remove ${l.name}`}
            className="opacity-80 hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Tag className="h-3 w-3" />
        Label
      </button>

      {open && (
        <div className="absolute top-full z-50 mt-1 w-56 rounded-lg border border-border bg-popover p-1 shadow-lg">
          <div className="max-h-52 overflow-auto">
            {labels.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No labels yet — create one below.
              </p>
            )}
            {labels.map((l) => (
              <button
                key={l.id}
                onClick={() => toggle(l.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-accent"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: l.color }}
                />
                <span className="flex-1 truncate">{l.name}</span>
                {assigned.has(l.id) && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-1 border-t border-border pt-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createAndAssign()}
              placeholder="New label…"
              className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm outline-none"
            />
            <button
              onClick={createAndAssign}
              disabled={!newName.trim() || busy}
              aria-label="Create label"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
