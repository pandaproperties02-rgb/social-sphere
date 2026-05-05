import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminProductionStatus, adminRunProductionBot } from "@/rpc/admin";
import { toast } from "sonner";

type Status = { pending: number; in_progress: number; completed: number; canceled: number; other: number };

export const Route = createFileRoute("/dashboard/admin/production")({ component: AdminProduction });

function AdminProduction() {
  const statusFn = useServerFn(adminProductionStatus);
  const runFn = useServerFn(adminRunProductionBot);
  const [status, setStatus] = useState<Status | null>(null);
  const [running, setRunning] = useState(false);

  const reload = async () => {
    try {
      const result = await statusFn();
      setStatus(result as Status);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load production status");
    }
  };

  useEffect(() => { reload(); }, []);

  const runBot = async () => {
    setRunning(true);
    try {
      const result = await runFn();
      toast.success(`Production bot ran: started ${result.started}, completed ${result.completed}`);
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Production bot failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Production bot</h1>
          <p className="text-sm text-muted-foreground">Run the live production bot to move pending orders into production and complete aged in-progress orders.</p>
        </div>
        <button onClick={runBot} disabled={running} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50">
          {running ? "Running…" : "Run production bot"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {status ? (
          [
            { label: "Pending", value: status.pending },
            { label: "In progress", value: status.in_progress },
            { label: "Completed", value: status.completed },
            { label: "Canceled", value: status.canceled },
            { label: "Other", value: status.other },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-border bg-card p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{card.label}</div>
              <div className="mt-1 text-2xl font-semibold font-mono">{card.value}</div>
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading production status…</div>
        )}
      </div>
    </div>
  );
}
