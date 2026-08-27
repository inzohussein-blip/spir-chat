import { getWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";
import { parseMacroActions } from "@/lib/macros";
import { MacrosView } from "./macros-view";

export default async function MacrosPage() {
  const { workspace, supabase } = await getWorkspace();

  const [{ data: macros }, { data: labels }, { data: members }] = await Promise.all([
    supabase
      .from("macros")
      .select("id, name, actions")
      .eq("workspace_id", workspace.id)
      .order("name", { ascending: true }),
    supabase
      .from("labels")
      .select("id, name, color")
      .eq("workspace_id", workspace.id)
      .order("name", { ascending: true }),
    supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspace.id),
  ]);

  // Resolve member emails for the "assign to" picker (RLS hides auth.users).
  const service = await createServiceClient();
  const agents = await Promise.all(
    (members ?? []).map(async (m) => {
      const { data } = await service.auth.admin.getUserById(m.user_id);
      return { id: m.user_id, email: data.user?.email ?? "Unknown" };
    })
  );

  return (
    <MacrosView
      macros={(macros ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        actions: parseMacroActions(m.actions),
      }))}
      labels={labels ?? []}
      agents={agents}
    />
  );
}
