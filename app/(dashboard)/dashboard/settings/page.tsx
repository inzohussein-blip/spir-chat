import { getWorkspace } from "@/lib/workspace";
import { SettingsView } from "./settings-view";
import { parseBusinessHours } from "@/lib/business-hours";

export default async function SettingsPage() {
  const { workspace, supabase, user } = await getWorkspace();

  const [{ data: labels }, { data: labelRules }, { data: wa }] = await Promise.all([
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
    supabase
      .from("whatsapp_credentials")
      .select("display_number, verified_name")
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
  ]);

  return (
    <SettingsView
      labels={labels ?? []}
      labelRules={labelRules ?? []}
      whatsapp={wa ? { displayNumber: wa.display_number, verifiedName: wa.verified_name } : null}
      account={{
        email: user.email ?? "",
        name:
          (user.user_metadata as { full_name?: string } | null)?.full_name ?? "",
      }}
      providers={{
        hasResend: !!(workspace as { resend_api_key?: string | null }).resend_api_key,
        campaignFromEmail:
          (workspace as { campaign_from_email?: string | null }).campaign_from_email ?? "",
        twilioAccountSid:
          (workspace as { twilio_account_sid?: string | null }).twilio_account_sid ?? "",
        hasTwilioAuth: !!(workspace as { twilio_auth_token?: string | null }).twilio_auth_token,
        twilioSmsFrom:
          (workspace as { twilio_sms_from?: string | null }).twilio_sms_from ?? "",
        twilioWhatsappFrom:
          (workspace as { twilio_whatsapp_from?: string | null }).twilio_whatsapp_from ?? "",
        telegramGatewayUrl:
          (workspace as { telegram_gateway_url?: string | null }).telegram_gateway_url ?? "",
        hasTelegramToken:
          !!(workspace as { telegram_gateway_token?: string | null }).telegram_gateway_token,
      }}
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
        agentCap:
          (workspace as { agent_conversation_cap?: number }).agent_conversation_cap ?? 0,
        autoCloseDays:
          (workspace as { auto_close_days?: number }).auto_close_days ?? 0,
        followupMinutes:
          (workspace as { visitor_followup_minutes?: number }).visitor_followup_minutes ?? 0,
        followupMessage:
          (workspace as { visitor_followup_message?: string | null }).visitor_followup_message ?? null,
        weeklyReportEmail:
          (workspace as { weekly_report_email?: string | null }).weekly_report_email ?? null,
        aiRepliesEnabled:
          (workspace as { ai_replies_enabled?: boolean }).ai_replies_enabled ?? false,
      }}
    />
  );
}
