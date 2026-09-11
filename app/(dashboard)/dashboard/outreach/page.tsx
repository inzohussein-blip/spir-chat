import { getWorkspace } from "@/lib/workspace";
import { channelConfigured, resolveWorkspaceProviders } from "@/lib/campaigns/providers";
import { workspaceHasMeta } from "@/lib/whatsapp-cloud";
import { OutreachView } from "./outreach-view";

export default async function OutreachPage() {
  const { workspace, supabase } = await getWorkspace();

  const [{ data: templates }, { data: batches }] = await Promise.all([
    supabase
      .from("outreach_templates")
      .select("id, name, subject, body")
      .eq("workspace_id", workspace.id)
      .order("name", { ascending: true }),
    supabase
      .from("outreach_batches")
      .select("id, channel, message, total, sent_count, failed_count, status, scheduled_at, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const { data: waTemplates } = await supabase
    .from("whatsapp_templates")
    .select("name, language, status")
    .eq("workspace_id", workspace.id)
    .eq("status", "APPROVED")
    .order("name", { ascending: true });

  // Which channels actually have provider credentials — workspace-configured
  // (set in the app) first, then env fallback.
  const providerCfg = await resolveWorkspaceProviders(supabase, workspace.id);
  const configured = {
    email: channelConfigured("email", providerCfg),
    sms: channelConfigured("sms", providerCfg),
    whatsapp: channelConfigured("whatsapp", providerCfg),
    telegram: channelConfigured("telegram", providerCfg),
  };

  return (
    <OutreachView
      templates={templates ?? []}
      batches={batches ?? []}
      configured={configured}
      metaWhatsApp={await workspaceHasMeta(supabase, workspace.id)}
      waTemplates={(waTemplates ?? []).map((t) => ({ name: t.name, language: t.language }))}
    />
  );
}
