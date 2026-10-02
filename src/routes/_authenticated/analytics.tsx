import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatTransportType, normalizeTransportType } from "@/lib/transport";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Footprints, Bike, Bus, Users, Zap, Scooter, BarChart2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({ component: Analytics });

const MODE_COLORS: Record<string, string> = {
  Walk:          "#5bb88a",
  Bike:          "#6099db",
  "Electric Bike": "#9b82db",
  "E-Scooter":   "#e5aa52",
  Bus:           "#51b2c4",
  Carpool:       "#d978a3",
};

const MODE_ICONS: Record<string, any> = {
  Walk: Footprints, Bike: Bike, "Electric Bike": Zap,
  "E-Scooter": Scooter, Bus: Bus, Carpool: Users,
};

const COMPANY_COLORS = ["#5bb88a", "#6099db", "#9b82db", "#e5aa52", "#d978a3"];
const MOVER_COLORS   = ["#e5aa52", "#51b2c4", "#5bb88a", "#9b82db", "#d978a3"];

type PlatformStatRow = {
  transport_type: string | null;
  distance_km?: number | null;
  total_km?: number | null;
  trip_count?: number | null;
  points_earned?: number | null;
};

type PlatformStats = {
  total_trips: number;
  total_km: number;
  total_points: number;
  total_co2_kg: number;
  by_mode: { transport_type: string; trip_count: number; total_km: number; co2_kg: number }[];
};

function buildPlatformStatsFromActivities(rows: PlatformStatRow[]): PlatformStats {
  const totals = rows.reduce((acc, row) => {
    const transportType = row.transport_type ?? "unknown";
    const km = Number(row.distance_km ?? row.total_km ?? 0);
    const tripCount = Number(row.trip_count ?? 1);

    acc.totalTrips += tripCount;
    acc.totalKm += km;
    acc.totalPoints += Number(row.points_earned ?? 0);

    const mode = acc.byMode[transportType] ?? { trip_count: 0, total_km: 0 };
    mode.trip_count += tripCount;
    mode.total_km += km;
    acc.byMode[transportType] = mode;
    return acc;
  }, {
    totalTrips: 0,
    totalKm: 0,
    totalPoints: 0,
    byMode: {} as Record<string, { trip_count: number; total_km: number }>,
  });

  return {
    total_trips: totals.totalTrips,
    total_km: Number(totals.totalKm.toFixed(2)),
    total_points: totals.totalPoints,
    total_co2_kg: Number((totals.totalKm * 0.129).toFixed(2)),
    by_mode: Object.entries(totals.byMode)
      .map(([transport_type, value]) => ({
        transport_type,
        trip_count: value.trip_count,
        total_km: Number(value.total_km.toFixed(2)),
        co2_kg: Number((value.total_km * 0.129).toFixed(2)),
      }))
      .sort((a, b) => b.total_km - a.total_km),
  };
}

