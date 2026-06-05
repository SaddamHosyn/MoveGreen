import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy, TrendingUp, Award, Activity as ActIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const { user } = useAuth();

  const { data: rank } = useQuery({
    queryKey: ["my-rank", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_rank");
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!user,
    refetchOnMount: "always",
  });

  const { data: activities } = useQuery({
    queryKey: ["my-activities", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: badges } = useQuery({
    queryKey: ["my-badges", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_badges")
        .select("awarded_at, badges(name, description)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Hi, {rank?.name ?? "there"} 👋</h1>
          <p className="text-sm text-muted-foreground">Here's your green impact at a glance.</p>
        </div>
        <Button asChild><Link to="/log">+ Log activity</Link></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Trophy} label="Total points" value={rank?.total_points ?? 0} accent />
        <Stat icon={TrendingUp} label="Global rank" value={rank?.global_rank ? `#${rank.global_rank}` : "—"} sub={rank?.global_total ? `of ${rank.global_total}` : ""} />
        <Stat icon={TrendingUp} label="Company rank" value={rank?.company_rank ? `#${rank.company_rank}` : "—"} sub={rank?.company_name ?? "Join a company"} />
        <Stat icon={Award} label="Badges" value={badges?.length ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <ActIcon className="h-5 w-5 text-leaf" /> Recent activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!activities || activities.length === 0) ? (
              <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                No activities yet. <Link to="/log" className="text-primary underline">Log your first trip</Link>.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {activities.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium capitalize">{a.transport_type.replace("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.distance_km} km · {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="secondary" className="font-display">+{a.points_earned ?? 0} pts</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Award className="h-5 w-5 text-leaf" /> Badges
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!badges || badges.length === 0) ? (
              <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                Earn badges by hitting distance milestones.
              </p>
            ) : (
              <ul className="space-y-2">
                {badges.map((b: any, i) => (
                  <li key={i} className="rounded-lg border border-border p-3">
                    <p className="font-medium">{b.badges?.name}</p>
                    <p className="text-xs text-muted-foreground">{b.badges?.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: any; sub?: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-leaf" />
        </div>
        <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
