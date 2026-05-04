import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Category = { id: string; name: string };
type Service = { id: number; category_id: string; name: string; rate: number; min_order: number; max_order: number; description: string | null };

const searchSchema = z.object({ service: z.coerce.number().optional() });

export const Route = createFileRoute("/dashboard/new-order")({
  component: NewOrderPage,
  validateSearch: (s) => searchSchema.parse(s),
});

function NewOrderPage() {
  const { service: preselect } = Route.useSearch();
  const navigate = useNavigate();
  const [cats, setCats] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [serviceId, setServiceId] = useState<number | "">("");
  const [link, setLink] = useState("");
  const [qty, setQty] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, s] = await Promise.all([
        supabase.from("categories").select("id,name").order("sort_order"),
        supabase.from("services").select("id,category_id,name,rate,min_order,max_order,description").order("id").limit(5000),
      ]);
      const catRows = (c.data ?? []) as Category[];
      const svcRows = (s.data ?? []) as Service[];
      setCats(catRows);
      setServices(svcRows);
      if (preselect) {
        const found = svcRows.find((x) => x.id === preselect);
        if (found) {
          setCategoryId(found.category_id);
          setServiceId(found.id);
        }
      } else if (catRows[0]) {
        setCategoryId(catRows[0].id);
      }
    })();
  }, [preselect]);

  const visibleServices = useMemo(
    () => services.filter((s) => s.category_id === categoryId),
    [services, categoryId]
  );
  const selected = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId]
  );
  const charge = selected && qty ? (selected.rate * Number(qty)) / 1000 : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !qty || !link) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("place_order", {
      _service_id: selected.id,
      _link: link,
      _quantity: Number(qty),
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`Order #${data} placed`);
    navigate({ to: "/dashboard/orders" });
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">New order</h1>
        <p className="text-sm text-muted-foreground">Pick a service, paste your link and place an order.</p>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <Field label="Category">
          <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setServiceId(""); }}
            className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary">
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>

        <Field label="Service">
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="">— Select a service —</option>
            {visibleServices.map((s) => (
              <option key={s.id} value={s.id}>#{s.id} · {s.name} · ${Number(s.rate).toFixed(4)}/1k</option>
            ))}
          </select>
        </Field>

        {selected && (
          <div className="rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
            Min: <span className="text-foreground font-mono">{selected.min_order}</span> · Max:{" "}
            <span className="text-foreground font-mono">{selected.max_order.toLocaleString()}</span>
            {selected.description ? <div className="mt-1">{selected.description}</div> : null}
          </div>
        )}

        <Field label="Link">
          <input required value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…"
            className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
        </Field>

        <Field label="Quantity">
          <input required type="number" value={qty}
            min={selected?.min_order ?? 1} max={selected?.max_order ?? 1000000}
            onChange={(e) => setQty(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
        </Field>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Charge: </span>
            <span className="font-mono text-lg">${charge.toFixed(4)}</span>
          </div>
          <button disabled={submitting || !selected || !qty || !link}
            className="rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium disabled:opacity-50">
            {submitting ? "Placing…" : "Place order"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}