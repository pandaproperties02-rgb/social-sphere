import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingCart, LayoutGrid, ListOrdered, Wallet, Code2, Users, GitBranch, LifeBuoy, Layers } from "lucide-react";

const items = [
  { to: "/dashboard/new-order", label: "New Order", icon: ShoppingCart },
  { to: "/dashboard/services", label: "Services", icon: LayoutGrid },
  { to: "/dashboard/orders", label: "Orders", icon: ListOrdered },
  { to: "/dashboard/add-funds", label: "Add Funds", icon: Wallet },
  { to: "/dashboard/api", label: "API", icon: Code2 },
  { to: "/dashboard/affiliates", label: "Affiliates", icon: Users },
  { to: "/dashboard/child-panel", label: "Child Panel", icon: GitBranch },
  { to: "/dashboard/tickets", label: "Tickets", icon: LifeBuoy },
  { to: "/dashboard/mass-order", label: "Mass Order", icon: Layers },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground">S</div>
          <div>
            <div className="font-semibold leading-tight">Social World</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">SMM Panel</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {items.map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 text-[11px] text-muted-foreground border-t border-border">
        © Social World
      </div>
    </aside>
  );
}