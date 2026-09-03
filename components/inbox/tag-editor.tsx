"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/i18n-provider";
import type { Database } from "@/lib/types/database";

type TagRow = Database["public"]["Tables"]["tags"]["Row"];

/** Add/remove a contact's tags inline from the inbox contact panel. */
export function TagEditor({
  contactId,
  workspaceId,
  initialTags,
}: {
  contactId: string;
  workspaceId: string;
  initialTags: TagRow[];
}) {
  const { t } = useI18n();
  const [tags, setTags] = useState<TagRow[]>(initialTags);
  const [allTags, setAllTags] = useState<TagRow[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reset when switching contacts.
  useEffect(() => {
    setTags(initialTags);
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  // Load the workspace's tag palette for the picker.
  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("tags")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setAllTags((data as TagRow[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const assignedIds = new Set(tags.map((t) => t.id));
  const available = allTags.filter((t) => !assignedIds.has(t.id));

  async function add(tag: TagRow) {
    if (busy) return;
    setBusy(true);
    setTags((prev) => [...prev, tag]);
    setOpen(false);
    await createClient()
      .from("contact_tags")
      .upsert(
        { contact_id: contactId, tag_id: tag.id },
        { onConflict: "contact_id,tag_id", ignoreDuplicates: true }
      );
    setBusy(false);
  }

  async function remove(tag: TagRow) {
    if (busy) return;
    setBusy(true);
    setTags((prev) => prev.filter((x) => x.id !== tag.id));
    await createClient()
      .from("contact_tags")
      .delete()
      .eq("contact_id", contactId)
      .eq("tag_id", tag.id);
    setBusy(false);
  }

  function tagStyle(tag: TagRow) {
    return tag.color
      ? { backgroundColor: `${tag.color}20`, borderColor: `${tag.color}40`, color: tag.color }
      : undefined;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="group inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs"
          style={tagStyle(tag)}
        >
          {tag.name}
          <button
            onClick={() => remove(tag)}
            aria-label={`Remove ${tag.name}`}
            className="opacity-50 transition-opacity hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {available.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> {t.inbox.addTag}
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute z-20 mt-1 max-h-48 w-44 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
                {available.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => add(tag)}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-start text-xs hover:bg-accent"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color ?? "var(--muted-foreground)" }}
                    />
                    {tag.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
