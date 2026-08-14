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

/** Block obvious SSRF targets (loopback / private / link-local hosts). */
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "::1" || h === "0.0.0.0") return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0 || a === 127 || a === 10) return true;
    if (a === 169 && b === 254) return true; // link-local (cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

/** Validate a WooCommerce store URL: https + a non-private host. */
function safeStoreUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (isBlockedHost(u.hostname)) return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/** Pick the first non-empty string in a list, else a dash. */
function firstStatus(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "—";
}

async function shopifyOrders(
  config: Record<string, unknown>,
  email: string
): Promise<NormalizedOrder[]> {
  const shop = String(config.shopDomain || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  const token = String(config.accessToken || "");
  // Only allow canonical *.myshopify.com admin hosts (blocks SSRF to other hosts).
  if (!token || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) return [];

  const url = `https://${shop}/admin/api/2024-01/orders.json?email=${encodeURIComponent(
    email
  )}&status=any&limit=5`;
  const res = await fetch(url, {
    headers: { "X-Shopify-Access-Token": token },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { orders?: Record<string, unknown>[] };
  return (data.orders ?? []).map((o) => {
    // order_number is a plain number; name is already like "#1001".
    const number =
      o.order_number != null
        ? `#${o.order_number}`
        : String(o.name ?? `#${o.id}`);
    return {
      id: String(o.id),
      number,
      status: firstStatus(o.financial_status, o.fulfillment_status),
      total: String(o.total_price ?? "0"),
      currency: String(o.currency ?? ""),
      createdAt: String(o.created_at ?? ""),
      url: o.order_status_url ? String(o.order_status_url) : undefined,
    };
  });
}

async function wooOrders(
  config: Record<string, unknown>,
  email: string
): Promise<NormalizedOrder[]> {
  const base = safeStoreUrl(String(config.storeUrl || ""));
  const ck = String(config.consumerKey || "");
  const cs = String(config.consumerSecret || "");
  if (!base || !ck || !cs) return [];

  const authHeader = {
    Authorization: `Basic ${Buffer.from(`${ck}:${cs}`).toString("base64")}`,
  };

  // Resolve the customer by exact email first, then fetch only their orders —
  // avoids Woo's broad `search=` which can match other customers' orders.
  const custRes = await fetch(
    `${base}/wp-json/wc/v3/customers?email=${encodeURIComponent(email)}`,
    { headers: authHeader, signal: AbortSignal.timeout(8000) }
  );
  if (!custRes.ok) return [];
  const customers = (await custRes.json()) as { id?: number }[];
  const customerId = Array.isArray(customers) ? customers[0]?.id : undefined;
  if (!customerId) return [];

  const res = await fetch(
    `${base}/wp-json/wc/v3/orders?customer=${customerId}&per_page=5`,
    { headers: authHeader, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as Record<string, unknown>[];
  return (Array.isArray(data) ? data : []).map((o) => ({
    id: String(o.id),
    number: `#${o.number ?? o.id}`,
    status: firstStatus(o.status),
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