function Analytics() {
  const { user } = useAuth();

  // Platform-wide activity stats via SECURITY DEFINER RPC (bypasses RLS, returns all users' data)
  const { data: stats, isLoading: loadingStats, error: statsError } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_platform_stats");
      if (!error) {
        return data as PlatformStats;
      }

      const { data: activities, error: activitiesError } = await supabase
        .from("activities")
        .select("transport_type, distance_km, points_earned")
        .order("created_at", { ascending: false });

      if (activitiesError) throw activitiesError;
      return buildPlatformStatsFromActivities((activities ?? []) as PlatformStatRow[]);
    },
    enabled: !!user,
    refetchOnMount: "always",
    staleTime: 0,
  });

  // Top 5 companies
  const { data: companies, isLoading: loadingCompanies } = useQuery({
    queryKey: ["analytics-top-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_company_leaderboard", { _limit: 10, _offset: 0 });
      if (error) throw error;
      return (data ?? []).filter((c: any) => !c.name?.toLowerCase().includes("saadi"));
    },
    enabled: !!user,
    refetchOnMount: "always",
    staleTime: 0,
  });

  // Top 5 movers
  const { data: movers, isLoading: loadingMovers } = useQuery({
    queryKey: ["analytics-top-movers"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top_users", { _limit: 10, _offset: 0 });
      if (error) throw error;
      return (data ?? []).filter((u: any) => !u.name?.toLowerCase().includes("saadi"));
    },
    enabled: !!user,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const isLoading = loadingStats || loadingCompanies || loadingMovers;

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // ── CO₂ by mode — all 6 modes, from platform-wide RPC ──
  const ALL_MODES = ["Walk", "Bike", "Electric Bike", "E-Scooter", "Bus", "Carpool"];

  const modeMap: Record<string, { km: number; count: number }> = {};
  for (const m of ALL_MODES) modeMap[m] = { km: 0, count: 0 };
  for (const row of (stats?.by_mode ?? [])) {
    const normalized = normalizeTransportType(row.transport_type);
    if (modeMap[normalized] !== undefined) {
      modeMap[normalized].km += Number(row.total_km ?? 0);
      modeMap[normalized].count += Number(row.trip_count ?? 0);
    }
  }

  const co2Data = ALL_MODES.map(mode => ({
    label: formatTransportType(mode),
    co2:   Math.round(modeMap[mode].km * 0.129 * 100) / 100,
    count: modeMap[mode].count,
    fill:  MODE_COLORS[mode] ?? "#6b7280",
    mode,
  }));

  // ── Company chart data — sorted highest first ──
  const companyData = [...(companies ?? [])]
    .sort((a: any, b: any) => (b.total_points ?? 0) - (a.total_points ?? 0))
    .map((c: any, i: number) => ({
      name: c.name ?? c.company_name ?? `Company ${i + 1}`,
      pts:  c.total_points ?? 0,
      fill: COMPANY_COLORS[i] ?? "#6b7280",
    }));

  // ── Movers chart data — sorted highest first ──
  const moverData = [...(movers ?? [])]
    .sort((a: any, b: any) => (b.total_points ?? 0) - (a.total_points ?? 0))
    .map((u: any, i: number) => ({
      name: u.name ?? `User ${i + 1}`,
      pts:  u.total_points ?? 0,
      fill: MOVER_COLORS[i] ?? "#6b7280",
    }));

  const noActivity = !stats || (stats.total_trips ?? 0) === 0;
  const showStatsError = !!statsError && !stats;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold md:text-3xl">
          <BarChart2 className="h-7 w-7 text-primary" /> Analytics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live data from Supabase — your green impact &amp; platform leaderboards.
        </p>
      </div>

      {/* Row 1: CO₂ by mode + Trip share by mode */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* CO₂ Avoided by Mode */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">CO₂ Avoided by Mode</CardTitle>
            <CardDescription>Kilograms of CO₂ saved per transport type (distance × 0.129 kg/km)</CardDescription>
          </CardHeader>
          <CardContent>
            {showStatsError ? (
              <ErrorState text="Analytics data isn’t available right now. Check your Supabase connection and try again." />
            ) : noActivity ? (
              <EmptyState text="Log some trips to see your CO₂ impact." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={co2Data} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} unit=" kg" />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 12 }} width={76} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`${v} kg`, "CO₂ avoided"]}
                  />
                  <Bar dataKey="co2" name="CO₂ avoided" radius={[0, 6, 6, 0]}>
                    {co2Data.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Trip Share by Mode */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Trip Share by Mode</CardTitle>
            <CardDescription>Proportion of trips logged per transport type</CardDescription>
          </CardHeader>
          <CardContent>
            {showStatsError ? (
              <ErrorState text="Analytics data isn’t available right now. Check your Supabase connection and try again." />
            ) : noActivity ? (
              <EmptyState text="Log some trips to see your trip breakdown." />
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={co2Data} dataKey="count" nameKey="label"
                      cx="50%" cy="50%" outerRadius={88} innerRadius={48}
                      paddingAngle={3}
                      label={false}
                      labelLine={false}
                    >
                      {co2Data.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }}
                      formatter={(v, _, p) => [`${v} trip${Number(v) !== 1 ? "s" : ""}`, p.payload.label]} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="flex min-w-[140px] flex-col gap-2.5">
                  {co2Data.map(d => {
                    const Icon = MODE_ICONS[d.mode] ?? Footprints;
                    const total = co2Data.reduce((s, x) => s + x.count, 0);
                    const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
                    return (
                      <li key={d.mode} className="flex items-center gap-2 text-sm">
                        <span className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                          style={{ background: d.fill }} />
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{d.label}</span>
                        <span className="ml-auto font-semibold text-muted-foreground">{pct}%</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Top 5 Companies + Top 5 Movers */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top 5 Companies */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Top 5 Companies</CardTitle>
            <CardDescription>Companies with the highest total points on the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {companyData.length === 0 ? (
              <EmptyState text="No company data available yet." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={companyData} margin={{ left: 0, right: 16, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="name" tick={{ fontSize: 11 }} angle={-25}
                    textAnchor="end" interval={0}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [v, "Points"]} />
                  <Bar dataKey="pts" name="Points" radius={[6, 6, 0, 0]}>
                    {companyData.map((d: any, i: number) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top 5 Movers */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Top 5 Movers</CardTitle>
            <CardDescription>Users with the highest total points on the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {moverData.length === 0 ? (
              <EmptyState text="No user data available yet." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={moverData} margin={{ left: 0, right: 16, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="name" tick={{ fontSize: 11 }} angle={-25}
                    textAnchor="end" interval={0}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [v, "Points"]} />
                  <Bar dataKey="pts" name="Points" radius={[6, 6, 0, 0]}>
                    {moverData.map((d: any, i: number) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function ErrorState({ text }: { text: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-destructive/40 bg-destructive/5">
      <p className="max-w-sm text-center text-sm text-destructive">{text}</p>
    </div>
  );
}
