"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Filter, Plus, Trash2, Save, X, Users, Megaphone } from "lucide-react";
import {
  createSegment,
  updateSegment,
  deleteSegment,
  countSegment,
} from "@/lib/actions/segments";
import {
  FIELD_LABELS,
  FIELD_KIND,
  operatorsFor,
  type SegmentField,
  type SegmentOperator,
  type SegmentRule,
} from "@/lib/segments";
import { PageTitle } from "@/components/page-title";
import { cn } from "@/lib/utils";

interface Segment {
  id: string;
  name: string;
  rules: SegmentRule[];
}

const OP_LABELS: Record<SegmentOperator, string> = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  is_set: "is set",
  is_not_set: "is not set",
  is_true: "is yes",
  is_false: "is no",
  before: "before",
  after: "after",
  in_last_days: "in last (days)",
};

const FIELDS = Object.keys(FIELD_LABELS) as SegmentField[];

export function SegmentsView({ segments }: { segments: Segment[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Segment | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center justify-between">
          <PageTitle
            icon={Filter}
            title="Segments"
            subtitle="Saved audience filters you can target with campaigns."
          />
          <button
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> New segment
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {(creating || editing) && (
            <SegmentBuilder
              initial={editing}
              onClose={() => {
                setCreating(false);
                setEditing(null);
              }}
              onSaved={() => {
                setCreating(false);
                setEditing(null);
                router.refresh();
              }}
            />
          )}

          {segments.length === 0 && !creating ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Filter className="h-8 w-8 text-primary" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">No segments yet.</p>
            </div>
          ) : (
            segments.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {s.rules.length} rule{s.rules.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <Link
                    href={`/dashboard/campaigns?segment=${s.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                  >
                    <Megaphone className="h-3.5 w-3.5" /> Campaign
                  </Link>
                  <button
                    onClick={() => {
                      setCreating(false);
                      setEditing(s);
                    }}
                    className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      await deleteSegment(s.id);
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

function SegmentBuilder({
  initial,
  onClose,
  onSaved,
}: {
  initial: Segment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [rules, setRules] = useState<SegmentRule[]>(
    initial?.rules.length ? initial.rules : [{ field: "is_subscribed", operator: "is_true" }]
  );
  const [count, setCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Live count (debounced).
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await countSegment(rules);
      if (!cancelled) setCount(res.count ?? null);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [rules]);

  function updateRule(i: number, patch: Partial<SegmentRule>) {
    setRules((prev) =>
      prev.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, ...patch };
        // Keep the operator valid for the field.
        if (patch.field && !operatorsFor(patch.field).includes(next.operator)) {
          next.operator = operatorsFor(patch.field)[0];
        }
        return next;
      })
    );
  }

  async function save() {
    setSaving(true);
    if (initial) await updateSegment(initial.id, name, rules);
    else await createSegment(name, rules);
    setSaving(false);
    onSaved();
  }

  const needsValue = (op: SegmentOperator) =>
    !["is_set", "is_not_set", "is_true", "is_false"].includes(op);

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{initial ? "Edit segment" : "New segment"}</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Segment name"
        className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />

      <div className="space-y-2">
        {rules.map((rule, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select
              value={rule.field}
              onChange={(e) => updateRule(i, { field: e.target.value as SegmentField })}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none"
            >
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {FIELD_LABELS[f]}
                </option>
              ))}
            </select>
            <select
              value={rule.operator}
              onChange={(e) => updateRule(i, { operator: e.target.value as SegmentOperator })}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none"
            >
              {operatorsFor(rule.field).map((op) => (
                <option key={op} value={op}>
                  {OP_LABELS[op]}
                </option>
              ))}
            </select>
            {needsValue(rule.operator) && (
              <input
                type={FIELD_KIND[rule.field] === "date" && rule.operator !== "in_last_days" ? "date" : "text"}
                value={rule.value ?? ""}
                onChange={(e) => updateRule(i, { value: e.target.value })}
                placeholder="value"
                className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
            )}
            <button
              onClick={() => setRules((prev) => prev.filter((_, j) => j !== i))}
              className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          onClick={() => setRules((prev) => [...prev, { field: "email", operator: "is_set" }])}
          className="text-xs font-medium text-primary hover:underline"
        >
          + Add rule
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", count === null && "text-muted-foreground")}>
          <Users className="h-4 w-4 text-primary" />
          {count === null ? "…" : `${count} matching contact${count !== 1 ? "s" : ""}`}
        </span>
        <div className="flex gap-2">
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
    </div>
  );
}
