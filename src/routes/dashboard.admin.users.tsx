import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListUsers, adminCreditWallet, adminSetRole } from "@/server/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/admin/users")({ component: AdminUsers });

type Row = { id: string; email: string | null; username: string | null; created_at: string; balance: number; roles: string[] };

function AdminUsers() {
  const list = useServerFn(adminListUsers);
  const credit = useServerFn(adminCreditWallet);
  const setRole = useServerFn(adminSetRole);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => list().then((r) => { setRows(r as Row[]); setLoading(false); });
  useEffect(() => { reload(); }, []);

  const onCredit = async (id: string) => {
    const v = prompt("Amount to credit (negative to debit):", "10");
    if (!v) return;
    const ref = prompt("Reference:", "manual top-up") ?? "manual";
    try { await credit({ data: { userId: id, amount: Number(v), reference: ref } }); toast.success("Wallet updated"); reload(); }
    catch (e: any) { toast.error(e?.message ?? "failed"); }
  };
  const toggleAdmin = async (r: Row) => {
    const isAdmin = r.roles.includes("admin");
    try { await setRole({ data: { userId: r.id, role: "admin", enabled: !isAdmin } }); toast.success(isAdmin ? "Admin removed" : "Admin granted"); reload(); }
    catch (e: any) { toast.error(e?.message ?? "failed"); }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-[1fr_140px_120px_100px_180px] gap-3 px-4 py-3 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground bg-background/40">
        <div>User</div><div>Username</div><div>Balance</div><div>Roles</div><div className="text-right">Actions</div>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="grid grid-cols-[1fr_140px_120px_100px_180px] gap-3 px-4 py-3 items-center border-t border-border/50 text-sm">
          <div className="truncate"><div>{r.email}</div><div className="font-mono text-[10px] text-muted-foreground">{r.id}</div></div>
          <div className="truncate text-xs">{r.username || "—"}</div>
          <div className="font-mono">${r.balance.toFixed(4)}</div>
          <div className="text-xs">{r.roles.join(", ") || "user"}</div>
          <div className="flex justify-end gap-2">
            <button onClick={() => onCredit(r.id)} className="rounded-md border border-border px-2 py-1 text-xs hover:border-primary">Credit</button>
            <button onClick={() => toggleAdmin(r)} className="rounded-md bg-primary/15 text-primary px-2 py-1 text-xs">{r.roles.includes("admin") ? "Revoke admin" : "Make admin"}</button>
          </div>
        </div>
      ))}
      {rows.length === 0 && <div className="p-6 text-sm text-muted-foreground">No users.</div>}
    </div>
  );
}