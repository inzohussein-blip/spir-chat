import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const WORKSPACE_COOKIE = "spirchat_workspace_id";

/**
 * Resolve the caller's current workspace. Cached per request. Reads the
 * workspace ID from the cookie if set (and that membership is still active);
 * otherwise falls back to the first workspace, preferring an active one.
 */
const resolve = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "signed_out" as const };

  const cookieStore = await cookies();
  const selectedId = cookieStore.get(WORKSPACE_COOKIE)?.value;

  // Try cookie workspace first
  if (selectedId) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id, role, is_active, workspaces(*)")
      .eq("user_id", user.id)
      .eq("workspace_id", selectedId)
      .maybeSingle();

    // A closed (deactivated) membership falls through to the user's other
    // workspaces; RLS hides the workspace row from it anyway.
    if (membership?.is_active !== false && membership?.workspaces) {
      return {
        status: "ok" as const,
        user,
        workspace: membership.workspaces,
        role: membership.role,
        supabase,
      };
    }
  }

  // Fallback to the first workspace, preferring one the user is still active in
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, is_active, workspaces(*)")
    .eq("user_id", user.id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) return { status: "no_workspace" as const };
  // Every membership is closed: the member is blocked until reactivated.
  if (membership.is_active === false) return { status: "suspended" as const };
  if (!membership.workspaces) return { status: "no_workspace" as const };

  return {
    status: "ok" as const,
    user,
    workspace: membership.workspaces,
    role: membership.role,
    supabase,
  };
});

/** For pages and server actions: redirects when there is no usable workspace. */
export const getWorkspace = cache(async () => {
  const ctx = await resolve();
  if (ctx.status === "suspended") redirect("/suspended");
  if (ctx.status !== "ok") redirect("/login");
  const { user, workspace, role, supabase } = ctx;
  return { user, workspace, role, supabase };
});

/**
 * For API route handlers: the same workspace the dashboard shows (cookie +
 * active membership), or null when signed out / no active workspace. Never use
 * "the user's first membership" instead — it ignores the workspace switcher and
 * closed memberships.
 */
export async function resolveWorkspace() {
  const ctx = await resolve();
  if (ctx.status !== "ok") return null;
  const { user, workspace, role, supabase } = ctx;
  return { user, workspace, role, supabase };
}
