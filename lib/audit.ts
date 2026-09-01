// Audit log — pure types and formatting for consequential workspace actions.
// The server-side writer lives in lib/audit-server.ts (service role); this
// module has no server imports so the viewer can use `describeAudit` safely.

export type AuditAction =
  | "contact.erased"
  | "contacts.deleted"
  | "member.removed"
  | "member.invited"
  | "campaign.sent"
  | "settings.updated";

export interface AuditEntry {
  action: string;
  actorLabel?: string | null;
  targetLabel?: string | null;
}

const ACTION_VERB: Record<string, string> = {
  "contact.erased": "erased contact",
  "contacts.deleted": "deleted contacts",
  "member.removed": "removed member",
  "member.invited": "invited member",
  "campaign.sent": "sent campaign",
  "settings.updated": "updated settings",
};

/** A readable one-line description: "Omar erased contact “Sara Ali”". */
export function describeAudit(entry: AuditEntry): string {
  const actor = entry.actorLabel?.trim() || "Someone";
  const verb = ACTION_VERB[entry.action] ?? entry.action.replace(/[._]/g, " ");
  const target = entry.targetLabel?.trim();
  return target ? `${actor} ${verb} “${target}”` : `${actor} ${verb}`;
}

export interface RecordAuditInput {
  workspaceId: string;
  actorId?: string | null;
  actorLabel?: string | null;
  action: AuditAction;
  targetLabel?: string | null;
  metadata?: Record<string, unknown> | null;
}
