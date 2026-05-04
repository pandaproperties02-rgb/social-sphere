import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListProviders, adminUpsertProvider, adminDeleteProvider, adminRefreshProviderBalance, adminSyncProviderServices } from "@/server/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/admin/providers")({ component: AdminProviders });

type Row = { id: string; name: string; api_url: string; balance: number; is_active: boolean };

function AdminProviders() {
  const list = useServerFn(adminListProviders);
  const upsert = useServerFn(adminUpsertProvider);
  const del = useServerFn(adminDeleteProvider);
  const refreshBal = useServerFn(adminRefreshProviderBalance);
  const sync = useServerFn(adminSyncProviderServices);

  const [rows, setRows] = useState<Row[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", api_url: "", api_key: "", is_active: true });
  const [busy, setBusy] = useState<string | null>(null);

  const reload = () => list().then((r) => setRows(r as Row[]));
  useEffect(() => { reload(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await upsert({ data: form }); toast.success("Provider saved"); setShowForm(false); setForm({ name: "", api_url: "", api_key: "", is_active: true }); reload(); }
    catch (e: any) { toast.error(e?.message ?? "failed"); }
  };

  const onSync = async (id: string) => {
    setBusy(id);
    try { const r = await sync({ data: { id } }); toast.success(`Synced: ${r.inserted} new, ${r.updated} updated (${r.total} total)`); reload(); }
    catch (e: any) { toast.error(e?.message ?? "failed"); }
    finally { setBusy(null); }
  };
  const onBal = async (id: string) => {
    setBusy(id);
    try { const r = await refreshBal({ data: { id } }); toast.success(`Balance: $${r.balance}`); reload(); }
    catch (e: any) { toast.error(e?.message ?? "failed"); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Add upstream SMM providers (perfectpanel-compatible). Sync pulls their service catalog and applies your markup.</p>
        <button onClick={() => setShowForm((s) => !s)} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
          {showForm ? "Cancel" : "+ Add provider"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-4 grid md:grid-cols-2 gap-3">
          <input required placeholder="Name (e.g. Peakerr)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
          <input required placeholder="API URL (https://provider.com/api/v2)" value={form.api_url} onChange={(e) => setForm({ ...form, api_url: e.target.value })}
            className="rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
          <input required placeholder="API key" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            className="rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary md:col-span-2" />
          <button className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium md:col-span-2">Save</button>
        </form>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_100px_320px] gap-3 px-4 py-3 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground bg-background/40">
          <div>Provider</div><div>Balance</div><div>Active</div><div className="text-right">Actions</div>
        </div>
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[1fr_120px_100px_320px] gap-3 px-4 py-3 items-center border-t border-border/50 text-sm">
            <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground truncate">{r.api_url}</div></div>
            <div className="font-mono">${Number(r.balance).toFixed(2)}</div>
            <div className="text-xs">{r.is_active ? <span className="text-success">●</span> : <span className="text-muted-foreground">○</span>}</div>
            <div className="flex justify-end gap-2">
              <button disabled={busy === r.id} onClick={() => onBal(r.id)} className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50">Refresh balance</button>
              <button disabled={busy === r.id} onClick={() => onSync(r.id)} className="rounded-md bg-primary/15 text-primary px-2 py-1 text-xs disabled:opacity-50">{busy === r.id ? "Syncing…" : "Sync services"}</button>
              <button onClick={async () => { if (confirm("Delete provider?")) { await del({ data: { id: r.id } }); toast.success("Deleted"); reload(); } }}
                className="rounded-md text-destructive px-2 py-1 text-xs">Delete</button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="p-6 text-sm text-muted-foreground">No providers yet. Add one above to start syncing services.</div>}
      </div>
    </div>
  );
}