"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Plus, Copy, Check, Trash2, MousePointerClick } from "lucide-react";
import { createTrackedLink, deleteTrackedLink } from "@/lib/actions/tracking";
import { PageTitle } from "@/components/page-title";

interface LinkRow {
  id: string;
  slug: string;
  label: string | null;
  destinationUrl: string;
  campaignName: string | null;
  clicks: number;
  uniqueClicks: number;
  lastClick: string | null;
  ctr: number | null;
}

export function LinksView({
  links,
  baseUrl,
}: {
  links: LinkRow[];
  baseUrl: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleCreate() {
    if (!url.trim() || creating) return;
    setCreating(true);
    setError(null);
    const res = await createTrackedLink({ destinationUrl: url, label });
    setCreating(false);
    if (res.error) return setError(res.error);
    setUrl("");
    setLabel("");
    router.refresh();
  }

  async function copy(slug: string) {
    try {
      await navigator.clipboard.writeText(`${baseUrl}/r/${slug}`);
      setCopied(slug);
      setTimeout(() => setCopied((s) => (s === slug ? null : s)), 2000);
    } catch {
      /* ignore */
    }
  }

  const totalClicks = links.reduce((a, l) => a + l.clicks, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <PageTitle
          icon={Link2}
          title="Tracked Links"
          subtitle="Short links that count clicks and CTR — drop them in campaigns or DMs."
        />
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Create */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="https://destination-url.com/page"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label (optional)"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:w-40"
              />
              <button
                onClick={handleCreate}
                disabled={creating || !url.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Create
              </button>
            </div>
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
            {links.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {links.length} link{links.length !== 1 ? "s" : ""} · {totalClicks} total
                click{totalClicks !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          {/* List */}
          {links.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Link2 className="h-8 w-8 text-primary" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">No tracked links yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {links.map((l) => (
                <div
                  key={l.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                          /r/{l.slug}
                        </code>
                        {l.label && (
                          <span className="text-sm font-medium">{l.label}</span>
                        )}
                        {l.campaignName && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {l.campaignName}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        → {l.destinationUrl}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <button
                        onClick={() => copy(l.slug)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        {copied === l.slug ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" /> Copy
                          </>
                        )}
                      </button>
                      <button
                        onClick={async () => {
                          await deleteTrackedLink(l.id);
                          router.refresh();
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete link"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-xs">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <MousePointerClick className="h-3.5 w-3.5 text-primary" />
                      {l.clicks} click{l.clicks !== 1 ? "s" : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {l.uniqueClicks} unique
                    </span>
                    {l.ctr != null && (
                      <span className="text-muted-foreground">{l.ctr}% CTR</span>
                    )}
                    {l.lastClick && (
                      <span className="text-muted-foreground">
                        last {new Date(l.lastClick).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
