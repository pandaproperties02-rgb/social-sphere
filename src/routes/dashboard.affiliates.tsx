import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/dashboard/affiliates")({
  component: () => (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Affiliates</h1>
      <p className="mt-2 text-sm text-muted-foreground">Earn commission on every referral. Coming next.</p>
    </div>
  ),
});