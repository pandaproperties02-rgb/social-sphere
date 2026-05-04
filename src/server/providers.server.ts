// Server-only helpers for talking to upstream SMM provider panels.
// All real perfectpanel-compatible APIs accept POST x-www-form-urlencoded
// with `key`, `action`, and per-action params. Responses are JSON.

export type ProviderRow = {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
};

async function callProvider(p: { api_url: string; api_key: string }, params: Record<string, string | number>) {
  const body = new URLSearchParams({ key: p.api_key, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const res = await fetch(p.api_url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error(`provider returned non-JSON: ${text.slice(0, 200)}`); }
  if (!res.ok) throw new Error(`provider http ${res.status}: ${text.slice(0, 200)}`);
  return data;
}

export async function providerListServices(p: ProviderRow) {
  const data = await callProvider(p, { action: "services" });
  if (!Array.isArray(data)) throw new Error("services response not array");
  return data as Array<{
    service: number | string;
    name: string;
    type?: string;
    category: string;
    rate: string | number;
    min: string | number;
    max: string | number;
    description?: string;
  }>;
}

export async function providerAddOrder(p: ProviderRow, args: { service: string; link: string; quantity: number }) {
  const data = await callProvider(p, { action: "add", service: args.service, link: args.link, quantity: args.quantity });
  if (data?.order == null) throw new Error(`provider add failed: ${JSON.stringify(data).slice(0, 200)}`);
  return { providerOrderId: String(data.order) };
}

export async function providerStatus(p: ProviderRow, providerOrderIds: string[]) {
  if (providerOrderIds.length === 0) return {} as Record<string, any>;
  // perfectpanel: action=status&orders=1,2,3 → { "1": {...}, "2": {...} }
  const data = await callProvider(p, { action: "status", orders: providerOrderIds.join(",") });
  return data as Record<string, { charge?: string; start_count?: string; status?: string; remains?: string; currency?: string }>;
}

export async function providerBalance(p: ProviderRow) {
  const data = await callProvider(p, { action: "balance" });
  return Number(data?.balance ?? 0);
}

// Map upstream status string → our canonical status.
export function normalizeStatus(s?: string): string {
  if (!s) return "pending";
  const v = s.toLowerCase();
  if (v.includes("complete")) return "completed";
  if (v.includes("partial")) return "partial";
  if (v.includes("cancel")) return "canceled";
  if (v.includes("progress") || v === "in progress") return "in_progress";
  if (v.includes("processing")) return "in_progress";
  if (v.includes("pending")) return "pending";
  return v.replaceAll(" ", "_");
}