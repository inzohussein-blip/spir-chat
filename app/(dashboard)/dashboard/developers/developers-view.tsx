"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Code2,
  Plus,
  Trash2,
  Copy,
  Check,
  KeyRound,
  Webhook,
  Power,
} from "lucide-react";
import {
  createApiKey,
  deleteApiKey,
  createWebhook,
  deleteWebhook,
  toggleWebhook,
} from "@/lib/actions/developers";
import { WEBHOOK_EVENTS } from "@/lib/webhook-events";
import { PageTitle } from "@/components/page-title";
import { cn } from "@/lib/utils";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}
interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export function DevelopersView({
  apiKeys,
  webhooks,
  baseUrl,
}: {
  apiKeys: ApiKey[];
  webhooks: WebhookRow[];
  baseUrl: string;
}) {
  const router = useRouter();
  const [keyName, setKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<string[]>([...WEBHOOK_EVENTS]);
  const [creatingHook, setCreatingHook] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateKey() {
    if (!keyName.trim() || creatingKey) return;
    setCreatingKey(true);
    setError(null);
    const res = await createApiKey(keyName.trim());
    setCreatingKey(false);
    if (res.error) return setError(res.error);
    setNewKey(res.plaintext ?? null);
    setKeyName("");
    router.refresh();
  }

  async function handleCreateHook() {
    if (!hookUrl.trim() || creatingHook) return;
    setCreatingHook(true);
    setError(null);
    const res = await createWebhook(hookUrl.trim(), hookEvents);
    setCreatingHook(false);
    if (res.error) return setError(res.error);
    setHookUrl("");
    router.refresh();
  }

  async function copyKey() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <PageTitle
          icon={Code2}
          title="Developers"
          subtitle="API keys and webhooks to integrate SpirChat with your stack."
        />
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-8">
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {/* API base URL */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="h-4 w-4 text-primary" /> REST API
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Authenticate with{" "}
              <code className="rounded bg-muted px-1">Authorization: Bearer &lt;key&gt;</code>.
              Base URL:
            </p>
            <code className="mt-2 block overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs">
              {baseUrl}/api/public/v1
            </code>
            <p className="mt-2 text-xs text-muted-foreground">
              Endpoints: <code className="rounded bg-muted px-1">GET/POST /contacts</code>,{" "}
              <code className="rounded bg-muted px-1">GET /conversations</code>
            </p>
          </div>

          {/* Newly created key banner */}
          {newKey && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                Copy your new key now — it won&apos;t be shown again.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-lg bg-background px-3 py-2 text-xs">
                  {newKey}
                </code>
                <button
                  onClick={copyKey}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                >
                  {copied ? (
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
          )}

          {/* API keys */}
          <div>
            <h2 className="mb-2 text-sm font-semibold">API keys</h2>
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex gap-2">
                <input
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateKey()}
                  placeholder="Key name (e.g. Zapier)"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={handleCreateKey}
                  disabled={creatingKey || !keyName.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> Create
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {apiKeys.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No API keys yet.</p>
                ) : (
                  apiKeys.map((k) => (
                    <div
                      key={k.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{k.name}</p>
                        <p className="text-xs text-muted-foreground">
                          <code>{k.key_prefix}…</code>
                          {k.last_used_at
                            ? ` · last used ${new Date(k.last_used_at).toLocaleDateString()}`
                            : " · never used"}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          await deleteApiKey(k.id);
                          router.refresh();
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Revoke key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Webhooks */}
          <div>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Webhook className="h-4 w-4 text-primary" /> Webhooks
            </h2>
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <input
                value={hookUrl}
                onChange={(e) => setHookUrl(e.target.value)}
                placeholder="https://your-app.com/webhooks/spirchat"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {WEBHOOK_EVENTS.map((ev) => {
                  const on = hookEvents.includes(ev);
                  return (
                    <button
                      key={ev}
                      type="button"
                      onClick={() =>
                        setHookEvents((prev) =>
                          on ? prev.filter((e) => e !== ev) : [...prev, ev]
                        )
                      }
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        on
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {ev}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleCreateHook}
                  disabled={creatingHook || !hookUrl.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> Add endpoint
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {webhooks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No webhook endpoints. Payloads are signed with an HMAC-SHA256{" "}
                    <code>X-SpirChat-Signature</code> header.
                  </p>
                ) : (
                  webhooks.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{w.url}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {w.events.length ? w.events.join(", ") : "all events"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={async () => {
                            await toggleWebhook(w.id, !w.is_active);
                            router.refresh();
                          }}
                          title={w.is_active ? "Disable" : "Enable"}
                          className={cn(
                            "rounded-md p-1.5",
                            w.is_active
                              ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                        <button
                          onClick={async () => {
                            await deleteWebhook(w.id);
                            router.refresh();
                          }}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Delete endpoint"
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
        </div>
      </div>
    </div>
  );
}
