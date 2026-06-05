import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/leaderboard")({ component: Leaderboard });

function Leaderboard() {
  const { user } = useAuth();

  const { data: rank } = useQuery({
    queryKey: ["my-rank", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_rank");
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const { data: topUsers } = useQuery({
    queryKey: ["lb-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top_users", { _limit: 50, _offset: 0 });
      if (error) throw error;
      return data;
    },
  });

  const { data: companies } = useQuery({
    queryKey: ["lb-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_company_leaderboard", { _limit: 50, _offset: 0 });
      if (error) throw error;
      return data;
    },
  });

  const { data: companyUsers } = useQuery({
    queryKey: ["lb-company-users", rank?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_company_user_leaderboard", {
        _company_id: rank!.company_id,
        _limit: 50,
        _offset: 0,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!rank?.company_id,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Leaderboards</h1>
        <p className="text-sm text-muted-foreground">See who's leading the green movement.</p>
      </div>

      <Tabs defaultValue="global">
        <TabsList>
          <TabsTrigger value="global">Global users</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="company" disabled={!rank?.company_id}>My company</TabsTrigger>
        </TabsList>

        <TabsContent value="global">
          <Board
            title="Top users worldwide"
            rows={(topUsers ?? []).map((u: any) => ({
              rank: u.rank, name: u.name, sub: u.company_name ?? "Independent", points: u.total_points,
              highlight: u.user_id === user?.id,
            }))}
          />
        </TabsContent>

        <TabsContent value="companies">
          <Board
            title="Top companies (avg pts / active member)"
            rows={(companies ?? []).map((c: any) => ({
              rank: c.rank,
              name: c.name,
              sub: `${c.active_member_count}/${c.member_count} active · ${c.total_points} total pts`,
              points: Number(c.avg_points ?? 0),
              highlight: c.company_id === rank?.company_id,
            }))}
          />
        </TabsContent>

        <TabsContent value="company">
          <Board
            title={rank?.company_name ?? "My company"}
            rows={(companyUsers ?? []).map((u: any) => ({
              rank: u.rank, name: u.name, sub: "", points: u.total_points,
              highlight: u.user_id === user?.id,
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Board({ title, rows }: { title: string; rows: { rank: number; name: string; sub?: string; points: number; highlight?: boolean }[] }) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Trophy className="h-5 w-5 text-leaf" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <ol className="space-y-1">
            {rows.map((r) => (
              <li
                key={`${r.rank}-${r.name}`}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  r.highlight ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 text-center font-display text-sm font-semibold ${r.rank <= 3 ? "text-primary" : "text-muted-foreground"}`}>
                    #{r.rank}
                  </span>
                  <div>
                    <p className="font-medium">{r.name}</p>
                    {r.sub && <p className="text-xs text-muted-foreground">{r.sub}</p>}
                  </div>
                </div>
                <span className="font-display font-semibold">{r.points} pts</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
