// Store integrations: fetch a contact's recent orders by email (feature 17).
// Provider REST calls via fetch — no dependencies.

export type IntegrationProvider = "shopify" | "woocommerce";

export interface NormalizedOrder {
  id: string;
  number: string;
  status: string;
  total: string;
  currency: string;
  createdAt: string;
  url?: string;
}

async function shopifyOrders(
  config: Record<string, unknown>,
  email: string
): Promise<NormalizedOrder[]> {
  const shop = String(config.shopDomain || "").replace(/^https?:\/\//, "");
  const token = String(config.accessToken || "");
  if (!shop || !token) return [];

  const url = `https://${shop}/admin/api/2024-01/orders.json?email=${encodeURIComponent(
    email
  )}&status=any&limit=5`;
  const res = await fetch(url, {
    headers: { "X-Shopify-Access-Token": token },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { orders?: Record<string, unknown>[] };
  return (data.orders ?? []).map((o) => ({
    id: String(o.id),
    number: `#${o.order_number ?? o.name ?? o.id}`,
    status: String(o.financial_status ?? o.fulfillment_status ?? "—"),
    total: String(o.total_price ?? "0"),
    currency: String(o.currency ?? ""),
    createdAt: String(o.created_at ?? ""),
    url: o.order_status_url ? String(o.order_status_url) : undefined,
  }));
}

async function wooOrders(
  config: Record<string, unknown>,
  email: string
): Promise<NormalizedOrder[]> {
  const base = String(config.storeUrl || "").replace(/\/$/, "");
  const ck = String(config.consumerKey || "");
  const cs = String(config.consumerSecret || "");
  if (!base || !ck || !cs) return [];

  const url = `${base}/wp-json/wc/v3/orders?search=${encodeURIComponent(
    email
  )}&per_page=5`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${ck}:${cs}`).toString("base64")}`,
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Record<string, unknown>[];
  return (Array.isArray(data) ? data : []).map((o) => ({
    id: String(o.id),
    number: `#${o.number ?? o.id}`,
    status: String(o.status ?? "—"),
    total: String(o.total ?? "0"),
    currency: String(o.currency ?? ""),
    createdAt: String(o.date_created ?? ""),
  }));
}

/** Fetch recent orders for an email from a provider. Best-effort → []. */
export async function fetchOrdersForEmail(
  provider: IntegrationProvider,
  config: Record<string, unknown>,
  email: string
): Promise<NormalizedOrder[]> {
  try {
    if (provider === "shopify") return await shopifyOrders(config, email);
    if (provider === "woocommerce") return await wooOrders(config, email);
    return [];
  } catch {
    return [];
  }
}
