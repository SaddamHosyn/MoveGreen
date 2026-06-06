import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Trophy, Leaf, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/company/$slug")({
  ssr: false,
  component: CompanyPublic,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Company not found.</p>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function CompanyPublic() {
  const { slug } = Route.useParams();

  const { data: company, isLoading } = useQuery({
    queryKey: ["company-public", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_company_by_slug", { _slug: slug });
      if (error) throw error;
      const row = data?.[0];
      if (!row) throw notFound();
      return row;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["company-members", company?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_company_user_leaderboard", {
        _company_id: company!.company_id, _limit: 25, _offset: 0,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!company?.company_id,
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!company) return null;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Leaf className="h-4 w-4" />
            </div>
            <span className="font-display font-semibold">MoveGreen</span>
          </Link>
          <Button asChild variant="outline" size="sm"><Link to="/auth">Sign in</Link></Button>
        </div>
      </nav>

      <header className="border-b border-border bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Building2 className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold md:text-4xl">{company.name}</h1>
              <p className="text-sm text-muted-foreground">/company/{company.public_slug}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <Stat icon={Trophy} label="Avg pts / active member" value={`${Number(company.avg_points ?? 0)} pts`} />
            <Stat icon={Trophy} label="Global rank" value={company.global_rank ? `#${company.global_rank}` : "—"} />
            <Stat icon={Users} label="Active members" value={`${company.active_member_count}/${company.member_count}`} />
            <Stat icon={Trophy} label="Total points" value={`${company.total_points} pts`} />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display"><Trophy className="h-5 w-5 text-leaf" /> Top members</CardTitle>
          </CardHeader>
          <CardContent>
            {(!members || members.length === 0) ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-1">
                {members.map((m: any) => (
                  <li key={m.user_id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 text-center font-display text-sm font-semibold ${m.rank <= 3 ? "text-primary" : "text-muted-foreground"}`}>#{m.rank}</span>
                      <p className="font-medium">{m.name}</p>
                    </div>
                    <span className="font-display font-semibold">{m.total_points} pts</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-leaf" />
      </div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
