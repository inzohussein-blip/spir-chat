"use client";

import { useState } from "react";
import { Users, Check, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/i18n-provider";

export function RoutingSection({
  workspaceId,
  initialAutoAssign,
  initialSlaMinutes,
  initialCsatEnabled,
  initialAgentCap,
  initialAutoCloseDays,
}: {
  workspaceId: string;
  initialAutoAssign: string;
  initialSlaMinutes: number;
  initialCsatEnabled: boolean;
  initialAgentCap: number;
  initialAutoCloseDays: number;
}) {
  const { t } = useI18n();
  const s = t.dash.settings;
  const [autoAssign, setAutoAssign] = useState(initialAutoAssign);
  const [slaMinutes, setSlaMinutes] = useState(initialSlaMinutes);
  const [csatEnabled, setCsatEnabled] = useState(initialCsatEnabled);
  const [agentCap, setAgentCap] = useState(initialAgentCap);
  const [autoCloseDays, setAutoCloseDays] = useState(initialAutoCloseDays);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    await createClient()
      .from("workspaces")
      .update({
        auto_assign: autoAssign === "round_robin" ? "round_robin" : "off",
        sla_minutes: Number.isFinite(slaMinutes) && slaMinutes > 0 ? Math.round(slaMinutes) : 0,
        csat_enabled: csatEnabled,
        agent_conversation_cap: Number.isFinite(agentCap) && agentCap > 0 ? Math.round(agentCap) : 0,
        auto_close_days:
          Number.isFinite(autoCloseDays) && autoCloseDays > 0 ? Math.round(autoCloseDays) : 0,
      })
      .eq("id", workspaceId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section>
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{s.routing.title}</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{s.routing.desc}</p>

      <div className="mt-4 space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {s.routing.autoAssign}
          </label>
          <select
            value={autoAssign}
            onChange={(e) => setAutoAssign(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="off">{s.routing.off}</option>
            <option value="round_robin">{s.routing.roundRobin}</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {s.routing.sla}
          </label>
          <input
            type="number"
            min={0}
            value={slaMinutes}
            onChange={(e) => setSlaMinutes(Number(e.target.value))}
            className="mt-1 w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">{s.routing.slaHint}</p>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {s.routing.cap}
          </label>
          <input
            type="number"
            min={0}
            value={agentCap}
            onChange={(e) => setAgentCap(Number(e.target.value))}
            className="mt-1 w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">{s.routing.capHint}</p>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {s.routing.autoClose}
          </label>
          <input
            type="number"
            min={0}
            value={autoCloseDays}
            onChange={(e) => setAutoCloseDays(Number(e.target.value))}
            className="mt-1 w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">{s.routing.autoCloseHint}</p>
        </div>

        <label className="flex items-start gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={csatEnabled}
            onChange={(e) => setCsatEnabled(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border"
          />
          <span>
            {s.routing.csat}
            <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
              {s.routing.csatHint}
            </span>
          </span>
        </label>

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {saved ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" /> {s.saved}
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" /> {s.save}
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
