import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyApiKey, rotateMyApiKey } from "@/rpc/api-keys";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/api")({ component: ApiPage });

function ApiPage() {
  const get = useServerFn(getMyApiKey);
  const rotate = useServerFn(rotateMyApiKey);
  const [key, setKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/public/v2/api` : "/api/public/v2/api";

  useEffect(() => { 
    get().then((d: any) => { setKey(d?.key ?? null); setLoading(false); }).catch(() => setLoading(false)); 
  }, []);

  const onRotate = async () => {
    try { const r = await rotate(); setKey(r.key); toast.success("New key generated"); }
    catch (e: any) { toast.error(e?.message ?? "failed"); }
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Reseller API</h1>
        <p className="text-sm text-muted-foreground">Perfectpanel-compatible. Same actions your customers already know.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Endpoint</div>
        <code className="block rounded-lg bg-background/40 border border-border px-3 py-2 text-sm font-mono break-all">{endpoint}</code>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mt-3">Your API key</div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : key ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-background/40 border border-border px-3 py-2 text-sm font-mono break-all">{key}</code>
            <button onClick={() => { navigator.clipboard.writeText(key); toast.success("Copied"); }} className="rounded-md border border-border px-3 py-2 text-xs">Copy</button>
            <button onClick={onRotate} className="rounded-md bg-primary/15 text-primary px-3 py-2 text-xs">Rotate</button>
          </div>
        ) : (
          <button onClick={onRotate} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">Generate API key</button>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-medium">Actions</h2>
        <Snippet title="Balance" body={`POST ${endpoint}\nkey=YOUR_KEY&action=balance`} />
        <Snippet title="Services list" body={`POST ${endpoint}\nkey=YOUR_KEY&action=services`} />
        <Snippet title="Place order" body={`POST ${endpoint}\nkey=YOUR_KEY&action=add&service=123&link=https://...&quantity=1000`} />
        <Snippet title="Order status" body={`POST ${endpoint}\nkey=YOUR_KEY&action=status&orders=1,2,3`} />
      </div>
    </div>
  );
}

function Snippet({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{title}</div>
      <pre className="rounded-lg bg-background/40 border border-border px-3 py-2 text-xs font-mono overflow-auto whitespace-pre-wrap">{body}</pre>
    </div>
  );
}