import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListOrders, adminDispatchPendingOrders } from "@/server/admin.functions";
import { toast } from "sonner";

type Row = { id: number; user_id: string; service_id: number; link: string; quantity: number; charge: number; cost: number; status: string; provider_order_id: string | null; created_at: string; error: string | null };

export const Route = createFileRoute("/dashboard/admin/orders")({ component: AdminOrders });

function AdminOrders() {
  const list = useServerFn(adminListOrders);
  const dispatch = useServerFn(adminDispatchPendingOrders);
  const [rows, setRows] = useState<Row[]>([]);

  const reload = () => list().then((r) => setRows(r as Row[]));
  useEffect(() => { reload(); }, []);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={async () => { try { const r = await dispatch(); toast.success(`Dispatched ${r.dispatched}`); reload(); } catch (e: any) { toast.error(e?.message ?? "failed"); } }}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">Dispatch pending now</button>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[70px_70px_1fr_80px_90px_80px_120px_140px] gap-3 px-4 py-3 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground bg-background/40">
          <div>ID</div><div>SVC</div><div>Link</div><div>Qty</div><div>Charge</div><div>Cost</div><div>Status</div><div>Provider#</div>
        </div>
        {rows.map((o) => (
          <div key={o.id} className="grid grid-cols-[70px_70px_1fr_80px_90px_80px_120px_140px] gap-3 px-4 py-3 items-center border-t border-border/50 text-sm">
            <div className="font-mono text-xs">#{o.id}</div>
            <div className="font-mono text-xs">{o.service_id}</div>
            <div className="truncate text-xs text-muted-foreground" title={o.link}>{o.link}{o.error ? <div className="text-destructive text-[10px]">{o.error}</div> : null}</div>
            <div className="font-mono">{o.quantity.toLocaleString()}</div>
            <div className="font-mono">${Number(o.charge).toFixed(4)}</div>
            <div className="font-mono text-muted-foreground">${Number(o.cost).toFixed(4)}</div>
            <div className="text-xs">{o.status}</div>
            <div className="font-mono text-xs text-muted-foreground">{o.provider_order_id ?? "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}