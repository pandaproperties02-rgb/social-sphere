import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/dashboard/child-panel")({
  component: () => (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Child Panel</h1>
      <p className="mt-2 text-sm text-muted-foreground">Spin up a branded reseller panel. Coming next.</p>
    </div>
  ),
});