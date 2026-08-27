"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, UserPlus, Loader2 } from "lucide-react";
import { enrollSegment } from "@/lib/actions/sequences";

export function EnrollSegment({
  sequenceId,
  segments,
  active,
}: {
  sequenceId: string;
  segments: { id: string; name: string }[];
  active: boolean;
}) {
  const router = useRouter();
  const [segmentId, setSegmentId] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleEnroll() {
    if (!segmentId || enrolling) return;
    setEnrolling(true);
    setError(null);
    setMessage(null);
    const res = await enrollSegment(sequenceId, segmentId);
    setEnrolling(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    const parts = [`${res.enrolled} enrolled`];
    if (res.skipped) parts.push(`${res.skipped} already in`);
    if (res.noChannel) parts.push(`${res.noChannel} unreachable`);
    setMessage(parts.join(" · "));
    router.refresh();
  }

  if (segments.length === 0) return null;

  return (
    <div className="border-t border-border px-6 py-4">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-primary" />
        <div className="relative flex-1 max-w-xs">
          <select
            value={segmentId}
            onChange={(e) => setSegmentId(e.target.value)}
            disabled={!active}
            className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
          >
            <option value="">Enroll a segment…</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleEnroll}
          disabled={!segmentId || enrolling || !active}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Enroll
        </button>
      </div>
      {!active && (
        <p className="mt-2 text-xs text-muted-foreground">
          Activate the sequence to enroll contacts.
        </p>
      )}
      {message && (
        <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">{message}</p>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
