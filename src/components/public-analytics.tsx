import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatTransportType, normalizeTransportType } from "@/lib/transport";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Footprints, Bike, Bus, Users, Zap, Scooter, BarChart2, Leaf, Activity, Trophy } from "lucide-react";

const MODE_COLORS: Record<string, string> = {
  Walk:          "#5bb88a",
  Bike:          "#6099db",
  "Electric Bike": "#9b82db",
  "E-Scooter":   "#e5aa52",
  Bus:           "#51b2c4",
  Carpool:       "#d978a3",
};

const MODE_ICONS: Record<string, any> = {
  Walk: Footprints,
  Bike: Bike,
  "Electric Bike": Zap,
  "E-Scooter": Scooter,
  Bus: Bus,
  Carpool: Users,
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

interface PublicAnalyticsProps {
  companies?: any[];
  topUsers?: any[];
}

export function PublicAnalytics({ companies = [], topUsers = [] }: PublicAnalyticsProps) {
  // Public RPC for platform-wide aggregate stats
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["pub-platform-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_platform_stats");
      if (!error && data && Object.keys(data).length > 0) {
        return data as PlatformStats;
      }

      // Fallback query if RPC unavailable
      const { data: activities, error: activitiesError } = await supabase
        .from("activities")
        .select("transport_type, distance_km, points_earned")
        .order("created_at", { ascending: false });

      if (activitiesError) throw activitiesError;
      return buildPlatformStatsFromActivities((activities ?? []) as PlatformStatRow[]);
    },
  });

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
    co2: Math.round(modeMap[mode].km * 0.129 * 100) / 100,
    count: modeMap[mode].count,
    fill: MODE_COLORS[mode] ?? "#6b7280",
    mode,
  }));

  // Company chart data
  const companyData = [...companies]
    .filter((c: any) => !c.name?.toLowerCase().includes("saadi"))
    .sort((a: any, b: any) => Number(b.total_points ?? 0) - Number(a.total_points ?? 0))
    .slice(0, 5)
    .map((c: any, i: number) => ({
      name: c.name ?? c.company_name ?? `Company ${i + 1}`,
      pts: Number(c.total_points ?? 0),
      fill: COMPANY_COLORS[i % COMPANY_COLORS.length],
    }));

  // Movers chart data
  const moverData = [...topUsers]
    .filter((u: any) => !u.name?.toLowerCase().includes("saadi"))
    .sort((a: any, b: any) => Number(b.total_points ?? 0) - Number(a.total_points ?? 0))
    .slice(0, 5)
    .map((u: any, i: number) => ({
      name: u.name ?? `User ${i + 1}`,
      pts: Number(u.total_points ?? 0),
      fill: MOVER_COLORS[i % MOVER_COLORS.length],
    }));

  const totalTrips = stats?.total_trips ?? 0;
  const totalKm = stats?.total_km ?? 0;
  const totalCo2 = stats?.total_co2_kg ?? 0;
  const totalPoints = stats?.total_points ?? 0;

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="text-center md:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground mb-3">
          <BarChart2 className="h-3.5 w-3.5 text-primary" /> Live Platform Analytics
        </div>
        <h2 className="text-2xl font-bold md:text-3xl font-display">
          Green Impact &amp; Platform Metrics
        </h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Real-time insights on green commuting across Åland. See how collective walking, cycling, bus, and e-mobility save CO₂ and drive points.
        </p>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatSummaryCard
          title="Total Green Trips"
          value={totalTrips.toLocaleString()}
          icon={Activity}
          unit="trips"
        />
        <StatSummaryCard
          title="Total Distance"
          value={totalKm.toLocaleString()}
          icon={Leaf}
          unit="km"
        />
        <StatSummaryCard
          title="CO₂ Avoided"
          value={totalCo2.toLocaleString()}
          icon={Zap}
          unit="kg"
        />
        <StatSummaryCard
          title="Total Points"
          value={totalPoints.toLocaleString()}
          icon={Trophy}
          unit="pts"
        />
      </div>

      {/* Row 1: CO2 by Mode + Trip Share */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Leaf className="h-4 w-4 text-leaf" /> CO₂ Avoided by Mode
            </CardTitle>
            <CardDescription>Kilograms of CO₂ saved per transport mode (0.129 kg/km standard benchmark)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingState />
            ) : totalTrips === 0 ? (
              <EmptyState text="No logged trips yet." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={co2Data} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} unit=" kg" />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 12 }} width={85} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`${v} kg`, "CO₂ avoided"]}
                  />
                  <Bar dataKey="co2" name="CO₂ avoided" radius={[0, 6, 6, 0]}>
                    {co2Data.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Trip Share by Mode
            </CardTitle>
            <CardDescription>Percentage share of logged journeys by transport type</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingState />
            ) : totalTrips === 0 ? (
              <EmptyState text="No logged trips yet." />
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={co2Data}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
                      innerRadius={45}
                      paddingAngle={3}
                    >
                      {co2Data.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                      formatter={(v, _, p) => [`${v} trip${Number(v) !== 1 ? "s" : ""}`, p.payload.label]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="flex min-w-[150px] flex-col gap-2">
                  {co2Data.map(d => {
                    const Icon = MODE_ICONS[d.mode] ?? Footprints;
                    const total = co2Data.reduce((s, x) => s + x.count, 0);
                    const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
                    return (
                      <li key={d.mode} className="flex items-center gap-2 text-xs">
                        <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: d.fill }} />
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{d.label}</span>
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

      {/* Row 2: Company & Mover Leaderboard Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-leaf" /> Top Companies Comparison
            </CardTitle>
            <CardDescription>Points accumulated by the top performing organizations</CardDescription>
          </CardHeader>
          <CardContent>
            {companyData.length === 0 ? (
              <EmptyState text="No company data available yet." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={companyData} margin={{ left: 0, right: 16, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`${v} pts`, "Points"]}
                  />
                  <Bar dataKey="pts" name="Points" radius={[6, 6, 0, 0]}>
                    {companyData.map((d: any, i: number) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-leaf" /> Top Movers Comparison
            </CardTitle>
            <CardDescription>Points accumulated by the top individual commuters</CardDescription>
          </CardHeader>
          <CardContent>
            {moverData.length === 0 ? (
              <EmptyState text="No mover data available yet." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={moverData} margin={{ left: 0, right: 16, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`${v} pts`, "Points"]}
                  />
                  <Bar dataKey="pts" name="Points" radius={[6, 6, 0, 0]}>
                    {moverData.map((d: any, i: number) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
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

function StatSummaryCard({ title, value, unit, icon: Icon }: { title: string; value: string; unit: string; icon: any }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/50">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-leaf" />
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-display text-2xl font-bold">{value}</span>
        <span className="text-xs text-muted-foreground font-medium">{unit}</span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-[240px] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
