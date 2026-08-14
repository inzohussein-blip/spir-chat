import { getWorkspace } from "@/lib/workspace";
import { SettingsView } from "./settings-view";
import { parseBusinessHours } from "@/lib/business-hours";

export default async function SettingsPage() {
  const { workspace } = await getWorkspace();

  return (
    <SettingsView
      workspace={{
        id: workspace.id,
        name: workspace.name,
        hasApiKey: !!workspace.late_api_key_encrypted,
        hasAiKey: !!workspace.ai_api_key,
        globalKeywords: (workspace.global_keywords as string[]) ?? [],
        businessHours: parseBusinessHours(
          (workspace as { business_hours?: unknown }).business_hours
        ),
      }}
    />
  );
}
