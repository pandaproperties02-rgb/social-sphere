import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  providerListServices,
  providerBalance,
  providerAddOrder,
  providerStatus,
  normalizeStatus,
  type ProviderRow,
} from "./providers.server";

// All admin functions require admin role. We use the auth middleware to
// validate the bearer token, then check the role with the admin client.
async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

// ---------- USERS ----------
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,email,username,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const ids = (profiles ?? []).map((p) => p.id);
    const [{ data: wallets }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("wallets").select("user_id,balance").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const walletMap = new Map((wallets ?? []).map((w) => [w.user_id, Number(w.balance)]));
    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    }
    return (profiles ?? []).map((p) => ({
      ...p,
      balance: walletMap.get(p.id) ?? 0,
      roles: roleMap.get(p.id) ?? [],
    }));
  });

export const adminCreditWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), amount: z.number(), reference: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.rpc("admin_credit_wallet", {
      _user_id: data.userId, _amount: data.amount, _reference: data.reference,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), role: z.enum(["admin", "user"]), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.enabled) {
      await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    }
    return { ok: true };
  });

// ---------- PROVIDERS ----------
export const adminListProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.from("providers").select("id,name,api_url,balance,is_active,created_at").order("created_at");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpsertProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(100),
    api_url: z.string().url().max(500),
    api_key: z.string().min(4).max(500),
    is_active: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin.from("providers").update({
        name: data.name, api_url: data.api_url, api_key: data.api_key, is_active: data.is_active, updated_at: new Date().toISOString(),
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin.from("providers").insert({
      name: data.name, api_url: data.api_url, api_key: data.api_key, is_active: data.is_active,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins!.id };
  });

export const adminDeleteProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("providers").delete().eq("id", data.id);
    return { ok: true };
  });

export const adminRefreshProviderBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: prov, error } = await supabaseAdmin.from("providers").select("id,name,api_url,api_key").eq("id", data.id).single();
    if (error || !prov) throw new Error(error?.message ?? "provider not found");
    try {
      const balance = await providerBalance(prov as ProviderRow);
      await supabaseAdmin.from("providers").update({ balance, updated_at: new Date().toISOString() }).eq("id", data.id);
      return { balance };
    } catch (e: any) {
      throw new Error(`balance fetch failed: ${e?.message ?? "unknown"}`);
    }
  });

// ---------- SYNC SERVICES FROM A PROVIDER ----------
// Pulls the upstream catalog, ensures categories exist, and creates/updates
// services in our DB with our markup applied. Idempotent (matches by
// provider_id + provider_service_id).
export const adminSyncProviderServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: prov } = await supabaseAdmin.from("providers").select("id,name,api_url,api_key").eq("id", data.id).single();
    if (!prov) throw new Error("provider not found");

    const { data: settings } = await supabaseAdmin.from("app_settings").select("default_markup_percent").eq("id", 1).single();
    const markup = Number(settings?.default_markup_percent ?? 25);

    const services = await providerListServices(prov as ProviderRow);

    // Ensure categories
    const catNames = Array.from(new Set(services.map((s) => s.category)));
    const { data: existingCats } = await supabaseAdmin.from("categories").select("id,name").in("name", catNames);
    const catMap = new Map((existingCats ?? []).map((c) => [c.name, c.id]));
    const missing = catNames.filter((n) => !catMap.has(n));
    if (missing.length) {
      const { data: newCats } = await supabaseAdmin.from("categories").insert(missing.map((n) => ({ name: n }))).select("id,name");
      for (const c of newCats ?? []) catMap.set(c.name, c.id);
    }

    let inserted = 0, updated = 0;
    for (const s of services) {
      const provServiceId = String(s.service);
      const cost = Number(s.rate);
      const rate = +(cost * (1 + markup / 100)).toFixed(6);
      const min = Number(s.min) || 1;
      const max = Number(s.max) || 1000000;
      const category_id = catMap.get(s.category)!;

      const { data: existing } = await supabaseAdmin
        .from("services")
        .select("id")
        .eq("provider_id", prov.id)
        .eq("provider_service_id", provServiceId)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin.from("services").update({
          name: s.name, rate, cost_rate: cost, min_order: min, max_order: max,
          description: s.description ?? null, category_id, status: "active",
        }).eq("id", existing.id);
        updated++;
      } else {
        await supabaseAdmin.from("services").insert({
          name: s.name, rate, cost_rate: cost, min_order: min, max_order: max,
          description: s.description ?? null, category_id,
          provider_id: prov.id, provider_service_id: provServiceId,
        });
        inserted++;
      }
    }

    return { inserted, updated, total: services.length };
  });

