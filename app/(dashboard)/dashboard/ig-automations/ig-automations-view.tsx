"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Instagram, Plus, Trash2, Power, Save, X, UserCheck } from "lucide-react";
import {
  createMetaAutomation,
  updateMetaAutomation,
  toggleMetaAutomation,
  deleteMetaAutomation,
  type MetaAutomationInput,
} from "@/lib/actions/meta-automations";
import { PageTitle } from "@/components/page-title";
import { AUTOMATION_TEMPLATES } from "@/lib/meta/automation-templates";
import { cn } from "@/lib/utils";

interface Channel {
  id: string;
  username: string;
}
interface Automation {
  triggerId: string;
  flowId: string;
  channelId: string;
  name: string;
  keywords: string[];
  matchType: string;
  dmMessage: string;
  replyText: string;
  requireFollow: boolean;
  followMessage: string;
  buttons: { label: string; url: string }[];
  isActive: boolean;
}

export function IgAutomationsView({
  channels,
  automations,
}: {
  channels: Channel[];
  automations: Automation[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Automation | null>(null);
  const [creating, setCreating] = useState(false);

  if (channels.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-8 py-6">
          <PageTitle
            icon={Instagram}
            title="Instagram Automations"
            subtitle="Comment-to-DM with the follow gate, straight through Meta."
          />
        </div>
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-sm rounded-xl border border-dashed border-border p-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-pink-500 text-white">
              <Instagram className="h-8 w-8" />
            </div>
            <p className="mt-3 text-sm font-medium">No Instagram account connected</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Connect one on the Channels page to build comment-to-DM automations.
            </p>
            <a
              href="/api/meta/connect"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-pink-500 px-4 py-2 text-sm font-medium text-white"
            >
              <Instagram className="h-4 w-4" /> Connect Instagram
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center justify-between">
          <PageTitle
            icon={Instagram}
            title="Instagram Automations"
            subtitle="Comment-to-DM with the follow gate, straight through Meta."
          />
          <button
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> New automation
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {(creating || editing) && (
            <AutomationForm
              channels={channels}
              initial={editing}
              onClose={() => {
                setCreating(false);
                setEditing(null);
              }}
              onSaved={() => {
                setCreating(false);
                setEditing(null);
                router.refresh();
              }}
            />
          )}

          {automations.length === 0 && !creating ? (
            <p className="text-sm text-muted-foreground">
              No automations yet. Create one to reply to keyword comments with a DM.
            </p>
          ) : (
            automations.map((a) => (
              <div
                key={a.triggerId}
                className="rounded-xl border border-border bg-card p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{a.name}</p>
                      {a.requireFollow && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                          <UserCheck className="h-3 w-3" /> Follow gate
                        </span>
                      )}
                      {!a.isActive && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {a.keywords.map((k) => `"${k}"`).join(", ")} → DM
                      {a.buttons.length ? ` · ${a.buttons.length} button(s)` : ""}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      onClick={async () => {
                        await toggleMetaAutomation(a.triggerId, !a.isActive);
                        router.refresh();
                      }}
                      title={a.isActive ? "Pause" : "Activate"}
                      className={cn(
                        "rounded-md p-1.5",
                        a.isActive
                          ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setCreating(false);
                        setEditing(a);
                      }}
                      className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        await deleteMetaAutomation(a.triggerId, a.flowId);
                        router.refresh();
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AutomationForm({
  channels,
  initial,
  onClose,
  onSaved,
}: {
  channels: Channel[];
  initial: Automation | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [channelId, setChannelId] = useState(initial?.channelId ?? channels[0]?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [keywords, setKeywords] = useState((initial?.keywords ?? []).join(", "));
  const [matchType, setMatchType] = useState(initial?.matchType ?? "contains");
  const [dmMessage, setDmMessage] = useState(initial?.dmMessage ?? "");
  const [replyText, setReplyText] = useState(initial?.replyText ?? "");
  const [requireFollow, setRequireFollow] = useState(initial?.requireFollow ?? false);
  const [followMessage, setFollowMessage] = useState(initial?.followMessage ?? "");
  const [buttons, setButtons] = useState<{ label: string; destinationUrl: string }[]>(
    (initial?.buttons ?? []).map((b) => ({ label: b.label, destinationUrl: "" }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const input: MetaAutomationInput = {
      channelId,
      name,
      keywords: keywords.split(/[\n,]/),
      matchType: matchType as MetaAutomationInput["matchType"],
      replyText,
      dmMessage,
      requireFollow,
      followMessage,
      buttons: buttons.filter((b) => b.label.trim() && b.destinationUrl.trim()),
    };
    const res = initial
      ? await updateMetaAutomation(initial.triggerId, initial.flowId, input)
      : await createMetaAutomation(input);
    setSaving(false);
    if (res.error) return setError(res.error);
    onSaved();
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {initial ? "Edit automation" : "New automation"}
        </h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {!initial && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Start from a template
            </p>
            <div className="flex flex-wrap gap-1.5">
              {AUTOMATION_TEMPLATES.map((t) => (
                <button
                  key={t.slug}
                  type="button"
                  title={t.summary}
                  onClick={() => {
                    if (!name) setName(t.title);
                    setKeywords(t.keywords.join(", "));
                    setMatchType(t.matchType);
                    setDmMessage(t.dmMessage);
                    if (t.replyText) setReplyText(t.replyText);
                    if (t.buttonLabel)
                      setButtons([{ label: t.buttonLabel, destinationUrl: "" }]);
                  }}
                  className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {!initial && (
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                @{c.username}
              </option>
            ))}
          </select>
        )}

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Automation name"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />

        <div className="flex gap-2">
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Keywords (comma-separated), e.g. LINK, price"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <select
            value={matchType}
            onChange={(e) => setMatchType(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none"
          >
            <option value="contains">contains</option>
            <option value="word">whole word</option>
            <option value="exact">exact</option>
            <option value="startsWith">starts with</option>
          </select>
        </div>

        <textarea
          value={dmMessage}
          onChange={(e) => setDmMessage(e.target.value)}
          rows={3}
          placeholder="DM message — use {username} to greet, {link} for your link"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />

        {/* Link buttons */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Link buttons (tracked, up to 3)
          </p>
          {buttons.map((b, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={b.label}
                onChange={(e) =>
                  setButtons((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))
                  )
                }
                placeholder="Button label"
                className="w-32 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
              <input
                value={b.destinationUrl}
                onChange={(e) =>
                  setButtons((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, destinationUrl: e.target.value } : x))
                  )
                }
                placeholder="https://destination…"
                className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={() => setButtons((prev) => prev.filter((_, j) => j !== i))}
                className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {buttons.length < 3 && (
            <button
              onClick={() => setButtons((prev) => [...prev, { label: "", destinationUrl: "" }])}
              className="text-xs font-medium text-primary hover:underline"
            >
              + Add button
            </button>
          )}
          {initial && initial.buttons.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Saving recreates buttons as fresh tracked links.
            </p>
          )}
        </div>

        {/* Follow gate */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={requireFollow}
            onChange={(e) => setRequireFollow(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Require a follow before sending the link (follow gate)
        </label>
        {requireFollow && (
          <input
            value={followMessage}
            onChange={(e) => setFollowMessage(e.target.value)}
            placeholder="Follow-request DM (optional)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        )}

        <input
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Public comment reply (optional)"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {initial ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
