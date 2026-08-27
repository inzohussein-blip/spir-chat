import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { CsatForm } from "./csat-form";

export const dynamic = "force-dynamic";

export default async function CsatPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createServiceClient();

  const { data: survey } = await supabase
    .from("csat_surveys")
    .select("token, status, rating, feedback, workspace_id")
    .eq("token", token)
    .maybeSingle();
  if (!survey) notFound();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", survey.workspace_id)
    .maybeSingle();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-card">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 text-lg font-bold text-white">
            {(workspace?.name ?? "S").charAt(0).toUpperCase()}
          </div>
          <h1 className="text-lg font-bold tracking-tight">
            {workspace?.name ?? "SpirChat"}
          </h1>
        </div>
        <CsatForm
          token={survey.token}
          initialRating={survey.rating}
          initialFeedback={survey.feedback}
          alreadyResponded={survey.status === "responded"}
        />
      </div>
    </div>
  );
}
