import { getWorkspace } from "@/lib/workspace";
import { SettingsView } from "./settings-view";
import { parseBusinessHours } from "@/lib/business-hours";

export default async function SettingsPage() {
  const { workspace, supabase } = await getWorkspace();

  const [{ data: labels }, { data: labelRules }] = await Promise.all([
    supabase
      .from("labels")
      .select("id, name, color")
      .eq("workspace_id", workspace.id)
      .order("name", { ascending: true }),
    supabase
      .from("label_rules")
      .select("id, keyword, label_id")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <SettingsView
      labels={labels ?? []}
      labelRules={labelRules ?? []}
      workspace={{
        id: workspace.id,
        name: workspace.name,
        hasApiKey: !!workspace.late_api_key_encrypted,
        hasAiKey: !!workspace.ai_api_key,
        globalKeywords: (workspace.global_keywords as string[]) ?? [],
        businessHours: parseBusinessHours(
          (workspace as { business_hours?: unknown }).business_hours
        ),
        autoAssign:
          (workspace as { auto_assign?: string }).auto_assign ?? "off",
        slaMinutes: (workspace as { sla_minutes?: number }).sla_minutes ?? 0,
        csatEnabled: (workspace as { csat_enabled?: boolean }).csat_enabled ?? false,
        weeklyReportEmail:
          (workspace as { weekly_report_email?: string | null }).weekly_report_email ?? null,
        aiRepliesEnabled:
          (workspace as { ai_replies_enabled?: boolean }).ai_replies_enabled ?? false,
      }}
    />
  );
}
