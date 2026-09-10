import { getWorkspace } from "@/lib/workspace";
import { SITE_URL } from "@/lib/site";
import { WhatsAppPageView } from "./whatsapp-view";

export default async function WhatsAppPage() {
  const { workspace, supabase } = await getWorkspace();

  const [{ data: creds }, { data: templates }] = await Promise.all([
    supabase
      .from("whatsapp_credentials")
      .select("display_number, verified_name, waba_id")
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
    supabase
      .from("whatsapp_templates")
      .select("name, language, status, category")
      .eq("workspace_id", workspace.id)
      .order("name", { ascending: true }),
  ]);

  return (
    <WhatsAppPageView
      connection={
        creds
          ? {
              displayNumber: creds.display_number,
              verifiedName: creds.verified_name,
              hasWaba: !!creds.waba_id,
            }
          : null
      }
      templates={(templates ?? []).map((t) => ({
        name: t.name,
        language: t.language,
        status: t.status ?? "PENDING",
        category: t.category,
      }))}
      callbackUrl={`${SITE_URL}/api/webhooks/whatsapp`}
      verifyTokenSet={
        !!process.env.META_WEBHOOK_VERIFY_TOKEN || !!process.env.META_VERIFY_TOKEN
      }
    />
  );
}
