"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tags, Plus, Trash2, ArrowRight } from "lucide-react";
import { createLabelRule, deleteLabelRule } from "@/lib/actions/label-rules";

interface Label {
  id: string;
  name: string;
  color: string | null;
}
interface Rule {
  id: string;
  keyword: string;
  label_id: string;
}

export function LabelRulesSection({
  labels,
  rules,
}: {
  labels: Label[];
  rules: Rule[];
}) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [labelId, setLabelId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labelName = (id: string) => labels.find((l) => l.id === id)?.name ?? "—";

  async function add() {
    if (!keyword.trim() || !labelId || busy) return;
    setBusy(true);
    setError(null);
    const res = await createLabelRule(keyword, labelId);
    setBusy(false);
    if (res.error) return setError(res.error);
    setKeyword("");
    router.refresh();
  }

  return (
    <section>
      <div className="flex items-center gap-2">
        <Tags className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Auto-labeling</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        When an incoming message contains a keyword, its label is added to the
        conversation automatically.
      </p>

      <div className="mt-4 space-y-3 rounded-xl border border-border bg-card p-5 shadow-card">
        {labels.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Create a label in the inbox first, then add rules here.
          </p>
        ) : (
          <>
            {rules.length > 0 && (
              <div className="space-y-2">
                {rules.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      &ldquo;{r.keyword}&rdquo;
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{labelName(r.label_id)}</span>
                    <button
                      onClick={async () => {
                        await deleteLabelRule(r.id);
                        router.refresh();
                      }}
                      aria-label="Delete rule"
                      className="ms-auto rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Keyword, e.g. refund"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <select
                value={labelId}
                onChange={(e) => setLabelId(e.target.value)}
                className="rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none"
              >
                <option value="">Label…</option>
                {labels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <button
                onClick={add}
                disabled={!keyword.trim() || !labelId || busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add rule
              </button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </>
        )}
      </div>
    </section>
  );
}
