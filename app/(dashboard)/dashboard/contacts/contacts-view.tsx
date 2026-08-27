"use client";

import { useI18n } from "@/components/i18n-provider";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Users,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  Filter,
  ChevronDown,
  Tag as TagIcon,
  Bell,
  BellOff,
  Trash2,
  Loader2,
  X,
  Download,
  Upload,
} from "lucide-react";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import {
  bulkAddTag,
  bulkSetSubscribed,
  bulkDeleteContacts,
  importContacts,
} from "@/lib/actions/contacts";
import { parseCsv, toCsv, contactsFromCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { avatarGradient } from "@/lib/avatar";
import { PageTitle } from "@/components/page-title";
import {
  SegmentBuilder,
  createEmptyFilter,
  type SegmentFilter,
} from "@/components/segment-builder";
import type { Database, Platform } from "@/lib/types/database";

type Tag = Database["public"]["Tables"]["tags"]["Row"];
type ContactWithTags = Database["public"]["Tables"]["contacts"]["Row"] & {
  contact_tags: {
    tag_id: string;
    tags: Tag | null;
  }[];
};

const platformLabels: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "X / Twitter",
  telegram: "Telegram",
  bluesky: "Bluesky",
  reddit: "Reddit",
  whatsapp: "WhatsApp",
  website: "Website",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ContactsView({
  contacts,
  tags,
  workspaceId,
}: {
  contacts: ContactWithTags[];
  tags: Tag[];
  workspaceId: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [showSegmentBuilder, setShowSegmentBuilder] = useState(false);
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>(
    createEmptyFilter()
  );
  // Bulk selection.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagId, setBulkTagId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  // CSV import/export.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  function exportCsv() {
    const header = ["Name", "Email", "Phone", "Subscribed", "Tags", "Created"];
    const rows = filtered.map((c) => [
      c.display_name,
      c.email,
      c.phone,
      c.is_subscribed ? "yes" : "no",
      (c.contact_tags.map((ct) => ct.tags?.name).filter(Boolean) as string[]).join("; "),
      c.created_at,
    ]);
    const blob = new Blob([toCsv([header, ...rows])], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportNotice(null);
    const text = await file.text();
    e.target.value = "";
    const records = contactsFromCsv(parseCsv(text));
    if (records.length === 0) {
      setImporting(false);
      setImportNotice("No importable rows found (need an email or phone column).");
      return;
    }
    const res = await importContacts(records);
    setImporting(false);
    if (res.error) {
      setImportNotice(res.error);
      return;
    }
    setImportNotice(`Imported ${res.created} new · updated ${res.updated}.`);
    router.refresh();
  }

  const filtered = contacts.filter((contact) => {
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      const name = contact.display_name?.toLowerCase() ?? "";
      const email = contact.email?.toLowerCase() ?? "";
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    // Tag filter
    if (selectedTagId) {
      const hasTag = contact.contact_tags.some(
        (ct) => ct.tag_id === selectedTagId
      );
      if (!hasTag) return false;
    }
    return true;
  });

  const filteredIds = filtered.map((c) => c.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      if (filteredIds.every((id) => prev.has(id))) {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...filteredIds]);
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBulkNotice(null);
  }

  async function runBulk(fn: () => Promise<{ error?: string; count?: number }>, label: string) {
    if (bulkBusy) return;
    setBulkBusy(true);
    setBulkNotice(null);
    const res = await fn();
    setBulkBusy(false);
    if (res.error) {
      setBulkNotice(res.error);
      return;
    }
    setBulkNotice(`${label} · ${res.count} contact${res.count === 1 ? "" : "s"}`);
    clearSelection();
    router.refresh();
  }

  const ids = () => Array.from(selectedIds);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center justify-between gap-3">
          <PageTitle
            icon={Users}
            title={t.dash.contacts.title}
            subtitle={`${contacts.length} ${t.dash.contacts.subtitleSuffix}`}
          />
          <div className="flex flex-shrink-0 items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={handleImportFile}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import
            </button>
            <button
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Export
            </button>
          </div>
        </div>
        {importNotice && (
          <p className="mt-2 text-xs font-medium text-muted-foreground">{importNotice}</p>
        )}

        {/* Search and filters */}
        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-background py-2 ps-9 pe-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => setShowSegmentBuilder(!showSegmentBuilder)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              showSegmentBuilder
                ? "border-primary bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Filter className="h-4 w-4" />
            Segment
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                showSegmentBuilder && "rotate-180"
              )}
            />
          </button>
        </div>

        {/* Segment builder */}
        {showSegmentBuilder && (
          <div className="mt-4">
            <SegmentBuilder
              value={segmentFilter}
              onChange={setSegmentFilter}
              workspaceId={workspaceId}
            />
          </div>
        )}

        {/* Tag pills */}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedTagId(null)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                selectedTagId === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              All
            </button>
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() =>
                  setSelectedTagId(tag.id === selectedTagId ? null : tag.id)
                }
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  selectedTagId === tag.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
                style={
                  tag.color && selectedTagId !== tag.id
                    ? {
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                      }
                    : undefined
                }
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary/5 px-8 py-2.5">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <button
            onClick={clearSelection}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>

          <div className="ms-auto flex flex-wrap items-center gap-2">
            {tags.length > 0 && (
              <div className="flex items-center gap-1.5">
                <select
                  value={bulkTagId}
                  onChange={(e) => setBulkTagId(e.target.value)}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none"
                >
                  <option value="">Add tag…</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => runBulk(() => bulkAddTag(ids(), bulkTagId), "Tagged")}
                  disabled={!bulkTagId || bulkBusy}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  <TagIcon className="h-3.5 w-3.5" /> Apply
                </button>
              </div>
            )}
            <button
              onClick={() => runBulk(() => bulkSetSubscribed(ids(), true), "Subscribed")}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              <Bell className="h-3.5 w-3.5" /> Subscribe
            </button>
            <button
              onClick={() => runBulk(() => bulkSetSubscribed(ids(), false), "Unsubscribed")}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              <BellOff className="h-3.5 w-3.5" /> Unsubscribe
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete ${selectedIds.size} contact(s)? This can't be undone.`)) {
                  runBulk(() => bulkDeleteContacts(ids()), "Deleted");
                }
              }}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete
            </button>
          </div>
        </div>
      )}
      {bulkNotice && (
        <div className="border-b border-border bg-emerald-50 px-8 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          {bulkNotice}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              No contacts found
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Contacts are created automatically when someone messages your channels
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="ps-8 pe-2 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                    className="h-4 w-4 cursor-pointer rounded border-border accent-[var(--primary)]"
                  />
                </th>
                <th className="px-3 py-3 text-xs font-medium uppercase text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground">
                  Email
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground">
                  Last Interaction
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground">
                  Tags
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground">
                  Subscribed
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact) => {
                const contactTags = contact.contact_tags
                  .map((ct) => ct.tags)
                  .filter(Boolean) as Tag[];

                return (
                  <tr
                    key={contact.id}
                    className={cn(
                      "border-b border-border transition-colors hover:bg-accent/50",
                      selectedIds.has(contact.id) && "bg-primary/5"
                    )}
                  >
                    <td className="ps-8 pe-2 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(contact.id)}
                        onChange={() => toggleOne(contact.id)}
                        aria-label={`Select ${contact.display_name ?? "contact"}`}
                        className="h-4 w-4 cursor-pointer rounded border-border accent-[var(--primary)]"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/dashboard/contacts/${contact.id}`}
                        className="flex items-center gap-3"
                      >
                        {contact.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={contact.avatar_url}
                            alt={contact.display_name || "Contact"}
                            className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className={cn(
                              "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white shadow-sm",
                              avatarGradient(contact.display_name ?? "Unknown")
                            )}
                          >
                            {contact.display_name?.[0]?.toUpperCase() ?? "?"}
                          </div>
                        )}
                        <span className="text-sm font-medium hover:underline">
                          {contact.display_name ?? "Unknown"}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {contact.email ? (
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">
                          No email
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(contact.last_interaction_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {contactTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {contactTags.slice(0, 3).map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex rounded-full border border-border px-2 py-0.5 text-[10px] font-medium"
                              style={
                                tag.color
                                  ? {
                                      backgroundColor: `${tag.color}20`,
                                      borderColor: `${tag.color}40`,
                                      color: tag.color,
                                    }
                                  : undefined
                              }
                            >
                              {tag.name}
                            </span>
                          ))}
                          {contactTags.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{contactTags.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">
                          No tags
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {contact.is_subscribed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <XCircle className="h-3.5 w-3.5" />
                          No
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
