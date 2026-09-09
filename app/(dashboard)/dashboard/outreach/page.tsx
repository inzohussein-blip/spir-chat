import { getWorkspace } from "@/lib/workspace";
import { channelConfigured } from "@/lib/campaigns/providers";
import { metaConfigured } from "@/lib/whatsapp-cloud";
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

  // Which channels actually have provider credentials (computed server-side).
  const configured = {
    email: channelConfigured("email"),
    sms: channelConfigured("sms"),
    whatsapp: channelConfigured("whatsapp"),
    telegram: channelConfigured("telegram"),
  };

  return (
    <OutreachView
      templates={templates ?? []}
      batches={batches ?? []}
      configured={configured}
      metaWhatsApp={metaConfigured()}
    />
  );
}
