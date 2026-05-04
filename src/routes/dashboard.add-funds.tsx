import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Tx = { id: string; amount: number; type: string; reference: string | null; created_at: string };

export const Route = createFileRoute("/dashboard/add-funds")({ component: AddFundsPage });

function AddFundsPage() {
  const [amount, setAmount] = useState<number | "">(10);
  const [submitting, setSubmitting] = useState(false);
  const [txs, setTxs] = useState<Tx[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("wallet_transactions")
      .select("id,amount,type,reference,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setTxs((data ?? []) as Tx[]);
  };
  useEffect(() => { load(); }, []);

  const deposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("add_funds", { _amount: Number(amount) });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`Added $${Number(amount).toFixed(2)}`);
    load();
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Add funds</h1>
        <p className="text-sm text-muted-foreground">Manual top-up (Paystack &amp; M-Pesa coming soon).</p>
      </div>

      <form onSubmit={deposit} className="rounded-2xl border border-border bg-card p-6 flex items-end gap-3">
        <label className="flex-1">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Amount (USD)</span>
          <input type="number" min={1} max={10000} step="0.01" value={amount}
            onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
            className="mt-1.5 w-full rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
        </label>
        <button disabled={submitting}
          className="rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium disabled:opacity-50">
          {submitting ? "Adding…" : "Add funds"}
        </button>
      </form>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_120px_180px] gap-3 px-4 py-3 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground bg-background/40">
          <div>Reference</div>
          <div>Type</div>
          <div>Amount</div>
          <div>Date</div>
        </div>
        {txs.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No transactions yet.</div>
        ) : (
          txs.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_120px_120px_180px] gap-3 px-4 py-3 items-center border-t border-border/50 text-sm">
              <div className="text-xs text-muted-foreground truncate">{t.reference}</div>
              <div className="text-xs">{t.type}</div>
              <div className={`font-mono ${Number(t.amount) >= 0 ? "text-success" : "text-primary"}`}>
                {Number(t.amount) >= 0 ? "+" : ""}${Number(t.amount).toFixed(4)}
              </div>
              <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}