"use client";

import { useI18n } from "@/components/i18n-provider";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Plus, Check, Copy, Power, Save } from "lucide-react";
import {
  createWebsiteWidget,
  setWidgetActive,
  setWidgetConfig,
} from "@/lib/actions/widgets";
import { parseWidgetConfig } from "@/lib/widget";

interface Widget {
  id: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  widget_config: unknown;
}

function WidgetConfigEditor({ widget }: { widget: Widget }) {
  const router = useRouter();
  const initial = parseWidgetConfig(widget.widget_config);
  const [prechat, setPrechat] = useState(initial.prechat);
  const [greeting, setGreeting] = useState(initial.greeting ?? "");
  const [proactive, setProactive] = useState(initial.proactive ?? "");
  const [proactiveDelay, setProactiveDelay] = useState(initial.proactiveDelay);
  const [starters, setStarters] = useState(initial.starters.join("\n"));
  const [away, setAway] = useState(initial.away);
  const [awayMessage, setAwayMessage] = useState(initial.awayMessage ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    await setWidgetConfig(widget.id, {
      prechat,
      greeting,
      proactive,
      proactiveDelay,
      starters: starters.split("\n"),
      away,
      awayMessage,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Pre-chat form
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={prechat}
          onChange={(e) => setPrechat(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Ask visitors for their name &amp; email before chatting
      </label>
      <input
        value={greeting}
        onChange={(e) => setGreeting(e.target.value)}
        placeholder="Greeting shown to visitors (optional)"
        className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />

      <p className="mb-2 mt-5 text-xs font-medium text-muted-foreground">
        Proactive message
      </p>
      <div className="flex items-start gap-2">
        <input
          value={proactive}
          onChange={(e) => setProactive(e.target.value)}
          placeholder="e.g. Hi! Need any help? 👋 (leave empty to disable)"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            value={proactiveDelay}
            onChange={(e) => setProactiveDelay(Number(e.target.value))}
            className="w-16 rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none focus:border-primary"
          />
          <span className="text-xs text-muted-foreground">sec</span>
        </div>
      </div>

      <p className="mb-2 mt-5 text-xs font-medium text-muted-foreground">
        Conversation starters
      </p>
      <textarea
        value={starters}
        onChange={(e) => setStarters(e.target.value)}
        placeholder={"One prompt per line (max 4), e.g.\nHow much does it cost?\nTrack my order\nTalk to sales"}
        rows={3}
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        Shown as tappable buttons when the chat is empty. First 4 lines are used.
      </p>

      <p className="mb-2 mt-5 text-xs font-medium text-muted-foreground">
        Availability
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={away}
          onChange={(e) => setAway(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Show an &ldquo;away&rdquo; status (agents currently offline)
      </label>
      <input
        value={awayMessage}
        onChange={(e) => setAwayMessage(e.target.value)}
        placeholder="Away message, e.g. We're away — leave a message and we'll email you back."
        className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />

      <div className="mt-3 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          {saved ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" /> Saved
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" /> Save settings
            </>
          )}
        </button>
      </div>
    </div>
  );
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
        <div className="mb-8 rounded-xl border border-border bg-card shadow-card p-5">
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
              <div key={w.id} className="rounded-xl border border-border bg-card shadow-card p-5">
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

                <WidgetConfigEditor widget={w} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
