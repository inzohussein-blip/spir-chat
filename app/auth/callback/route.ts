import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // First-run via OAuth (Google/Facebook) skips the register form, so route
      // brand-new users to onboarding to name their auto-created workspace.
      // Only when no explicit destination was requested (e.g. not the /reset flow).
      let destination = next;
      if (next === "/dashboard") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: memberships } = await supabase
            .from("workspace_members")
            .select("workspaces(name)")
            .eq("user_id", user.id);
          // A single workspace still carrying the default "…'s Workspace" name
          // means the user hasn't set it up yet.
          if (
            memberships?.length === 1 &&
            (memberships[0].workspaces as { name: string } | null)?.name?.endsWith("'s Workspace")
          ) {
            destination = "/onboarding";
          }
        }
      }
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
