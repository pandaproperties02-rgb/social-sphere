import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Service = {
  id: number;
  name: string;
  rate: number;
  min_order: number;
  max_order: number;
  status: string;
  provider_id: string | null;
  providers: { name: string } | null;
};

export const Route = createFileRoute("/dashboard/admin/services")({ component: AdminServices });

function AdminServices() {
  const [rows, setRows] = useState<Service[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("services")
        .select("id,name,rate,min_order,max_order,status,provider_id,providers(name)")
        .order("id")
        .limit(2000);
      setRows((data ?? []) as Service[]);
    })();
  }, []);

  const toggle = async (s: Service) => {
    const next = s.status === "active" ? "disabled" : "active";
    await supabase.from("services").update({ status: next }).eq("id", s.id);
    setRows((r) => r.map((x) => (x.id === s.id ? { ...x, status: next } : x)));
  };

  const filtered = q ? rows.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()) || String(s.id).includes(q)) : rows;

  return (
    <div className="space-y-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full max-w-sm rounded-lg bg-card border border-border px-3 py-2 text-sm" />
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[70px_1.5fr_130px_120px_100px_100px] gap-3 px-4 py-3 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground bg-background/40">
          <div>ID</div><div>Service</div><div>Provider</div><div>Rate</div><div>Min/Max</div><div className="text-right">Status</div>
        </div>
        {filtered.slice(0, 500).map((s) => (
            <div key={s.id} className="grid grid-cols-[70px_1.5fr_130px_120px_100px_100px] gap-3 px-4 py-3 items-center border-t border-border/50 text-sm">
              <div className="font-mono text-xs">{s.id}</div>
              <div className="truncate">{s.name}</div>
              <div className="truncate text-xs text-muted-foreground" title={s.providers?.name ?? "Self-managed"}>{s.providers?.name ?? "Self-managed"}</div>
              <div className="font-mono">${Number(s.rate).toFixed(4)}</div>
              <div className="font-mono text-xs">{s.min_order}-{s.max_order}</div>
              <div className="text-right">
                <button onClick={() => toggle(s)} className={`rounded-md px-2 py-1 text-xs ${s.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                  {s.status}
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}