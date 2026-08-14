"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Blocks, Check, Save, Trash2, ShoppingBag } from "lucide-react";
import { saveIntegration, deleteIntegration } from "@/lib/actions/integrations";
import { PageTitle } from "@/components/page-title";
import { cn } from "@/lib/utils";

type Configured = Record<string, { connected: boolean; hint: string }>;

export function IntegrationsView({ configured }: { configured: Configured }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <PageTitle
          icon={Blocks}
          title="Integrations"
          subtitle="Connect your store to show a contact's recent orders in the inbox."
        />
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <ProviderCard
            provider="shopify"
            title="Shopify"
            hint={configured.shopify?.hint}
            connected={configured.shopify?.connected}
            fields={[
              { key: "shopDomain", label: "Store domain (x.myshopify.com)" },
              { key: "accessToken", label: "Admin API access token", secret: true },
            ]}
          />
          <ProviderCard
            provider="woocommerce"
            title="WooCommerce"
            hint={configured.woocommerce?.hint}
            connected={configured.woocommerce?.connected}
            fields={[
              { key: "storeUrl", label: "Store URL (https://…)" },
              { key: "consumerKey", label: "Consumer key", secret: true },
              { key: "consumerSecret", label: "Consumer secret", secret: true },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  title,
  hint,
  connected,
  fields,
}: {
  provider: string;
  title: string;
  hint?: string;
  connected?: boolean;
  fields: { key: string; label: string; secret?: boolean }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await saveIntegration(provider, values);
    setSaving(false);
    if (res.error) return setError(res.error);
    setSaved(true);
    setValues({});
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{title}</h2>
          {connected && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              Connected{hint ? ` · ${hint}` : ""}
            </span>
          )}
        </div>
        {connected && (
          <button
            onClick={async () => {
              await deleteIntegration(provider);
              router.refresh();
            }}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Disconnect"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-xs font-medium text-muted-foreground">
              {f.label}
            </label>
            <input
              type={f.secret ? "password" : "text"}
              value={values[f.key] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
              placeholder={connected && f.secret ? "•••••• (leave blank to keep)" : ""}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <div className={cn("mt-3 flex justify-end")}>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" /> Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> {connected ? "Update" : "Connect"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
