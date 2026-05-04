import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { username },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created");
    navigate({ to: "/dashboard/services" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-8">
        <Link to="/" className="text-xs text-muted-foreground">← Back</Link>
        <h1 className="mt-3 text-2xl font-semibold">Create account</h1>
        <p className="text-sm text-muted-foreground mt-1">Start ordering in seconds</p>
        <div className="mt-6 space-y-3">
          <input required placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
          <input type="password" required minLength={8} placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
        <button disabled={loading} className="mt-5 w-full rounded-lg bg-primary text-primary-foreground py-2.5 font-medium disabled:opacity-60">
          {loading ? "Creating..." : "Create account"}
        </button>
        <p className="mt-4 text-sm text-center text-muted-foreground">
          Have an account? <Link to="/login" className="text-primary">Sign in</Link>
        </p>
      </form>
    </div>
  );
}