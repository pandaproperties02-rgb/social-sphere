import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getProductionStatus, runProductionBot } from "../server/production.bot";

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

// ---------- ORDERS / PROFIT ----------
export const adminListOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ refreshKey: z.number().optional() }).optional().parse(d))
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("id,user_id,service_id,link,quantity,charge,status,created_at,error")
      .order("id", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminProfitSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin.from("orders").select("charge,status,created_at").limit(10000);
    let revenue = 0, orders = 0, completed = 0, in_progress = 0, pending = 0;
    for (const o of data ?? []) {
      revenue += Number(o.charge);
      orders++;
      if (o.status === "completed") completed++;
      if (o.status === "in_progress") in_progress++;
      if (o.status === "pending") pending++;
    }
    return {
      revenue: +revenue.toFixed(4),
      profit: +revenue.toFixed(4),
      orders,
      completed,
      in_progress,
      pending,
    };
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

export const adminProductionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return await getProductionStatus();
  });

export const adminRunProductionBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return await runProductionBot();
  });

// ---------- COMPLETE ORDERS ----------
// For own deliveries, mark orders as completed.
export const adminCompleteOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderIds: z.array(z.number()) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "completed", remains: 0, start_count: 0, updated_at: new Date().toISOString() })
      .in("id", data.orderIds)
      .in("status", ["in_progress", "pending"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

