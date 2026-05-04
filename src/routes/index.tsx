import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Zap, Shield, Globe2 } from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold">S</div>
            <span className="font-semibold">Social World</span>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/login" className="text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link to="/signup" className="rounded-lg bg-primary text-primary-foreground px-4 py-2 font-medium">Get started</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> 1,000+ services live
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight">
            The SMM marketplace built for <span className="text-primary">scale</span>.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            Followers, likes, views, comments and more — across Instagram, TikTok, YouTube and beyond. Wallet-based, instant orders, real-time delivery.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-3 font-medium">
              Create account <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 font-medium hover:border-primary/60">
              Sign in
            </Link>
          </div>
        </div>

        <div className="mt-20 grid sm:grid-cols-3 gap-4">
          {[
            { icon: Zap, title: "Instant orders", body: "Atomic wallet deduction and dispatch in milliseconds." },
            { icon: Shield, title: "Secure by default", body: "Per-user RLS, audited functions, no shared keys." },
            { icon: Globe2, title: "Global delivery", body: "Multi-currency wallet, worldwide service catalog." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
              <f.icon className="h-5 w-5 text-primary mb-3" />
              <div className="font-medium">{f.title}</div>
              <p className="text-sm text-muted-foreground mt-1">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
