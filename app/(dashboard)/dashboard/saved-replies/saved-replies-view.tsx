"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Plus, Trash2 } from "lucide-react";
import { createCannedResponse, deleteCannedResponse } from "@/lib/actions/canned";

interface Reply {
  id: string;
  short_code: string;
  content: string;
}

export function SavedRepliesView({ replies }: { replies: Reply[] }) {
  const router = useRouter();
  const [shortCode, setShortCode] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!shortCode.trim() || !content.trim() || saving) return;
    setSaving(true);
    setError(null);
    const res = await createCannedResponse(shortCode, content);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setShortCode("");
    setContent("");
    router.refresh();
  }

  async function handleDelete(id: string) {
    await deleteCannedResponse(id);
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <h1 className="text-2xl font-bold">Saved replies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reusable replies your team can insert in the inbox with one click.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {/* Create */}
        <div className="mb-8 rounded-xl border border-border bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <div>
              <label className="text-sm font-medium">Short code</label>
              <div className="mt-1 flex items-center rounded-lg border border-border bg-background ps-2">
                <span className="text-sm text-muted-foreground">/</span>
                <input
                  value={shortCode}
                  onChange={(e) => setShortCode(e.target.value)}
                  placeholder="hi"
                  className="w-full bg-transparent px-1 py-2 text-sm outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Reply</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Hi! Thanks for reaching out — how can we help?"
                rows={2}
                className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            {error ? (
              <p className="text-xs text-red-500">{error}</p>
            ) : (
              <span className="text-xs text-muted-foreground">
                Type <code className="rounded bg-muted px-1">/{shortCode || "code"}</code> in the inbox to find it.
              </span>
            )}
            <button
              onClick={handleCreate}
              disabled={saving || !shortCode.trim() || !content.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add reply
            </button>
          </div>
        </div>

        {/* List */}
        {replies.length === 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-border p-12 text-center">
            <MessageSquareText className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">No saved replies yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Add your first reply above to speed up inbox conversations.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {replies.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
                <div className="min-w-0">
                  <span className="inline-flex rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                    /{r.short_code}
                  </span>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {r.content}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(r.id)}
                  aria-label="Delete reply"
                  className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
