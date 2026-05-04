import { createFileRoute } from "@tanstack/react-router";
import { dispatchPending, pollActiveOrders } from "@/server/admin.functions";

// Cron endpoint. Called every minute by pg_cron.
// Runs dispatch (send pending → upstream) then poll (refresh in-progress).
export const Route = createFileRoute("/api/public/hooks/poll-orders")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const dispatched = await dispatchPending();
          const polled = await pollActiveOrders();
          return Response.json({ ok: true, dispatched, polled });
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