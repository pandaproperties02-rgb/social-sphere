import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Order = {
  id: number;
  service_id: number;
  link: string;
  quantity: number;
  charge: number;
  status: string;
  created_at: string;
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

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id,service_id,link,quantity,charge,status,created_at")
        .order("id", { ascending: false })
        .limit(200);
      setOrders((data ?? []) as Order[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-muted-foreground">Your most recent 200 orders.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[80px_90px_1fr_100px_110px_120px_140px] gap-3 px-4 py-3 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground bg-background/40">
          <div>ID</div>
          <div>Service</div>
          <div>Link</div>
          <div>Qty</div>
          <div>Charge</div>
          <div>Status</div>
          <div>Date</div>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No orders yet.</div>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="grid grid-cols-[80px_90px_1fr_100px_110px_120px_140px] gap-3 px-4 py-3 items-center border-t border-border/50 text-sm">
              <div className="font-mono text-xs">#{o.id}</div>
              <div className="font-mono text-xs text-muted-foreground">{o.service_id}</div>
              <div className="truncate text-xs text-muted-foreground" title={o.link}>{o.link}</div>
              <div className="font-mono">{o.quantity.toLocaleString()}</div>
              <div className="font-mono">${Number(o.charge).toFixed(4)}</div>
              <div>
                <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] ${statusColor[o.status] ?? "bg-muted"}`}>
                  {o.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}