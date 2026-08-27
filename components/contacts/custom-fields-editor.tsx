"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hash, Plus, Trash2, Check, Loader2 } from "lucide-react";
import {
  createCustomFieldDefinition,
  deleteCustomFieldDefinition,
  setContactFieldValue,
} from "@/lib/actions/custom-fields";

interface FieldDef {
  id: string;
  name: string;
  type: string;
}

const TYPES = ["text", "number", "boolean", "date", "url", "email"];

function inputType(t: string): string {
  if (t === "number") return "number";
  if (t === "date") return "date";
  if (t === "url") return "url";
  if (t === "email") return "email";
  return "text";
}

export function CustomFieldsEditor({
  contactId,
  definitions,
  values,
}: {
  contactId: string;
  definitions: FieldDef[];
  values: Record<string, string>;
}) {
  const router = useRouter();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("text");

  async function saveValue(fieldId: string, value: string) {
    setSavingId(fieldId);
    await setContactFieldValue(contactId, fieldId, value);
    setSavingId(null);
    setSavedId(fieldId);
    setTimeout(() => setSavedId((s) => (s === fieldId ? null : s)), 1500);
    router.refresh();
  }

  async function addField() {
    if (!newName.trim()) return;
    setAdding(true);
    await createCustomFieldDefinition(newName, newType);
    setAdding(false);
    setNewName("");
    setNewType("text");
    router.refresh();
  }

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
        <Hash className="h-3.5 w-3.5" />
        Custom fields
      </h2>

      <div className="space-y-2">
        {definitions.map((def) => (
          <div
            key={def.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 shadow-card"
          >
            <div className="min-w-0 flex-1">
              <label className="text-xs text-muted-foreground">{def.name}</label>
              <div className="mt-1 flex items-center gap-2">
                {def.type === "boolean" ? (
                  <select
                    defaultValue={values[def.id] ?? ""}
                    onChange={(e) => saveValue(def.id, e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                  >
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <input
                    type={inputType(def.type)}
                    defaultValue={values[def.id] ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (values[def.id] ?? "")) {
                        saveValue(def.id, e.target.value);
                      }
                    }}
                    placeholder="—"
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                  />
                )}
                {savingId === def.id ? (
                  <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-muted-foreground" />
                ) : savedId === def.id ? (
                  <Check className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                ) : null}
              </div>
            </div>
            <button
              onClick={async () => {
                if (confirm(`Delete the "${def.name}" field for all contacts?`)) {
                  await deleteCustomFieldDefinition(def.id);
                  router.refresh();
                }
              }}
              aria-label={`Delete ${def.name}`}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {adding ? (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-card p-3 shadow-card">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Field name"
              autoFocus
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              onClick={addField}
              disabled={!newName.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Add custom field
          </button>
        )}
      </div>
    </div>
  );
}
