"use client";

import { useState } from "react";
import { UserCircle, Check, Save, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * The signed-in user's own account: display name and password. Uses Supabase
 * auth updateUser (self-service), separate from the workspace-level settings.
 */
export function AccountSection({
  email,
  initialName,
}: {
  email: string;
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [savedPw, setSavedPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  async function saveName() {
    if (savingName) return;
    setSavingName(true);
    setSavedName(false);
    setNameError(null);
    const { error } = await createClient().auth.updateUser({
      data: { full_name: name.trim() },
    });
    setSavingName(false);
    if (error) {
      setNameError(error.message);
      return;
    }
    setSavedName(true);
    setTimeout(() => setSavedName(false), 2000);
  }

  async function savePassword() {
    if (savingPw) return;
    setPwError(null);
    if (password.length < 6) {
      setPwError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setPwError("Passwords don't match.");
      return;
    }
    setSavingPw(true);
    setSavedPw(false);
    const { error } = await createClient().auth.updateUser({ password });
    setSavingPw(false);
    if (error) {
      setPwError(error.message);
      return;
    }
    setPassword("");
    setConfirm("");
    setSavedPw(true);
    setTimeout(() => setSavedPw(false), 2500);
  }

  return (
    <section>
      <div className="flex items-center gap-2">
        <UserCircle className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Account</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Your personal account — this is separate from the workspace settings.
      </p>

      {/* Email (read-only) */}
      <div className="mt-4">
        <label className="text-xs font-medium text-muted-foreground">Email</label>
        <input
          type="email"
          value={email}
          disabled
          className="mt-1.5 w-full cursor-not-allowed rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
        />
      </div>

      {/* Display name */}
      <div className="mt-4">
        <label htmlFor="account-name" className="text-xs font-medium text-muted-foreground">
          Display name
        </label>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input
            id="account-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={saveName}
            disabled={savingName || !name.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {savingName ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : savedName ? (
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
        {nameError && <p className="mt-1.5 text-xs text-red-600">{nameError}</p>}
      </div>

      {/* Change password */}
      <div className="mt-4 rounded-xl border border-border bg-card p-5 shadow-card">
        <p className="text-xs font-medium">Change password</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            autoComplete="new-password"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={savePassword}
            disabled={savingPw || !password || !confirm}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {savingPw ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Save className="h-3.5 w-3.5" /> Update password
              </>
            )}
          </button>
          {savedPw && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <Check className="h-3.5 w-3.5" /> Password updated
            </span>
          )}
        </div>
        {pwError && <p className="mt-2 text-xs text-red-600">{pwError}</p>}
      </div>
    </section>
  );
}
