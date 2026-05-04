import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/mass-order")({ component: MassOrderPage });

function MassOrderPage() {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed = lines.map((line) => {
      const [sid, link, qty] = line.split("|").map((x) => x.trim());
      return { sid: Number(sid), link, qty: Number(qty) };
    });
    const bad = parsed.find((p) => !p.sid || !p.link || !p.qty);
    if (bad) return toast.error("Format: service_id | link | quantity");

    setSubmitting(true);
    let ok = 0, fail = 0;
    for (const p of parsed) {
      const { error } = await supabase.rpc("place_order", { _service_id: p.sid, _link: p.link, _quantity: p.qty });
      if (error) { fail++; toast.error(`#${p.sid}: ${error.message}`); } else ok++;
    }
    setSubmitting(false);
    toast.success(`${ok} placed, ${fail} failed`);
    if (ok > 0) navigate({ to: "/dashboard/orders" });
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Mass order</h1>
        <p className="text-sm text-muted-foreground">One order per line, format: <code className="text-foreground">service_id | link | quantity</code></p>
      </div>
      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="123 | https://instagram.com/foo | 1000&#10;456 | https://tiktok.com/@bar | 500"
          className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm font-mono outline-none focus:border-primary"
        />
        <button disabled={submitting || !text.trim()}
          className="rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium disabled:opacity-50">
          {submitting ? "Submitting…" : "Submit batch"}
        </button>
      </form>
    </div>
  );
}