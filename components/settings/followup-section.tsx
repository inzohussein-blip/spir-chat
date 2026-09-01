"use client";

import { useState } from "react";
import { MessageCircle, Check, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function FollowupSection({
  workspaceId,
  initialMinutes,
  initialMessage,
}: {
  workspaceId: string;
  initialMinutes: number;
  initialMessage: string | null;
}) {
  const [minutes, setMinutes] = useState(initialMinutes);
  const [message, setMessage] = useState(initialMessage ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    await createClient()
      .from("workspaces")
      .update({
        visitor_followup_minutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0,
        visitor_followup_message: message.trim() ? message.trim().slice(0, 500) : null,
      })
      .eq("id", workspaceId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section>
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Visitor follow-up</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        If a website visitor goes quiet after being replied to, send one
        follow-up nudge. Set minutes to 0 to turn it off.
      </p>

      <div className="mt-4 space-y-3 rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            Follow up after
          </label>
          <input
            type="number"
            min={0}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <span className="text-xs text-muted-foreground">minutes of silence</span>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder="Still there? Let me know if there's anything else I can help with 🙂"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="flex justify-end">
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
      </div>
    </section>
  );
}
