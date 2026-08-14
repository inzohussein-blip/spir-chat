"use client";

import { useState } from "react";
import { Clock, Check, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { BusinessHours, DayHours } from "@/lib/business-hours";
import type { Json } from "@/lib/types/database";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// A short, curated timezone list covering the Arabic market + common zones.
const TIMEZONES = [
  "Asia/Baghdad",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Kuwait",
  "Asia/Qatar",
  "Asia/Amman",
  "Asia/Beirut",
  "Africa/Cairo",
  "Africa/Casablanca",
  "Europe/Istanbul",
  "Europe/London",
  "America/New_York",
  "UTC",
];

export function BusinessHoursSection({
  workspaceId,
  initial,
}: {
  workspaceId: string;
  initial: BusinessHours;
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [days, setDays] = useState<DayHours[]>(initial.days);
  const [replyOffline, setReplyOffline] = useState(initial.replyOffline ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateDay(i: number, patch: Partial<DayHours>) {
    setDays((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    await createClient()
      .from("workspaces")
      .update({
        business_hours: {
          enabled,
          timezone,
          days,
          replyOffline: replyOffline.trim().slice(0, 500),
          replyOnline: initial.replyOnline,
        } as unknown as Json,
      })
      .eq("id", workspaceId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Business hours &amp; auto-reply</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Outside these hours, the website widget shows an away status and sends
        your offline auto-reply on the visitor&apos;s first message.
      </p>

      <div className="mt-4 rounded-xl border border-border bg-card p-5 shadow-card">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Enable business hours
        </label>

        <div className={cn("mt-4 space-y-4", !enabled && "opacity-50")}>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Timezone
            </label>
            <select
              value={timezone}
              disabled={!enabled}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            {days.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <label className="flex w-24 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={d.open}
                    disabled={!enabled}
                    onChange={(e) => updateDay(i, { open: e.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  {DAY_LABELS[i]}
                </label>
                <input
                  type="time"
                  value={d.from}
                  disabled={!enabled || !d.open}
                  onChange={(e) => updateDay(i, { from: e.target.value })}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary disabled:opacity-40"
                />
                <span className="text-xs text-muted-foreground">→</span>
                <input
                  type="time"
                  value={d.to}
                  disabled={!enabled || !d.open}
                  onChange={(e) => updateDay(i, { to: e.target.value })}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary disabled:opacity-40"
                />
                {!d.open && (
                  <span className="text-xs text-muted-foreground">Closed</span>
                )}
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Offline auto-reply
            </label>
            <textarea
              value={replyOffline}
              disabled={!enabled}
              onChange={(e) => setReplyOffline(e.target.value)}
              rows={2}
              placeholder="We're closed right now — leave a message and we'll get back to you."
              className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
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
                <Save className="h-3.5 w-3.5" /> Save hours
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
