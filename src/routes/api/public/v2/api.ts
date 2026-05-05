import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Perfectpanel-compatible reseller API.
// Single endpoint. POST x-www-form-urlencoded or JSON with `key` + `action`.

async function readBody(request: Request): Promise<Record<string, string>> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const j = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v ?? "")]));
  }
  const form = await request.formData().catch(() => null);
  if (!form) return {};
  const out: Record<string, string> = {};
  form.forEach((v, k) => { out[k] = String(v); });
  return out;
}

const j = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

async function authenticate(key: string) {
  if (!key) return null;
  const { data } = await supabaseAdmin.from("api_keys").select("user_id,key").eq("key", key).maybeSingle();
  if (!data) return null;
  // touch last_used_at (best-effort, non-blocking)
  void supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("key", key);
  return data.user_id as string;
}

export const Route = createFileRoute("/api/public/v2/api")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
      GET: async () =>
        j({ error: "POST with key & action (services|add|status|balance)" }, 400),
      POST: async ({ request }) => {
        const body = await readBody(request);
        const userId = await authenticate(body.key ?? "");
        if (!userId) return j({ error: "Invalid API key" }, 401);
        const action = (body.action ?? "").toLowerCase();

        try {
          if (action === "balance") {
            const { data: w } = await supabaseAdmin.from("wallets").select("balance,currency").eq("user_id", userId).single();
            return j({ balance: Number(w?.balance ?? 0).toFixed(4), currency: w?.currency ?? "USD" });
          }

          if (action === "services") {
            const { data } = await supabaseAdmin
              .from("services")
              .select("id,name,rate,min_order,max_order,category_id,categories:categories(name),provider_id")
              .eq("status", "active")
              .not("provider_id", "is", null)
              .limit(5000);
            const out = (data ?? []).map((s: any) => ({
              service: s.id,
              name: s.name,
              category: s.categories?.name ?? "",
              rate: Number(s.rate).toFixed(4),
              min: s.min_order,
              max: s.max_order,
              type: "Default",
            }));
            return j(out);
          }

          if (action === "add") {
            const parsed = z.object({
              service: z.coerce.number().int().positive(),
              link: z.string().url().max(2000),
              quantity: z.coerce.number().int().positive().max(10_000_000),
            }).safeParse(body);
            if (!parsed.success) return j({ error: parsed.error.issues[0]?.message ?? "invalid input" }, 400);
            const { data, error } = await supabaseAdmin.rpc("place_order_for", {
              _user_id: userId, _service_id: parsed.data.service, _link: parsed.data.link, _quantity: parsed.data.quantity,
            });
            if (error) return j({ error: error.message }, 400);
            return j({ order: data });
          }

          if (action === "status") {
            const ids = (body.orders ?? body.order ?? "").toString().split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n));
            if (ids.length === 0) return j({ error: "orders required" }, 400);
            const { data } = await supabaseAdmin.from("orders").select("id,status,charge,start_count,remains").in("id", ids).eq("user_id", userId);
            const map: Record<string, any> = {};
            for (const o of data ?? []) {
              map[String(o.id)] = {
                charge: Number(o.charge).toFixed(4),
                start_count: String(o.start_count ?? 0),
                status: o.status,
                remains: String(o.remains ?? 0),
                currency: "USD",
              };
            }
            return j(ids.length === 1 ? (map[String(ids[0])] ?? { error: "not found" }) : map);
          }

          return j({ error: "unknown action" }, 400);
        } catch (e: any) {
          console.error("[reseller-api]", e);
          return j({ error: String(e?.message ?? "server error") }, 500);
        }
      },
    },
  },
});