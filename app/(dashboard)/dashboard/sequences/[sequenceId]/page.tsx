import { getWorkspace } from "@/lib/workspace";
import { notFound } from "next/navigation";
import { SequenceEditor } from "@/components/sequences/sequence-editor";
import { EnrollmentList } from "@/components/sequences/enrollment-list";
import { EnrollSegment } from "@/components/sequences/enroll-segment";
import type { SequenceStep } from "@/lib/types/database";

export default async function SequenceDetailPage({
  params,
}: {
  params: Promise<{ sequenceId: string }>;
}) {
  const { sequenceId } = await params;
  const { workspace, supabase } = await getWorkspace();

  const { data: sequence } = await supabase
    .from("sequences")
    .select("*")
    .eq("id", sequenceId)
    .eq("workspace_id", workspace.id)
    .single();

  if (!sequence) {
    notFound();
  }

  const [{ data: enrollments }, { data: segments }] = await Promise.all([
    supabase
      .from("sequence_enrollments")
      .select("*, contacts(display_name, email)")
      .eq("sequence_id", sequenceId)
      .order("enrolled_at", { ascending: false }),
    supabase
      .from("segments")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .order("name", { ascending: true }),
  ]);

  return (
    <div className="flex h-full flex-col">
      <SequenceEditor
        sequence={{
          id: sequence.id,
          name: sequence.name,
          description: sequence.description,
          status: sequence.status as "draft" | "active" | "paused",
          steps: (sequence.steps as unknown as SequenceStep[]) || [],
        }}
      />
      <EnrollSegment
        sequenceId={sequence.id}
        segments={segments ?? []}
        active={sequence.status === "active"}
      />
      <div className="border-t border-border">
        <EnrollmentList
          enrollments={
            (enrollments ?? []).map((e) => ({
              id: e.id,
              contactName:
                (e.contacts as { display_name: string | null; email: string | null } | null)
                  ?.display_name ||
                (e.contacts as { display_name: string | null; email: string | null } | null)
                  ?.email ||
                "Unknown",
              currentStepIndex: e.current_step_index,
              status: e.status as "active" | "completed" | "cancelled",
              enrolledAt: e.enrolled_at,
            }))
          }
        />
      </div>
    </div>
  );
}
