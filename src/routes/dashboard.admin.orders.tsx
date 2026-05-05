import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListOrders, adminCompleteOrders } from "@/rpc/admin";
import { toast } from "sonner";

type Row = { id: number; user_id: string; service_id: number; link: string; quantity: number; charge: number; status: string; created_at: string; error: string | null };

export const Route = createFileRoute("/dashboard/admin/orders")({ component: AdminOrders });

function AdminOrders() {
  const list = useServerFn(adminListOrders);
  const complete = useServerFn(adminCompleteOrders);
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      setLoading(true);
      const data = await list();
      setRows(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load orders");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [list]);

  const onComplete = async () => {
    if (selected.size === 0) return;
    try {
      await complete({ data: { orderIds: Array.from(selected) } });
      toast.success(`Completed ${selected.size} orders`);
      setSelected(new Set());
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "failed");
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          Error: {error}
        </div>
      )}
      <div className="flex justify-between">
        <div className="text-sm text-muted-foreground">Select orders to complete delivery.</div>
        <button onClick={onComplete} disabled={selected.size === 0}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50">Complete selected ({selected.size})</button>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[50px_70px_70px_1fr_80px_90px_120px] gap-3 px-4 py-3 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground bg-background/40">
          <div></div><div>ID</div><div>SVC</div><div>Link</div><div>Qty</div><div>Charge</div><div>Status</div>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading orders…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No orders found.</div>
        ) : (
          rows.map((o) => (
          <div key={o.id} className="grid grid-cols-[50px_70px_70px_1fr_80px_90px_120px] gap-3 px-4 py-3 items-center border-t border-border/50 text-sm">
            <input type="checkbox" checked={selected.has(o.id)} onChange={(e) => {
              const s = new Set(selected);
              if (e.target.checked) s.add(o.id); else s.delete(o.id);
              setSelected(s);
            }} />
            <div className="font-mono text-xs">#{o.id}</div>
            <div className="font-mono text-xs">{o.service_id}</div>
            <div className="truncate text-xs text-muted-foreground" title={o.link}>{o.link}{o.error ? <div className="text-destructive text-[10px]">{o.error}</div> : null}</div>
            <div className="font-mono">{o.quantity.toLocaleString()}</div>
            <div className="font-mono">${Number(o.charge).toFixed(4)}</div>
            <div className="text-xs">{o.status}</div>
          </div>
        ))
        )}
      </div>
    </div>
  );
}