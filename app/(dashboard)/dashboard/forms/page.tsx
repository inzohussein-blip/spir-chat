import { getWorkspace } from "@/lib/workspace";
import { parseFormFields } from "@/lib/forms";
import { FormsView } from "./forms-view";

export default async function FormsPage() {
  const { workspace, supabase } = await getWorkspace();

  const { data: forms } = await supabase
    .from("forms")
    .select("id, name, fields, success_message, is_active, updated_at")
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false });

  return (
    <FormsView
      forms={(forms ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        fields: parseFormFields(f.fields),
        successMessage: f.success_message ?? "",
        isActive: f.is_active,
      }))}
    />
  );
}
