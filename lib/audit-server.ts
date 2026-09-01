// Server-side audit writer. Uses the service role because the audit_log RLS
// forbids member inserts. Kept separate from lib/audit.ts so the pure
// formatting helpers stay importable from client components.
import { createServiceClient } from "@/lib/supabase/server";
import type { RecordAuditInput } from "@/lib/audit";

/**
 * Append an entry to the audit log. Best-effort: never throws, so it can't
 * break the action it's recording.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    const supabase = await createServiceClient();
    await supabase.from("audit_log").insert({
      workspace_id: input.workspaceId,
      actor_id: input.actorId ?? null,
      actor_label: input.actorLabel ?? null,
      action: input.action,
      target_label: input.targetLabel ?? null,
      metadata: (input.metadata ?? null) as never,
    });
  } catch {
    // Audit logging must never fail the underlying operation.
  }
}
