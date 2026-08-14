import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HelpCenterPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createServiceClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("slug", slug)
    .single();
  if (!workspace) notFound();

  const { data: articles } = await supabase
    .from("kb_articles")
    .select("title, slug, category")
    .eq("workspace_id", workspace.id)
    .eq("is_published", true)
    .order("category", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true });

  // Group by category for a tidy help-center layout.
  const groups = new Map<string, { title: string; slug: string }[]>();
  for (const a of articles ?? []) {
    const key = a.category || "General";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ title: a.title, slug: a.slug });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-br from-violet-600 to-cyan-500 px-6 py-14 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 text-sm text-white/80">
            <BookOpen className="h-4 w-4" /> Help Center
          </div>
          <h1 className="mt-2 text-3xl font-bold">{workspace.name}</h1>
          <p className="mt-1 text-white/80">
            Answers and guides to help you get the most out of us.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-10">
        {(articles ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No articles published yet.</p>
        ) : (
          <div className="space-y-8">
            {[...groups.entries()].map(([category, items]) => (
              <section key={category}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </h2>
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-card">
                  {items.map((a) => (
                    <Link
                      key={a.slug}
                      href={`/help/${slug}/${a.slug}`}
                      className="block px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
                    >
                      {a.title}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
