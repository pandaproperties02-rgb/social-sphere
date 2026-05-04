import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/dashboard/api")({ component: () => <Coming title="API" /> });
function Coming({ title }: { title: string }) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">This module is on the roadmap. Reseller API endpoints (<code>/api/order</code>, <code>/api/status</code>, <code>/api/services</code>, <code>/api/balance</code>) ship in the next slice.</p>
    </div>
  );
}