// ---------- ORDERS / PROFIT ----------
export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("orders")
      .select("id,user_id,service_id,link,quantity,charge,cost,status,provider_order_id,created_at,error")
      .order("id", { ascending: false })
      .limit(300);
    return data ?? [];
  });

export const adminProfitSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin.from("orders").select("charge,cost,status,created_at").limit(10000);
    let revenue = 0, cost = 0, orders = 0, completed = 0;
    for (const o of data ?? []) {
      revenue += Number(o.charge);
      cost += Number(o.cost);
      orders++;
      if (o.status === "completed") completed++;
    }
    return { revenue: +revenue.toFixed(4), cost: +cost.toFixed(4), profit: +(revenue - cost).toFixed(4), orders, completed };
  });

// ---------- SETTINGS ----------
export const adminSetMarkup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ percent: z.number().min(0).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.rpc("set_markup", { _percent: data.percent });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGetSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin.from("app_settings").select("*").eq("id", 1).single();
    return data;
  });

// ---------- DISPATCH PENDING ORDERS ----------
// Forwards every pending order to its service's upstream provider.
// Called by the cron endpoint and can also be triggered manually.
export const adminDispatchPendingOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return await dispatchPending();
  });

export async function dispatchPending() {
  const { data: pending } = await supabaseAdmin
    .from("orders")
    .select("id,service_id,link,quantity")
    .eq("status", "pending")
    .is("provider_order_id", null)
    .limit(50);
  if (!pending || pending.length === 0) return { dispatched: 0 };

  let dispatched = 0;
  for (const o of pending) {
    const { data: svc } = await supabaseAdmin
      .from("services")
      .select("provider_id,provider_service_id")
      .eq("id", o.service_id)
      .single();
    if (!svc?.provider_id || !svc.provider_service_id) {
      await supabaseAdmin.from("orders").update({ status: "pending", error: "no provider mapped" }).eq("id", o.id);
      continue;
    }
    const { data: prov } = await supabaseAdmin
      .from("providers")
      .select("id,name,api_url,api_key,is_active")
      .eq("id", svc.provider_id)
      .single();
    if (!prov || !prov.is_active) {
      await supabaseAdmin.from("orders").update({ error: "provider inactive" }).eq("id", o.id);
      continue;
    }
    try {
      const { providerOrderId } = await providerAddOrder(prov as ProviderRow, {
        service: svc.provider_service_id, link: o.link, quantity: o.quantity,
      });
      await supabaseAdmin.from("orders").update({
        provider_order_id: providerOrderId, status: "in_progress", error: null, updated_at: new Date().toISOString(),
      }).eq("id", o.id);
      dispatched++;
    } catch (e: any) {
      await supabaseAdmin.from("orders").update({ error: String(e?.message ?? e).slice(0, 500) }).eq("id", o.id);
    }
  }
  return { dispatched };
}

// ---------- POLL ORDER STATUS ----------
export async function pollActiveOrders() {
  const { data: active } = await supabaseAdmin
    .from("orders")
    .select("id,provider_order_id,service_id")
    .in("status", ["in_progress", "pending"])
    .not("provider_order_id", "is", null)
    .limit(200);
  if (!active || active.length === 0) return { polled: 0, updated: 0 };

  // Group by provider
  const serviceIds = Array.from(new Set(active.map((o) => o.service_id)));
  const { data: svcs } = await supabaseAdmin.from("services").select("id,provider_id").in("id", serviceIds);
  const svcToProv = new Map((svcs ?? []).map((s) => [s.id, s.provider_id]));
  const groups = new Map<string, typeof active>();
  for (const o of active) {
    const pid = svcToProv.get(o.service_id);
    if (!pid) continue;
    if (!groups.has(pid)) groups.set(pid, []);
    groups.get(pid)!.push(o);
  }

  let updated = 0;
  for (const [pid, group] of groups) {
    const { data: prov } = await supabaseAdmin.from("providers").select("id,name,api_url,api_key").eq("id", pid).single();
    if (!prov) continue;
    const ids = group.map((o) => o.provider_order_id!).filter(Boolean);
    try {
      const result = await providerStatus(prov as ProviderRow, ids);
      for (const o of group) {
        const r = result[o.provider_order_id!];
        if (!r) continue;
        const status = normalizeStatus(r.status);
        const remains = r.remains != null ? Number(r.remains) : undefined;
        const start_count = r.start_count != null ? Number(r.start_count) : undefined;
        await supabaseAdmin.from("orders").update({
          status,
          ...(remains !== undefined ? { remains } : {}),
          ...(start_count !== undefined ? { start_count } : {}),
          updated_at: new Date().toISOString(),
        }).eq("id", o.id);
        updated++;
      }
    } catch (e) {
      // Skip group on error; cron will retry next tick.
    }
  }
  return { polled: active.length, updated };
}