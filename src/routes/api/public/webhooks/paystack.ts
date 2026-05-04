import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/webhooks/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) return new Response("not configured", { status: 503 });

        const raw = await request.text();
        const sig = request.headers.get("x-paystack-signature") ?? "";
        const expected = createHmac("sha512", secret).update(raw).digest("hex");
        try {
          const a = Buffer.from(sig);
          const b = Buffer.from(expected);
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("invalid signature", { status: 401 });
          }
        } catch {
          return new Response("invalid signature", { status: 401 });
        }

        const event = JSON.parse(raw);
        if (event?.event === "charge.success") {
          const reference = event?.data?.reference as string | undefined;
          if (!reference) return new Response("ok");
          const { data: intent } = await supabaseAdmin
            .from("payment_intents")
            .select("id,status")
            .eq("reference", reference)
            .maybeSingle();
          if (!intent) return new Response("ok");
          if (intent.status === "paid") return new Response("ok");
          await supabaseAdmin.rpc("complete_payment_intent", {
            _intent_id: intent.id,
            _provider_ref: String(event?.data?.id ?? ""),
          });
        }
        return new Response("ok");
      },
    },
  },
});