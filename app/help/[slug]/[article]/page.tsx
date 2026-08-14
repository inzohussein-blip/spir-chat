import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string; article: string }>;
}) {
  const { slug, article } = await params;
  const supabase = await createServiceClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("slug", slug)
    .single();
  if (!workspace) notFound();

  const { data: doc } = await supabase
    .from("kb_articles")
    .select("title, category, body, is_published, updated_at")
    .eq("workspace_id", workspace.id)
    .eq("slug", article)
    .single();
  if (!doc || !doc.is_published) notFound();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link
          href={`/help/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {workspace.name} Help Center
        </Link>

        <article className="mt-6">
          {doc.category && (
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {doc.category}
            </p>
          )}
          <h1 className="mt-1 text-3xl font-bold">{doc.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Updated {new Date(doc.updated_at).toLocaleDateString()}
          </p>
          <div className="mt-6 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
            {doc.body}
          </div>
        </article>
      </div>
    </div>
  );
}
