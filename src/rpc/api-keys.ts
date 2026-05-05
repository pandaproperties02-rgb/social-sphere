import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function generateKey() {
  // 32 bytes → 64 hex chars, prefixed for readability.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "sw_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const getMyApiKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { data } = await supabaseAdmin.from("api_keys").select("key,created_at,last_used_at").eq("user_id", context.userId).maybeSingle();
      return data;
    } catch (error) {
      console.error("Error fetching API key:", error);
      return null;
    }
  });

export const rotateMyApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const key = generateKey();
      await supabaseAdmin.from("api_keys").upsert({ user_id: context.userId, key, created_at: new Date().toISOString(), last_used_at: null }, { onConflict: "user_id" });
      return { key };
    } catch (error) {
      console.error("Error rotating API key:", error);
      throw new Error("Failed to rotate API key");
    }
  });