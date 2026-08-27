"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Plus, Trash2, Save, X, GripVertical, Sparkles } from "lucide-react";
import { createMacro, updateMacro, deleteMacro } from "@/lib/actions/macros";
import { MACRO_TEMPLATES } from "@/lib/macro-templates";
import {
  ACTION_TYPES,
  ACTION_LABELS,
  MACRO_STATUSES,
  actionNeedsValue,
  type MacroAction,
  type MacroActionType,
} from "@/lib/macros";
import { PageTitle } from "@/components/page-title";

interface Macro {
  id: string;
  name: string;
  actions: MacroAction[];
}
interface Label {
  id: string;
  name: string;
  color: string;
}
interface Agent {
  id: string;
  email: string;
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  closed: "Resolved",
  snoozed: "Snoozed",
};

export function MacrosView({
  macros,
  labels,
  agents,
}: {
  macros: Macro[];
  labels: Label[];
  agents: Agent[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Macro | null>(null);
  const [creating, setCreating] = useState(false);
  const [seed, setSeed] = useState<{ name: string; actions: MacroAction[] } | null>(null);

  function openBlank() {
    setEditing(null);
    setSeed(null);
    setCreating(true);
  }

  function openTemplate(name: string, actions: MacroAction[]) {
    setEditing(null);
    setSeed({ name, actions });
    setCreating(true);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center justify-between">
          <PageTitle
            icon={Zap}
            title="Macros"
            subtitle="One-click action bundles your agents run on a conversation."
          />
          <button
            onClick={openBlank}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> New macro
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {(creating || editing) && (
            <MacroBuilder
              initial={editing}
              seed={seed}
              labels={labels}
              agents={agents}
              onClose={() => {
                setCreating(false);
                setEditing(null);
                setSeed(null);
              }}
              onSaved={() => {
                setCreating(false);
                setEditing(null);
                setSeed(null);
                router.refresh();
              }}
            />
          )}

          {/* Templates */}
          {!creating && !editing && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                Start from a template
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Prefill a macro you can tweak before saving.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {MACRO_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => openTemplate(tpl.name, tpl.actions)}
                    className="rounded-lg border border-border p-3 text-start transition-colors hover:border-primary/40 hover:bg-accent/50"
                  >
                    <p className="text-sm font-medium">{tpl.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{tpl.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {macros.length === 0 && !creating ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">No macros yet.</p>
            </div>
          ) : (
            macros.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{m.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {m.actions.length} action{m.actions.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    onClick={() => {
                      setCreating(false);
                      setEditing(m);
                    }}
                    className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      await deleteMacro(m.id);
                      router.refresh();
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MacroBuilder({
  initial,
  seed,
  labels,
  agents,
  onClose,
  onSaved,
}: {
  initial: Macro | null;
  seed?: { name: string; actions: MacroAction[] } | null;
  labels: Label[];
  agents: Agent[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? seed?.name ?? "");
  const [actions, setActions] = useState<MacroAction[]>(
    initial?.actions.length
      ? initial.actions
      : seed?.actions.length
      ? seed.actions
      : [{ type: "send_message", value: "" }]
  );
  const [saving, setSaving] = useState(false);

  function updateAction(i: number, patch: Partial<MacroAction>) {
    setActions((prev) =>
      prev.map((a, j) => {
        if (j !== i) return a;
        const next = { ...a, ...patch };
        // Reset value when switching to a different kind of action.
        if (patch.type && patch.type !== a.type) {
          next.value =
            patch.type === "add_label" || patch.type === "remove_label"
              ? labels[0]?.id ?? ""
              : patch.type === "set_status"
              ? "closed"
              : "";
        }
        return next;
      })
    );
  }

  async function save() {
    setSaving(true);
    if (initial) await updateMacro(initial.id, name, actions);
    else await createMacro(name, actions);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{initial ? "Edit macro" : "New macro"}</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Macro name"
        className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />

      <div className="space-y-2">
        {actions.map((action, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/50 p-2">
            <GripVertical className="h-4 w-4 flex-shrink-0 text-muted-foreground/40" />
            <select
              value={action.type}
              onChange={(e) => updateAction(i, { type: e.target.value as MacroActionType })}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none"
            >
              {ACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACTION_LABELS[t]}
                </option>
              ))}
            </select>

            <ActionValue action={action} labels={labels} agents={agents} onChange={(value) => updateAction(i, { value })} />

            <button
              onClick={() => setActions((prev) => prev.filter((_, j) => j !== i))}
              className="ms-auto rounded-md p-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          onClick={() => setActions((prev) => [...prev, { type: "send_message", value: "" }])}
          className="text-xs font-medium text-primary hover:underline"
        >
          + Add action
        </button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Messages personalize with{" "}
        <code className="rounded bg-muted px-1 py-0.5">{"{{first_name}}"}</code> and{" "}
        <code className="rounded bg-muted px-1 py-0.5">{"{{name}}"}</code>.
      </p>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {initial ? "Update" : "Create"}
        </button>
      </div>
    </div>
  );
}

function ActionValue({
  action,
  labels,
  agents,
  onChange,
}: {
  action: MacroAction;
  labels: Label[];
  agents: Agent[];
  onChange: (value: string) => void;
}) {
  if (action.type === "add_label" || action.type === "remove_label") {
    return (
      <select
        value={action.value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none"
      >
        {labels.length === 0 && <option value="">No labels</option>}
        {labels.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    );
  }
  if (action.type === "assign") {
    return (
      <select
        value={action.value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none"
      >
        <option value="">Unassigned</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.email}
          </option>
        ))}
      </select>
    );
  }
  if (action.type === "set_status") {
    return (
      <select
        value={action.value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none"
      >
        {MACRO_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    );
  }
  // send_message
  return (
    <input
      value={action.value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={actionNeedsValue(action.type) ? "Message text…" : "value"}
      className="min-w-[12rem] flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
    />
  );
}
