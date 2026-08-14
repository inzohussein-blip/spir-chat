"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Save,
  Check,
} from "lucide-react";
import {
  createArticle,
  updateArticle,
  togglePublish,
  deleteArticle,
} from "@/lib/actions/kb";
import { PageTitle } from "@/components/page-title";
import { cn } from "@/lib/utils";

interface Article {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  body: string;
  is_published: boolean;
  updated_at: string;
}

export function HelpCenterView({
  articles,
  publicBase,
}: {
  articles: Article[];
  publicBase: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    articles[0]?.id ?? null
  );
  const [creating, setCreating] = useState(false);
  const selected = articles.find((a) => a.id === selectedId) ?? null;

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    const res = await createArticle({ title: "Untitled article" });
    setCreating(false);
    if (res.id) setSelectedId(res.id);
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center justify-between">
          <PageTitle
            icon={BookOpen}
            title="Help Center"
            subtitle="Public knowledge base articles your customers can search."
          />
          <a
            href={publicBase}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" /> View site
          </a>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Article list */}
        <div className="flex w-72 flex-shrink-0 flex-col border-e border-border">
          <div className="p-3">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> New article
            </button>
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {articles.length === 0 ? (
              <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                No articles yet.
              </p>
            ) : (
              articles.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-start transition-colors",
                    selectedId === a.id ? "bg-accent" : "hover:bg-muted"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.category || "Uncategorized"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "mt-0.5 h-2 w-2 flex-shrink-0 rounded-full",
                      a.is_published ? "bg-emerald-500" : "bg-muted-foreground/40"
                    )}
                    title={a.is_published ? "Published" : "Draft"}
                  />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {selected ? (
            <ArticleEditor
              key={selected.id}
              article={selected}
              publicBase={publicBase}
              onChanged={() => router.refresh()}
              onDeleted={() => {
                setSelectedId(null);
                router.refresh();
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select or create an article.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArticleEditor({
  article,
  publicBase,
  onChanged,
  onDeleted,
}: {
  article: Article;
  publicBase: string;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(article.title);
  const [category, setCategory] = useState(article.category ?? "");
  const [body, setBody] = useState(article.body);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    await updateArticle(article.id, { title, category, body });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onChanged();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              await togglePublish(article.id, !article.is_published);
              onChanged();
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
              article.is_published
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {article.is_published ? (
              <>
                <Eye className="h-3.5 w-3.5" /> Published
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5" /> Draft
              </>
            )}
          </button>
          {article.is_published && (
            <a
              href={`${publicBase}/${article.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" /> /{article.slug}
            </a>
          )}
        </div>
        <button
          onClick={async () => {
            await deleteArticle(article.id);
            onDeleted();
          }}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Delete article"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Article title"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-lg font-semibold outline-none focus:border-primary"
      />
      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Category (optional)"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your article… (Markdown supported)"
        rows={16}
        className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary"
      />

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" /> Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Save
            </>
          )}
        </button>
      </div>
    </div>
  );
}
