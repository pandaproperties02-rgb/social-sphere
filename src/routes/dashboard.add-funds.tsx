import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { initPaystackCheckout, initMpesaSTKPush } from "@/rpc/payments";
import { useAuth } from "@/lib/auth";

type Tx = { id: string; amount: number; type: string; reference: string | null; created_at: string };

export const Route = createFileRoute("/dashboard/add-funds")({ component: AddFundsPage });

function AddFundsPage() {
  const { user } = useAuth();
  const paystack = useServerFn(initPaystackCheckout);
  const mpesa = useServerFn(initMpesaSTKPush);
  const [amount, setAmount] = useState<number | "">(10);
  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState("");
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

  const payPaystack = async () => {
    if (!amount || amount <= 0 || !user?.email) return;
    try {
      const r = await paystack({ data: { amount: Number(amount), email: user.email } });
      window.location.href = r.authorization_url;
    } catch (e: any) { toast.error(e?.message ?? "Paystack error"); }
  };
  const payMpesa = async () => {
    if (!amount || amount <= 0 || !phone) return;
    try {
      await mpesa({ data: { amount: Number(amount), phone } });
      toast.success("STK push sent. Check your phone.");
    } catch (e: any) { toast.error(e?.message ?? "M-Pesa error"); }
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Add funds</h1>
        <p className="text-sm text-muted-foreground">Pay with Paystack (cards) or M-Pesa, or log a manual top-up for testing.</p>
      </div>

      <form onSubmit={deposit} className="rounded-2xl border border-border bg-card p-6 flex items-end gap-3">
        <label className="flex-1">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Amount (USD)</span>
          <input type="number" min={1} max={10000} step="0.01" value={amount}
            onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
            className="mt-1.5 w-full rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
        </label>
        <button disabled={submitting} type="submit"
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium disabled:opacity-50">
          {submitting ? "Adding…" : "Manual"}
        </button>
        <button type="button" onClick={payPaystack}
          className="rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium">
          Pay with Paystack
        </button>
      </form>

      <div className="rounded-2xl border border-border bg-card p-6 flex items-end gap-3">
        <label className="flex-1">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">M-Pesa phone (2547XXXXXXXX)</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="254712345678"
            className="mt-1.5 w-full rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
        </label>
        <button type="button" onClick={payMpesa}
          className="rounded-lg bg-success text-success-foreground px-5 py-2.5 text-sm font-medium">
          Pay with M-Pesa
        </button>
      </div>

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