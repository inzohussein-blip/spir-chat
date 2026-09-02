import { getWorkspace } from "@/lib/workspace";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace, user, supabase } = await getWorkspace();

  const [{ data: memberships }, { count: unreadCount }, { data: myMembership }] =
    await Promise.all([
      supabase
        .from("workspace_members")
        .select("role, workspaces(id, name, slug)")
        .eq("user_id", user.id),
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspace.id)
        .gt("unread_count", 0),
      supabase
        .from("workspace_members")
        .select("is_away")
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const workspaces = (memberships ?? [])
    .map((m) => ({
      ...(m.workspaces as { id: string; name: string; slug: string }),
      role: m.role,
    }))
    .filter((w) => w.id);

  return (
    <div className="flex h-screen">
      <PresenceHeartbeat />
      <Sidebar workspace={workspace} user={user} workspaces={workspaces} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          userEmail={user.email}
          unreadCount={unreadCount ?? 0}
          initialAway={(myMembership as { is_away?: boolean } | null)?.is_away ?? false}
        />
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
