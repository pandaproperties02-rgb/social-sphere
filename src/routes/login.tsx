import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/dashboard/services" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-8">
        <Link to="/" className="text-xs text-muted-foreground">← Back</Link>
        <h1 className="mt-3 text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground mt-1">to your Social World account</p>
        <div className="mt-6 space-y-3">
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
          <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
        <button disabled={loading} className="mt-5 w-full rounded-lg bg-primary text-primary-foreground py-2.5 font-medium disabled:opacity-60">
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <p className="mt-4 text-sm text-center text-muted-foreground">
          No account? <Link to="/signup" className="text-primary">Sign up</Link>
        </p>
      </form>
    </div>
  );
}