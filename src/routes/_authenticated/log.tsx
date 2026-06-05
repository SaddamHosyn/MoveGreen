import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Footprints, Bike, Bus, Users, Zap, MapPin, Loader2, Plus, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/log")({ component: LogActivity });

const ICONS: Record<string, any> = {
  walking: Footprints,
  cycling: Bike,
  bus: Bus,
  carpooling: Users,
  electric_bike: Zap,
};

type Segment = {
  id: string;
  type: string;
  origin: string;
  destination: string;
  distance: number | null;
  calculating: boolean;
};

function newSegment(type = "walking"): Segment {
  return {
    id: Math.random().toString(36).slice(2),
    type,
    origin: "",
    destination: "",
    distance: null,
    calculating: false,
  };
}


function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function geocode(query: string): Promise<{ lat: number; lon: number }> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Geocoding service unavailable");
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error(`Address not found: "${query}"`);
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

function LogActivity() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [segments, setSegments] = useState<Segment[]>([newSegment()]);
  const [busy, setBusy] = useState(false);

  const { data: rules } = useQuery({
    queryKey: ["scoring-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scoring_rules")
        .select("transport_type, points_per_km")
        .eq("active", true)
        .order("points_per_km", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateSegment = (id: string, patch: Partial<Segment>) =>
    setSegments((s) => s.map((seg) => (seg.id === id ? { ...seg, ...patch } : seg)));

  const addSegment = () => {
    setSegments((s) => {
      const last = s[s.length - 1];
      const next = newSegment(last?.type ?? "walking");
      // chain: new segment starts where last ended
      if (last?.destination) next.origin = last.destination;
      return [...s, next];
    });
  };

  const removeSegment = (id: string) =>
    setSegments((s) => (s.length === 1 ? s : s.filter((seg) => seg.id !== id)));

  const calculateSegment = async (id: string) => {
    const seg = segments.find((s) => s.id === id);
    if (!seg) return;
    if (!seg.origin.trim() || !seg.destination.trim()) {
      return toast.error("Please enter both origin and destination");
    }
    updateSegment(id, { calculating: true, distance: null });
    try {
      const [a, b] = await Promise.all([geocode(seg.origin), geocode(seg.destination)]);
      const km = haversineKm(a, b);
      if (km <= 0) throw new Error("Origin and destination are the same");
      if (km > 500) throw new Error("Segment is too long (max 500 km)");
      updateSegment(id, { distance: Number(km.toFixed(2)), calculating: false });
      toast.success(`Distance: ${km.toFixed(2)} km`);
    } catch (e: any) {
      updateSegment(id, { calculating: false });
      toast.error(e.message ?? "Could not calculate distance");
    }
  };

  const rateFor = (type: string) =>
    Number(rules?.find((r) => r.transport_type === type)?.points_per_km ?? 0);

  const totalKm = segments.reduce((sum, s) => sum + (s.distance ?? 0), 0);
  const totalPoints = segments.reduce(
    (sum, s) => sum + Math.floor((s.distance ?? 0) * rateFor(s.type)),
    0,
  );

  const canSubmit =
    segments.length > 0 &&
    segments.every((s) => s.distance && s.distance > 0) &&
    !segments.some((s) => s.calculating);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return toast.error("Calculate distance for every segment first");
    setBusy(true);

    if (segments.length === 1) {
      const only = segments[0];
      const { error } = await supabase.from("activities").insert({
        transport_type: only.type,
        distance_km: only.distance!,
        user_id: (await supabase.auth.getUser()).data.user!.id,
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Activity logged! Points awarded.");
      qc.invalidateQueries();
      navigate({ to: "/dashboard" });
      return;
    }

    const payload = segments.map((s) => ({
      transport_type: s.type,
      distance_km: s.distance,
    }));


    const { error } = await supabase.rpc("log_multi_modal_trip", { _segments: payload as any });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Multi-modal trip logged! ${segments.length} segments, +${totalPoints} pts`);
    qc.invalidateQueries();
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Log a green trip</h1>
        <p className="text-sm text-muted-foreground">
          Add one or more segments — e.g. walk to the bus, take the bus, then cycle home.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {segments.map((seg, idx) => {
          const Icon = ICONS[seg.type] ?? Footprints;
          const segPts = Math.floor((seg.distance ?? 0) * rateFor(seg.type));
          return (
            <Card key={seg.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {idx + 1}
                  </span>
                  <CardTitle className="font-display text-base">
                    Segment {idx + 1}
                    <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {seg.type.replace("_", " ")}
                    </span>
                  </CardTitle>
                </div>
                {segments.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSegment(seg.id)}
                    aria-label="Remove segment"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-2 block">Transport mode</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {(rules ?? []).map((r) => {
                      const RIcon = ICONS[r.transport_type] ?? Footprints;
                      const active = seg.type === r.transport_type;
                      return (
                        <button
                          type="button"
                          key={r.transport_type}
                          onClick={() => updateSegment(seg.id, { type: r.transport_type })}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-colors",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:bg-secondary",
                          )}
                        >
                          <RIcon className="h-5 w-5" />
                          <span className="font-medium capitalize">
                            {r.transport_type.replace("_", " ")}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {Number(r.points_per_km)} pts/km
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>From</Label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder="Origin"
                        value={seg.origin}
                        onChange={(e) =>
                          updateSegment(seg.id, { origin: e.target.value, distance: null })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>To</Label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                      <Input
                        className="pl-9"
                        placeholder="Destination"
                        value={seg.destination}
                        onChange={(e) =>
                          updateSegment(seg.id, { destination: e.target.value, distance: null })
                        }
                        required
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => calculateSegment(seg.id)}
                  disabled={seg.calculating || !seg.origin || !seg.destination}
                  className="w-full"
                >
                  {seg.calculating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Calculating…
                    </>
                  ) : (
                    "Calculate distance"
                  )}
                </Button>


                <div className="flex items-center justify-between rounded-md border border-border bg-secondary p-3 text-sm">
                  <span className="text-muted-foreground">
                    Distance: <span className="font-medium text-foreground">
                      {seg.distance ? `${seg.distance.toFixed(2)} km` : "—"}
                    </span>
                  </span>
                  <span className="font-semibold text-primary">+{segPts} pts</span>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Button type="button" variant="outline" className="w-full" onClick={addSegment}>
          <Plus className="h-4 w-4" /> Add another segment
        </Button>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Trip total ({segments.length} segment{segments.length === 1 ? "" : "s"})
              </p>
              <p className="font-display text-xl font-semibold">
                {totalKm > 0 ? `${totalKm.toFixed(2)} km` : "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Estimated reward
              </p>
              <p className="font-display text-2xl font-semibold text-primary">
                +{totalPoints} pts
              </p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={busy || !canSubmit}>
          {busy ? "Saving…" : segments.length > 1 ? (
            <>Log multi-modal trip <ArrowRight className="h-4 w-4" /></>
          ) : "Log activity"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Distances are calculated as straight lines between points. Multi-modal trips are saved atomically.
        </p>
      </form>
    </div>
  );
}
