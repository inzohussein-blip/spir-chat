"use client";

import { useState } from "react";
import { LineChart, Check, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/i18n-provider";

export function WeeklyReportSection({
  workspaceId,
  initialEmail,
}: {
  workspaceId: string;
  initialEmail: string | null;
}) {
  const { t } = useI18n();
  const s = t.dash.settings;
  const [email, setEmail] = useState(initialEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    await createClient()
      .from("workspaces")
      .update({ weekly_report_email: email.trim() || null })
      .eq("id", workspaceId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section>
      <div className="flex items-center gap-2">
        <LineChart className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{s.weekly.title}</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{s.weekly.desc}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-5 shadow-card">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
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
    </section>
  );
}
