// Agent performance aggregation. Pure + testable; the Reports page feeds it
// raw rows and renders the result.

export interface AgentMember {
  id: string;
  email: string;
}

export interface AgentStat {
  id: string;
  email: string;
  assigned: number;
  open: number;
  resolved: number;
  replies: number;
  csatAvg: number | null;
  csatResponses: number;
}

/**
 * Aggregate per-agent stats. `conversations` supplies assignment + status,
 * `replies` is a list of outbound-message author ids, and `surveys` carries
 * each responded rating with the agent who was assigned to that conversation.
 */
export function agentStats(
  members: AgentMember[],
  conversations: { assigned_to: string | null; status: string }[],
  replies: { sent_by_user_id: string | null }[],
  surveys: { agentId: string | null; rating: number | null }[]
): AgentStat[] {
  const base = new Map<string, AgentStat>();
  for (const m of members) {
    base.set(m.id, {
      id: m.id,
      email: m.email,
      assigned: 0,
      open: 0,
      resolved: 0,
      replies: 0,
      csatAvg: null,
      csatResponses: 0,
    });
  }

  for (const c of conversations) {
    if (!c.assigned_to) continue;
    const s = base.get(c.assigned_to);
    if (!s) continue;
    s.assigned += 1;
    if (c.status === "open") s.open += 1;
    else if (c.status === "closed") s.resolved += 1;
  }

  for (const r of replies) {
    if (!r.sent_by_user_id) continue;
    const s = base.get(r.sent_by_user_id);
    if (s) s.replies += 1;
  }

  const csatSum = new Map<string, number>();
  for (const sv of surveys) {
    if (!sv.agentId || sv.rating == null || sv.rating < 1 || sv.rating > 5) continue;
    const s = base.get(sv.agentId);
    if (!s) continue;
    s.csatResponses += 1;
    csatSum.set(sv.agentId, (csatSum.get(sv.agentId) ?? 0) + Math.round(sv.rating));
  }
  for (const s of base.values()) {
    if (s.csatResponses > 0) {
      s.csatAvg = Math.round((csatSum.get(s.id)! / s.csatResponses) * 10) / 10;
    }
  }

  // Busiest agents first.
  return [...base.values()].sort((a, b) => b.assigned - a.assigned || b.replies - a.replies);
}
