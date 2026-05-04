import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";

export const Route = createFileRoute("/dashboard")({ component: DashboardLayout });

function DashboardLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-5 md:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}