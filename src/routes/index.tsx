import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Leaf, Trophy, Users, ArrowRight, Bike, Bus, Footprints, Zap, Scooter } from "lucide-react";
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
      const { data, error } = await supabase.rpc("get_company_leaderboard", { _limit: 5, _offset: 0 });
      if (error) throw error;
      return data;
    },
  });

  const { data: topUsers } = useQuery({
    queryKey: ["pub-top-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top_users", { _limit: 5, _offset: 0 });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center">
            <img src="/logo.svg" alt="SHIFT �land" className="h-14 w-auto" />
            <span className="font-display text-lg font-semibold">SHIFT Åland</span>
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
              Track every walk, bike ride, e-scooter trip, bus trip, or carpool. Climb the leaderboard with your colleagues and put your organization on the global green map.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/auth">Start competing <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
              <Button asChild size="lg" variant="outline"><a href="#leaderboard">View leaderboard</a></Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard icon={Footprints} label="Walk" value="20 pts/km" />
            <StatCard icon={Bike} label="Bike" value="18 pts/km" />
            <StatCard icon={Zap} label="Electric Bike" value="16 pts/km" />
            <StatCard icon={Scooter} label="E-Scooter" value="13 pts/km" />
            <StatCard icon={Bus} label="Bus" value="12 pts/km" />
            <StatCard icon={Users} label="Carpool" value="10 pts/km" />
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
                    <Link to="/company/$slug" params={{ slug: c.public_slug }} className="flex items-center">
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
                    <div className="flex items-center">
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

      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-6">
              <Link to="/" className="flex items-center">
                <img src="/logo.svg" alt="SHIFT Aland" className="h-14 w-auto" />
                <span className="font-display text-lg font-semibold">SHIFT Aland</span>
              </Link>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">Rewarding sustainable commuting across Aland. Every green trip counts.</p>
              <nav className="flex flex-col gap-2">
                {[
                  { label: "Get Started", to: "/auth" },
                  { label: "Log a Trip", to: "/log" },
                  { label: "Leaderboard", to: "/leaderboard" },
                  { label: "Contact", to: "/auth" },
                ].map((link) => (
                  <Link key={link.label} to={link.to} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{link.label}</Link>
                ))}
              </nav>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
                <img src="/shift-aland.webp" alt="SHIFT Aland QR Code" className="h-36 w-36 object-contain" />
              </div>
              <p className="text-xs text-muted-foreground">Scan to open the app</p>
            </div>
          </div>
          <div className="mt-10 border-t border-border pt-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-muted-foreground">Built for a greener commute - SHIFT Aland</p>
            <p className="text-xs text-muted-foreground">Powered by sustainable mobility</p>
          </div>
        </div>
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
