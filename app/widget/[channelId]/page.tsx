import { WidgetChat } from "@/components/widget/widget-chat";

// The embeddable chat surface. Loaded inside an iframe on the customer's site
// by /widget.js. Public (the middleware only gates /dashboard). Rendered on
// demand so it never needs Supabase env at build time.
export const dynamic = "force-dynamic";

export default async function WidgetPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  return <WidgetChat channelId={channelId} />;
}
