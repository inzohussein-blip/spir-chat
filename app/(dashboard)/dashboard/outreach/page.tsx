import { getWorkspace } from "@/lib/workspace";
import { channelConfigured } from "@/lib/campaigns/providers";
import { OutreachView } from "./outreach-view";

export default async function OutreachPage() {
  const { workspace, supabase } = await getWorkspace();

  const [{ data: templates }, { data: batches }] = await Promise.all([
    supabase
      .from("canned_responses")
      .select("id, short_code, content")
      .eq("workspace_id", workspace.id)
      .order("short_code", { ascending: true }),
    supabase
      .from("outreach_batches")
      .select("id, channel, message, total, sent_count, failed_count, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Which channels actually have provider credentials (computed server-side).
  const configured = {
    email: channelConfigured("email"),
    sms: channelConfigured("sms"),
    whatsapp: channelConfigured("whatsapp"),
  };

  return (
    <OutreachView
      templates={templates ?? []}
      batches={batches ?? []}
      configured={configured}
    />
  );
}
