"use client";

import { useState } from "react";
import { Sparkles, Check, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function AiRepliesSection({
  workspaceId,
  initialEnabled,
}: {
  workspaceId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    await createClient()
      .from("workspaces")
      .update({ ai_replies_enabled: enabled })
      .eq("id", workspaceId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section>
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">AI auto-reply</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Answer website visitors automatically from your published Help Center
        articles. The bot only replies when it&apos;s confident and the chat
        isn&apos;t already assigned to an agent. Needs an AI key (workspace or
        the AI_GATEWAY_API_KEY environment variable).
      </p>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card p-5 shadow-card">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Answer from Help Center
        </label>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          {saved ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" /> Saved
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" /> Save
            </>
          )}
        </button>
      </div>
    </section>
  );
}
