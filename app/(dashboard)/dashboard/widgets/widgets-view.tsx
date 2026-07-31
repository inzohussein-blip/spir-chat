"use client";

import { useI18n } from "@/components/i18n-provider";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Plus, Check, Copy, Power } from "lucide-react";
import { createWebsiteWidget, setWidgetActive } from "@/lib/actions/widgets";

interface Widget {
  id: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
}

export function WidgetsView({
  widgets,
  appUrl,
}: {
  widgets: Widget[];
  appUrl: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fall back to the current origin when NEXT_PUBLIC_APP_URL isn't set.
  const base =
    appUrl || (typeof window !== "undefined" ? window.location.origin : "");

  function snippet(channelId: string) {
    return `<script src="${base}/widget.js" data-spirchat="${channelId}" async></script>`;
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setError(null);
    const res = await createWebsiteWidget(trimmed);
    setCreating(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setName("");
    router.refresh();
  }

  async function copy(channelId: string) {
    try {
      await navigator.clipboard.writeText(snippet(channelId));
      setCopiedId(channelId);
      setTimeout(() => setCopiedId((c) => (c === channelId ? null : c)), 2000);
    } catch {
      // clipboard may be unavailable; ignore
    }
  }

  async function toggle(channelId: string, next: boolean) {
    await setWidgetActive(channelId, next);
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t.dash.widgets.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.dash.widgets.subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {/* Create */}
        <div className="mb-8 rounded-xl border border-border bg-card p-5">
          <label className="text-sm font-medium">Create a widget</label>
          <div className="mt-2 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Main website"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Create
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </div>

        {/* List */}
        {widgets.length === 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-border p-12 text-center">
            <Globe className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">No widgets yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a widget above, then paste its snippet into your site.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {widgets.map((w) => (
              <div key={w.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium">{w.display_name}</h3>
                      <span
                        className={
                          "text-xs " +
                          (w.is_active ? "text-emerald-600" : "text-muted-foreground")
                        }
                      >
                        {w.is_active ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(w.id, !w.is_active)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    <Power className="h-3.5 w-3.5" />
                    {w.is_active ? "Disable" : "Enable"}
                  </button>
                </div>

                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Embed snippet
                  </p>
                  <div className="flex items-start gap-2">
                    <code className="flex-1 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs">
                      {snippet(w.id)}
                    </code>
                    <button
                      onClick={() => copy(w.id)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                    >
                      {copiedId === w.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
