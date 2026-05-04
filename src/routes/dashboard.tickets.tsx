import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type Ticket = { id: number; subject: string; status: string; created_at: string };

export const Route = createFileRoute("/dashboard/tickets")({ component: TicketsPage });

function TicketsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const reload = async () => {
    const { data } = await supabase.from("tickets").select("id,subject,status,created_at").order("id", { ascending: false }).limit(100);
    setRows((data ?? []) as Ticket[]);
  };
  useEffect(() => { reload(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !subject.trim() || !body.trim()) return;
    const { data: t, error } = await supabase.from("tickets").insert({ subject: subject.trim(), user_id: user.id }).select("id").single();
    if (error) return toast.error(error.message);
    await supabase.from("ticket_messages").insert({ ticket_id: t!.id, user_id: user.id, body: body.trim(), is_admin: false });
    setSubject(""); setBody(""); toast.success("Ticket opened"); reload();
  };

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold">Tickets</h1>
      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <input required placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm" />
        <textarea required placeholder="Describe your issue…" rows={4} value={body} onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm" />
        <button className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">Open ticket</button>
      </form>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {rows.length === 0 ? <div className="p-6 text-sm text-muted-foreground">No tickets yet.</div> : rows.map((t) => (
          <div key={t.id} className="px-4 py-3 border-t border-border/50 first:border-0 flex items-center justify-between text-sm">
            <div><div>#{t.id} · {t.subject}</div><div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div></div>
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px]">{t.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}