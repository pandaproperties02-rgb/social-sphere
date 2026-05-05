import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, ChevronDown, ChevronRight, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Category = { id: string; name: string };
type Service = {
  id: number;
  category_id: string;
  name: string;
  rate: number;
  min_order: number;
  max_order: number;
  avg_time: string | null;
  description: string | null;
  provider_id: string | null;
  providers: { name: string } | null;
};

export const Route = createFileRoute("/dashboard/services")({ component: ServicesPage });

function ServicesPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [favs, setFavs] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem("sw_favs") || "[]")); } catch { return new Set(); }
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [c, s] = await Promise.all([
          supabase.from("categories").select("id,name").order("sort_order"),
          supabase.from("services")
            .select("id,category_id,name,rate,min_order,max_order,avg_time,description,provider_id,providers(name)")
            .eq("status", "active")
            .not("provider_id", "is", null)
            .order("id")
            .limit(5000),
        ]);
        if (!active) return;
        
        if (c.error) throw c.error;
        if (s.error) throw s.error;
        
        const catRows = (c.data ?? []) as Category[];
        const svcRows = (s.data ?? []) as Service[];
        
        setCats(catRows);
        setServices(svcRows);
        setOpen(Object.fromEntries(catRows.map((x) => [x.id, true])));
        setError(null);
      } catch (err) {
        setError(String(err?.message ?? err));
      } finally {
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const toggleFav = (id: number) => {
    setFavs((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      localStorage.setItem("sw_favs", JSON.stringify([...n]));
      return n;
    });
  };

  const filtered = useMemo(() => {
    if (!q.trim()) return services;
    const term = q.toLowerCase();
    return services.filter(
      (s) => s.name.toLowerCase().includes(term) || String(s.id).includes(term)
    );
  }, [q, services]);

  const grouped = useMemo(() => {
    const m = new Map<string, Service[]>();
    for (const s of filtered) {
      const arr = m.get(s.category_id) ?? [];
      arr.push(s);
      m.set(s.category_id, arr);
    }
    return m;
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Services</h1>
          <p className="text-sm text-muted-foreground">{services.length.toLocaleString()} services available</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          Error loading services: {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xl">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search services by name or ID…"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-card border border-border text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading services…</div>
      ) : services.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No live services available yet. Please check back soon.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="hidden md:grid grid-cols-[40px_70px_1.2fr_120px_90px_110px_140px_120px_90px] gap-3 px-4 py-3 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground bg-background/40">
            <div></div>
            <div>ID</div>
            <div>Service</div>
            <div>Provider</div>
            <div>Rate /1000</div>
            <div>Min</div>
            <div>Max</div>
            <div>Avg time</div>
            <div className="text-right">Action</div>
          </div>

          {cats.map((cat) => {
            const rows = grouped.get(cat.id) ?? [];
            if (q && rows.length === 0) return null;
            const isOpen = open[cat.id] ?? true;
            return (
              <div key={cat.id} className="border-b border-border last:border-0">
                <button
                  onClick={() => setOpen((o) => ({ ...o, [cat.id]: !isOpen }))}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-background/30 hover:bg-background/60 transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {cat.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{rows.length} services</span>
                </button>
                {isOpen && rows.map((s) => (
                  <div key={s.id} className="grid grid-cols-[40px_70px_1.2fr_120px_90px_110px_140px_120px_90px] gap-3 px-4 py-3 items-center border-t border-border/50 hover:bg-background/30 text-sm">
                    <button onClick={() => toggleFav(s.id)} aria-label="Favorite">
                      <Star className={`h-4 w-4 ${favs.has(s.id) ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                    </button>
                    <div className="font-mono text-xs text-muted-foreground">{s.id}</div>
                    <div className="truncate" title={s.name}>{s.name}</div>
                    <div className="truncate text-xs text-muted-foreground" title={s.providers?.name ?? "Live production"}>{s.providers?.name ?? "Live production"}</div>
                    <div className="font-mono">${Number(s.rate).toFixed(4)}</div>
                    <div className="font-mono text-muted-foreground">{s.min_order}</div>
                    <div className="font-mono text-muted-foreground">{s.max_order.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{s.avg_time || "—"}</div>
                    <div className="text-right">
                      <Link
                        to="/dashboard/new-order"
                        search={{ service: s.id }}
                        className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90"
                      >
                        Order
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}