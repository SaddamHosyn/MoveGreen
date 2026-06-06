import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Leaf, Trophy, Users, ArrowRight, Bike, Bus, Footprints, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Landing,
});

function Landing() {
  const { data: companies } = useQuery({
    queryKey: ["pub-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_company_leaderboard", { _limit: 10, _offset: 0 });
      if (error) throw error;
      return data;
    },
  });

  const { data: topUsers } = useQuery({
    queryKey: ["pub-top-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top_users", { _limit: 10, _offset: 0 });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Leaf className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-semibold">MoveGreen</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
            <Button asChild><Link to="/auth">Get started</Link></Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              <Leaf className="h-3.5 w-3.5" /> Sustainable mobility, gamified
            </div>
            <h1 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">
              Move green. Earn points. <span className="text-primary">Beat your company.</span>
            </h1>
            <p className="mt-4 text-base text-muted-foreground md:text-lg">
              Track every walk, bike ride, bus trip, or carpool. Climb the leaderboard with your colleagues and put your organization on the global green map.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/auth">Start competing <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
              <Button asChild size="lg" variant="outline"><a href="#leaderboard">View leaderboard</a></Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard icon={Footprints} label="Walking" value="2.0 pts/km" />
            <StatCard icon={Bike} label="Cycling" value="1.5 pts/km" />
            <StatCard icon={Zap} label="E-Bike" value="1.2 pts/km" />
            <StatCard icon={Bus} label="Bus" value="1.0 pts/km" />
            <StatCard icon={Users} label="Carpooling" value="0.5 pts/km" />
          </div>
        </div>
      </section>

      {/* Leaderboards */}
      <section id="leaderboard" className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Trophy className="h-5 w-5 text-leaf" /> Top Companies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {(companies ?? []).map((c: any) => (
                  <li key={c.company_id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 hover:bg-secondary">
                    <Link to="/company/$slug" params={{ slug: c.public_slug }} className="flex items-center gap-3">
                      <span className="w-6 text-sm font-semibold text-muted-foreground">#{c.rank}</span>
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.member_count} members</p>
                      </div>
                    </Link>
                    <span className="font-display font-semibold text-primary">{c.total_points} pts</span>
                  </li>
                ))}
                {(!companies || companies.length === 0) && <EmptyRow text="No companies yet" />}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Trophy className="h-5 w-5 text-leaf" /> Top Movers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {(topUsers ?? []).map((u: any) => (
                  <li key={u.user_id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-sm font-semibold text-muted-foreground">#{u.rank}</span>
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.company_name ?? "Independent"}</p>
                      </div>
                    </div>
                    <span className="font-display font-semibold text-primary">{u.total_points} pts</span>
                  </li>
                ))}
                {(!topUsers || topUsers.length === 0) && <EmptyRow text="No activity yet" />}
              </ol>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Built for a greener commute · MoveGreen
      </footer>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Icon className="h-5 w-5 text-leaf" />
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold">{value}</p>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">{text}</li>;
}
