import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/dashboard/tickets")({
  component: () => (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Tickets</h1>
      <p className="mt-2 text-sm text-muted-foreground">Open a support ticket. Coming next.</p>
    </div>
  ),
});