"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Loader2, Trash2 } from "lucide-react";
import { eraseContact } from "@/lib/actions/contacts";

/**
 * GDPR right-to-erasure control. Requires the operator to type the contact's
 * name to confirm, since the deletion is permanent and cascades to all history.
 */
export function EraseContact({
  contactId,
  contactName,
}: {
  contactId: string;
  contactName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmWord = contactName || "DELETE";
  const canErase = typed.trim() === confirmWord && !busy;

  async function erase() {
    if (!canErase) return;
    setBusy(true);
    setError(null);
    const res = await eraseContact(contactId);
    if (res.error) {
      setBusy(false);
      return setError(res.error);
    }
    // The contact no longer exists — return to the list.
    router.push("/dashboard/contacts");
    router.refresh();
  }

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-destructive">
        <ShieldAlert className="h-3.5 w-3.5" />
        Erase personal data
      </h2>
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 shadow-card">
        <p className="text-xs text-muted-foreground">
          Permanently delete this contact and all of their data —
          conversations, messages, survey responses, campaign and sequence
          history. This satisfies a GDPR erasure request and cannot be undone.
        </p>
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Erase this contact…
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <label className="block text-xs font-medium">
              Type{" "}
              <span className="font-semibold text-foreground">{confirmWord}</span>{" "}
              to confirm
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmWord}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-destructive"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={erase}
                disabled={!canErase}
                className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Erase permanently
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  setTyped("");
                  setError(null);
                }}
                disabled={busy}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
