import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/admin")({ component: AdminLayout });

function AdminLayout() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user]);

  if (loading || isAdmin === null) return <div className="text-sm text-muted-foreground">Loading admin…</div>;
  if (!isAdmin) {
    return (
      <div className="max-w-2xl rounded-2xl border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">Admin only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account does not have admin role. Ask an existing admin to grant it, or run this SQL in the database tools:
        </p>
        <pre className="mt-3 rounded-lg bg-background/40 border border-border p-3 text-[11px] font-mono overflow-auto">
{`INSERT INTO public.user_roles(user_id, role)
VALUES ('${user?.id ?? "<your-user-id>"}', 'admin')
ON CONFLICT DO NOTHING;`}
        </pre>
      </div>
    );
  }

  const tabs = [
    { to: "/dashboard/admin", label: "Overview" },
    { to: "/dashboard/admin/users", label: "Users" },
    { to: "/dashboard/admin/services", label: "Services" },
    { to: "/dashboard/admin/orders", label: "Orders" },
    { to: "/dashboard/admin/production", label: "Production" },
    { to: "/dashboard/admin/settings", label: "Settings" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="text-sm text-muted-foreground">Operate the platform.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = pathname === t.to;
          return (
            <Link key={t.to} to={t.to}
              className={`px-3 py-2 text-sm rounded-t-md border-b-2 transition-colors ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}