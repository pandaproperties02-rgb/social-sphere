import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminGetSettings, adminSetMarkup } from "@/rpc/admin";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/admin/settings")({ component: AdminSettings });

function AdminSettings() {
  const get = useServerFn(adminGetSettings);
  const setMarkup = useServerFn(adminSetMarkup);
  const [percent, setPercent] = useState<number | "">("");
  const [currency, setCurrency] = useState("USD");

  useEffect(() => { get().then((s: any) => { setPercent(Number(s?.default_markup_percent ?? 25)); setCurrency(s?.currency ?? "USD"); }); }, []);

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-medium">Default markup</h2>
        <p className="text-xs text-muted-foreground">Applied when syncing service catalogs from providers. Existing services keep their current rate.</p>
        <div className="flex items-end gap-3">
          <label className="flex-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Markup %</span>
            <input type="number" min={0} max={1000} step="0.1" value={percent} onChange={(e) => setPercent(e.target.value ? Number(e.target.value) : "")}
              className="mt-1.5 w-full rounded-lg bg-input border border-border px-3 py-2 text-sm" />
          </label>
          <button onClick={async () => { if (percent === "") return; try { await setMarkup({ data: { percent: Number(percent) } }); toast.success("Saved"); } catch (e: any) { toast.error(e?.message ?? "failed"); } }}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">Save</button>
        </div>
        <div className="text-xs text-muted-foreground">Currency: {currency}</div>
      </div>
    </div>
  );
}