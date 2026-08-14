"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Plus,
  Trash2,
  Save,
  Check,
  GripVertical,
} from "lucide-react";
import { createForm, updateForm, deleteForm } from "@/lib/actions/forms";
import { FIELD_TYPES, type FormField, type FieldType } from "@/lib/forms";
import { PageTitle } from "@/components/page-title";
import { cn } from "@/lib/utils";

interface Form {
  id: string;
  name: string;
  fields: FormField[];
  successMessage: string;
  isActive: boolean;
}

export function FormsView({ forms }: { forms: Form[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(forms[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const selected = forms.find((f) => f.id === selectedId) ?? null;

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    const res = await createForm("New form");
    setCreating(false);
    if (res.id) setSelectedId(res.id);
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <PageTitle
          icon={ClipboardList}
          title="Forms"
          subtitle="Conversational forms your widget asks step-by-step to capture leads."
        />
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-72 flex-shrink-0 flex-col border-e border-border">
          <div className="p-3">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> New form
            </button>
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {forms.length === 0 ? (
              <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                No forms yet.
              </p>
            ) : (
              forms.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedId(f.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start transition-colors",
                    selectedId === f.id ? "bg-accent" : "hover:bg-muted"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {f.name}
                  </span>
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      f.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"
                    )}
                  />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selected ? (
            <FormEditor
              key={selected.id}
              form={selected}
              onChanged={() => router.refresh()}
              onDeleted={() => {
                setSelectedId(null);
                router.refresh();
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select or create a form.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FormEditor({
  form,
  onChanged,
  onDeleted,
}: {
  form: Form;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(form.name);
  const [fields, setFields] = useState<FormField[]>(form.fields);
  const [successMessage, setSuccessMessage] = useState(form.successMessage);
  const [isActive, setIsActive] = useState(form.isActive);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateField(i: number, patch: Partial<FormField>) {
    setFields((prev) => prev.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }
  function addField() {
    setFields((prev) => [
      ...prev,
      { key: `field_${prev.length + 1}`, label: "New question", type: "text", required: false },
    ]);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    await updateForm(form.id, { name, fields, successMessage, isActive });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onChanged();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <div className="flex items-center justify-between gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-lg font-semibold outline-none focus:border-primary"
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Active
        </label>
        <button
          onClick={async () => {
            await deleteForm(form.id);
            onDeleted();
          }}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Delete form"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Questions</p>
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 shadow-card"
            >
              <GripVertical className="h-4 w-4 flex-shrink-0 text-muted-foreground/50" />
              <input
                value={f.label}
                onChange={(e) => updateField(i, { label: e.target.value })}
                placeholder="Question"
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              <select
                value={f.type}
                onChange={(e) => updateField(i, { type: e.target.value as FieldType })}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => updateField(i, { required: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-border"
                />
                req
              </label>
              <button
                onClick={() => setFields((prev) => prev.filter((_, j) => j !== i))}
                className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                aria-label="Remove question"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addField}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" /> Add question
        </button>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Success message
        </label>
        <textarea
          value={successMessage}
          onChange={(e) => setSuccessMessage(e.target.value)}
          rows={2}
          placeholder="Shown after the visitor completes the form."
          className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Attach this form to a widget from the Website page (coming: form picker).
        </p>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" /> Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Save
            </>
          )}
        </button>
      </div>
    </div>
  );
}
