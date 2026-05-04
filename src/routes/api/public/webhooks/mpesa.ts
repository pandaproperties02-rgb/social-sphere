import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// M-Pesa Daraja sends a result callback to MPESA_CALLBACK_URL.
// We match it back to our payment_intent by AccountReference (set in stkpush).
export const Route = createFileRoute("/api/public/webhooks/mpesa")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null) as any;
        try {
          const stk = body?.Body?.stkCallback;
          if (!stk) return Response.json({ ResultCode: 0, ResultDesc: "ok" });
          const items: Array<{ Name: string; Value: any }> = stk?.CallbackMetadata?.Item ?? [];
          const accountRef = items.find((i) => i.Name === "AccountReference")?.Value as string | undefined;
          const mpesaReceipt = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value as string | undefined;

          if (stk.ResultCode === 0 && accountRef) {
            const { data: intent } = await supabaseAdmin
              .from("payment_intents").select("id,status").eq("reference", accountRef).maybeSingle();
            if (intent && intent.status !== "paid") {
              await supabaseAdmin.rpc("complete_payment_intent", { _intent_id: intent.id, _provider_ref: mpesaReceipt ?? "" });
            }
          } else if (accountRef) {
            await supabaseAdmin.from("payment_intents").update({ status: "failed", updated_at: new Date().toISOString() }).eq("reference", accountRef);
          }
        } catch (e) {
          console.error("[mpesa-webhook]", e);
        }
        return Response.json({ ResultCode: 0, ResultDesc: "ok" });
      },
    },
  },
});