import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { executeOrder } from "./order-executor";

export async function startProductionOrders(limit = 50) {
  const { data: pending, error: fetchError } = await supabaseAdmin
    .from("orders")
    .select("id,quantity")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (fetchError) throw new Error(fetchError.message);
  if (!pending?.length) return { started: 0 };

  let started = 0;
  for (const order of pending) {
    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        status: "in_progress",
        start_count: 0,
        remains: order.quantity,
        updated_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", order.id);
    if (!error) started++;
  }

  return { started };
}

export async function completeProductionOrders(thresholdMinutes = 10, limit = 50) {
  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();
  const { data: inProgress, error: fetchError } = await supabaseAdmin
    .from("orders")
    .select("id,quantity")
    .eq("status", "in_progress")
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (fetchError) throw new Error(fetchError.message);
  if (!inProgress?.length) return { completed: 0, failed: 0 };

  let completed = 0;
  let failed = 0;

  for (const order of inProgress) {
    const success = await executeOrder(order.id);
    if (success) {
      completed++;
    } else {
      failed++;
      // Mark as failed or keep in progress
      await supabaseAdmin
        .from("orders")
        .update({
          error: "Execution failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
    }
  }

  return { completed, failed };
}

export async function runProductionBot() {
  const started = await startProductionOrders();
  const completed = await completeProductionOrders();
  return { ok: true, started, completed };
}

export async function getProductionStatus() {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("status");
  if (error) throw new Error(error.message);

  const stats = { pending: 0, in_progress: 0, completed: 0, canceled: 0, other: 0 };
  for (const order of data ?? []) {
    const status = order.status ?? "other";
    if (status in stats) {
      stats[status as keyof typeof stats]++;
    } else {
      stats.other++;
    }
  }
  return stats;
}
