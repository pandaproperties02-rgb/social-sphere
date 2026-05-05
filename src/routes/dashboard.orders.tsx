import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Order = {
  id: number;
  service_id: number;
  link: string;
  quantity: number;
  charge: number;
  status: string;
  created_at: string;
  remains: number;
  start_count: number;
  services: { name: string } | null;
};

export const Route = createFileRoute("/dashboard/orders")({ component: OrdersPage });

const statusColor: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
  partial: "bg-chart-4/15 text-chart-4",
  canceled: "bg-destructive/15 text-destructive",
};

function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshOrders = async () => {
    try {
      const { data, error: err } = await supabase
        .from("orders")
        .select("id,service_id,link,quantity,charge,status,created_at,remains,start_count,services(name)")
        .order("id", { ascending: false })
        .limit(200);
      
      if (err) throw err;
      setOrders((data ?? []) as Order[]);
      setError(null);
    } catch (err) {
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshOrders();
  }, []);

  const completeOrder = async (orderId: number) => {
    setCompleting(orderId);
    try {
      const { error: err } = await supabase
        .from("orders")
        .update({
          status: "completed",
          remains: 0,
          start_count: orders.find((o) => o.id === orderId)?.quantity ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      
      if (err) throw err;
      toast.success(`Order #${orderId} completed`);
      await refreshOrders();
    } catch (err) {
      toast.error(String(err?.message ?? err));
    } finally {
      setCompleting(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-muted-foreground">Your most recent 200 orders.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          Error loading orders: {error}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[80px_120px_1fr_100px_80px_110px_120px_110px] gap-3 px-4 py-3 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground bg-background/40">
          <div>ID</div>
          <div>Service</div>
          <div>Link</div>
          <div>Qty</div>
          <div>Started</div>
          <div>Charge</div>
          <div>Status</div>
          <div className="text-right">Action</div>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No orders yet.</div>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="grid grid-cols-[80px_120px_1fr_100px_80px_110px_120px_110px] gap-3 px-4 py-3 items-center border-t border-border/50 text-sm">
              <div className="font-mono text-xs">#{o.id}</div>
              <div className="text-xs truncate" title={o.services?.name}>{o.services?.name ?? `#${o.service_id}`}</div>
              <div className="truncate text-xs text-muted-foreground" title={o.link}>{o.link}</div>
              <div className="font-mono">{o.quantity.toLocaleString()}</div>
              <div className="font-mono text-xs">{o.start_count}/{o.quantity}</div>
              <div className="font-mono">${Number(o.charge).toFixed(4)}</div>
              <div>
                <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] ${statusColor[o.status] ?? "bg-muted"}`}>
                  {o.status}
                </span>
              </div>
              <div className="text-right">
                {o.status === "in_progress" && (
                  <button
                    disabled={completing === o.id}
                    onClick={() => completeOrder(o.id)}
                    className="text-xs px-2 py-1 rounded bg-success/15 text-success hover:bg-success/25 disabled:opacity-50"
                  >
                    {completing === o.id ? "…" : "✓"}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}