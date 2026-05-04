import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminProfitSummary } from "@/server/admin.functions";

export const Route = createFileRoute("/dashboard/admin/")({ component: AdminOverview });

function AdminOverview() {
  const fn = useServerFn(adminProfitSummary);
  const [s, setS] = useState<{ revenue: number; cost: number; profit: number; orders: number; completed: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { fn().then(setS).catch((e) => setErr(String(e?.message ?? e))); }, [fn]);

  if (err) return <div className="text-sm text-destructive">{err}</div>;
  if (!s) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const cards = [
    { label: "Revenue", value: `$${s.revenue.toFixed(2)}`, accent: "text-foreground" },
    { label: "Provider cost", value: `$${s.cost.toFixed(2)}`, accent: "text-muted-foreground" },
    { label: "Profit", value: `$${s.profit.toFixed(2)}`, accent: "text-success" },
    { label: "Orders", value: s.orders.toLocaleString(), accent: "text-foreground" },
    { label: "Completed", value: s.completed.toLocaleString(), accent: "text-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.label}</div>
          <div className={`mt-1 text-2xl font-semibold font-mono ${c.accent}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}