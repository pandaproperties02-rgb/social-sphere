import { createFileRoute } from "@tanstack/react-router";
import { runProductionBot } from "@/server/production.bot";

// Cron endpoint. Called every minute by pg_cron.
// Runs the live production bot to move pending orders into production and finish aged in-progress orders.
export const Route = createFileRoute("/api/public/hooks/poll-orders")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await runProductionBot();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[poll-orders]", e);
          return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST to run" }),
    },
  },
});