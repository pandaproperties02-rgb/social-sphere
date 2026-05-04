import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------------- PAYSTACK ----------------
// Paystack expects amount in the lowest currency unit (kobo for NGN, cents for USD/GHS).
// We treat amount as USD whole units → cents = amount * 100.

export const initPaystackCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ amount: z.number().min(1).max(10000), email: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Paystack not configured. Add PAYSTACK_SECRET_KEY in project secrets.");

    const reference = "sw_" + crypto.randomUUID().replaceAll("-", "");
    const { error: insErr } = await supabaseAdmin.from("payment_intents").insert({
      user_id: context.userId, provider: "paystack", amount: data.amount, currency: "USD",
      status: "pending", reference,
    });
    if (insErr) throw new Error(insErr.message);

    // Use NGN by default if account is NG; this works with any Paystack account.
    // We send amount in *cents* assuming USD; Paystack will reject if not enabled.
    // For NGN accounts, change currency to NGN and convert externally before calling.
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.email,
        amount: Math.round(data.amount * 100),
        currency: "USD",
        reference,
        callback_url: `${process.env.SITE_URL ?? ""}/dashboard/add-funds`,
        metadata: { user_id: context.userId },
      }),
    });
    const body = await res.json();
    if (!res.ok || !body?.status) throw new Error(body?.message ?? "paystack init failed");
    return { authorization_url: body.data.authorization_url as string, reference };
  });

// ---------------- M-PESA (Daraja STK Push) ----------------
// Stub-ready: returns a clear error if credentials aren't set.
// Required secrets when you're ready: MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET,
// MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL.

async function mpesaAccessToken() {
  const k = process.env.MPESA_CONSUMER_KEY;
  const s = process.env.MPESA_CONSUMER_SECRET;
  if (!k || !s) throw new Error("M-Pesa not configured");
  const auth = btoa(`${k}:${s}`);
  const res = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
    headers: { Authorization: `Basic ${auth}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`M-Pesa auth failed: ${body?.errorMessage ?? res.statusText}`);
  return body.access_token as string;
}

export const initMpesaSTKPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ amount: z.number().min(1).max(150000), phone: z.string().regex(/^254\d{9}$/, "use 2547XXXXXXXX format") }).parse(d))
  .handler(async ({ data, context }) => {
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const callback = process.env.MPESA_CALLBACK_URL;
    if (!shortcode || !passkey || !callback) throw new Error("M-Pesa not configured. Add MPESA_* secrets to enable.");

    const token = await mpesaAccessToken();
    const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${ts}`);
    const reference = "swm_" + crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    await supabaseAdmin.from("payment_intents").insert({
      user_id: context.userId, provider: "mpesa", amount: data.amount, currency: "KES",
      status: "pending", reference, meta: { phone: data.phone },
    });

    const res = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortcode, Password: password, Timestamp: ts,
        TransactionType: "CustomerPayBillOnline", Amount: Math.round(data.amount),
        PartyA: data.phone, PartyB: shortcode, PhoneNumber: data.phone,
        CallBackURL: callback, AccountReference: reference, TransactionDesc: "Wallet top-up",
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.errorMessage ?? "stk push failed");
    return { reference, checkoutRequestId: body.CheckoutRequestID };
  });