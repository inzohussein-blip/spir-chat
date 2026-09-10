"use client";

import { useEffect, useState } from "react";
import { ScrollText, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { describeAudit } from "@/lib/audit";
import { useI18n } from "@/components/i18n-provider";

interface AuditRow {
  id: string;
  action: string;
  actor_label: string | null;
  target_label: string | null;
  created_at: string;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditLogSection({ workspaceId }: { workspaceId: string }) {
  const { t } = useI18n();
  const s = t.dash.settings;
  const [rows, setRows] = useState<AuditRow[] | null>(null);

  useEffect(() => {
    let active = true;
    createClient()
      .from("audit_log")
      .select("id, action, actor_label, target_label, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (active) setRows((data as AuditRow[]) ?? []);
      });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  return (
    <section>
      <div className="flex items-center gap-2">
        <ScrollText className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{s.audit.title}</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{s.audit.desc}</p>

      <div className="mt-4 rounded-xl border border-border bg-card shadow-card">
        {rows === null ? (
          <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {s.audit.loading}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{s.audit.empty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate">
                  {describeAudit({
                    action: r.action,
                    actorLabel: r.actor_label,
                    targetLabel: r.target_label,
                  })}
                </span>
                <span className="flex-shrink-0 text-xs text-muted-foreground">
                  {formatWhen(r.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
