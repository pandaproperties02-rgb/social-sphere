import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Wallet, LogOut, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
      if (active && data) setBalance(Number(data.balance));
    };
    load();
    supabase.from("profiles").select("trial_ends_at").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (active && data) setTrialEndsAt((data as any).trial_ends_at);
    });
    const ch = supabase
      .channel("wallet-" + user.id)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, (p) => {
        const b = (p.new as { balance: number }).balance;
        setBalance(Number(b));
      })
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [user]);

  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000)) : null;

  return (
    <header className="h-14 border-b border-border bg-card/40 backdrop-blur flex items-center justify-end gap-3 px-5">
      {trialDaysLeft !== null && trialDaysLeft > 0 && (
        <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary">
          <span className="font-medium">Free trial:</span>
          <span className="font-mono">{trialDaysLeft}d left</span>
        </div>
      )}
      <Link
        to="/dashboard/add-funds"
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:border-primary/60 transition-colors"
      >
        <Wallet className="h-4 w-4 text-primary" />
        <span className="font-mono">${balance !== null ? balance.toFixed(2) : "0.00"}</span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:border-primary/60">
          <UserIcon className="h-4 w-4" />
          <span className="max-w-[140px] truncate">{user?.email}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}