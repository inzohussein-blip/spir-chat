"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tag as TagIcon, Check } from "lucide-react";
import { setSequenceTriggerTag } from "@/lib/actions/sequences";

export function SequenceTrigger({
  sequenceId,
  tags,
  initialTagId,
}: {
  sequenceId: string;
  tags: { id: string; name: string }[];
  initialTagId: string | null;
}) {
  const router = useRouter();
  const [tagId, setTagId] = useState(initialTagId ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onChange(value: string) {
    setTagId(value);
    setSaving(true);
    setSaved(false);
    await setSequenceTriggerTag(sequenceId, value || null);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  if (tags.length === 0) return null;

  return (
    <div className="border-t border-border px-6 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <TagIcon className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Auto-enroll when tagged</span>
        <select
          value={tagId}
          onChange={(e) => onChange(e.target.value)}
          disabled={saving}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
        >
          <option value="">No trigger</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        When this tag is added to a contact (in the inbox, a bulk action, or a
        flow), they&apos;re enrolled automatically — the sequence must be active.
      </p>
    </div>
  );
}
