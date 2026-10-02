import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Footprints, Bike, Bus, Users, Zap, Scooter, MapPin, Loader2, Plus, Trash2, ArrowRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatTransportType } from "@/lib/transport";

export const Route = createFileRoute("/_authenticated/log")({ component: LogActivity });

const ICONS: Record<string, any> = {
  Walk: Footprints,
  Bike: Bike,
  Bus: Bus,
  Carpool: Users,
  "Electric Bike": Zap,
  "E-Scooter": Scooter,
};

const CANONICAL_RULES = [
  { transport_type: "Walk", points_per_km: 20 },
  { transport_type: "Bike", points_per_km: 18 },
  { transport_type: "Electric Bike", points_per_km: 16 },
  { transport_type: "E-Scooter", points_per_km: 13 },
  { transport_type: "Bus", points_per_km: 12 },
  { transport_type: "Carpool", points_per_km: 10 },
];

// Map display names → database transport_type values (DB uses old lowercase format)
const TO_DB_TYPE: Record<string, string> = {
  Walk: "walking",
  Bike: "cycling",
  "Electric Bike": "electric_bike",
  "E-Scooter": "e_scooter",
  Bus: "bus",
  Carpool: "carpooling",
};

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

type ResolvedPlace = {
  display_name: string;
  lat: number;
  lon: number;
};

type Segment = {
  id: string;
  type: string;
  originText: string;
  originPlace: ResolvedPlace | null;
  destinationText: string;
  destinationPlace: ResolvedPlace | null;
  distance: number | null;
  calculating: boolean;
};

function newSegment(type = "Walk"): Segment {
  return {
    id: Math.random().toString(36).slice(2),
    type,
    originText: "",
    originPlace: null,
    destinationText: "",
    destinationPlace: null,
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

async function searchPlaces(query: string): Promise<NominatimResult[]> {
  if (!query || query.trim().length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&accept-language=en&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json", "Accept-Language": "en" } });
  if (!res.ok) return [];
  return res.json();
}

// ── Address Autocomplete Input ─────────────────────────────────────────────
function AddressInput({
  label,
  value,
  resolvedPlace,
  onChange,
  onSelect,
  iconColor,
}: {
  label: string;
  value: string;
  resolvedPlace: ResolvedPlace | null;
  onChange: (text: string) => void;
  onSelect: (place: ResolvedPlace) => void;
  iconColor?: string;
}) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (text: string) => {
    onChange(text);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchPlaces(text);
      setSuggestions(results);
      setLoading(false);
    }, 400);
  };

  const handleSelect = (result: NominatimResult) => {
    onSelect({
      display_name: result.display_name,
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
    });
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <Label>{label}</Label>
      <div className="relative">
        <MapPin
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
            iconColor ?? "text-muted-foreground"
          )}
        />
        <Input
          className="pl-9 pr-9"
          placeholder={`Search ${label.toLowerCase()}…`}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => value.length >= 2 && setOpen(true)}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {open && suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-lg">
            {suggestions.map((s) => (
              <li
                key={s.place_id}
                className="cursor-pointer truncate px-3 py-2 text-sm hover:bg-secondary"
                onMouseDown={() => handleSelect(s)}
              >
                <span className="font-medium">{s.display_name.split(",")[0]}</span>
                <span className="ml-1 text-xs text-muted-foreground">
                  {s.display_name.split(",").slice(1, 3).join(",")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {resolvedPlace && (
        <p className="truncate text-xs text-primary">
          ✓ {resolvedPlace.display_name.split(",").slice(0, 3).join(",")}
        </p>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
function LogActivity() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [segments, setSegments] = useState<Segment[]>([newSegment()]);
  const [busy, setBusy] = useState(false);

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ["scoring-rules"],
    queryFn: async () => CANONICAL_RULES,
  });

  const activeRules = rules ?? CANONICAL_RULES;

  const updateSegment = (id: string, patch: Partial<Segment>) =>
    setSegments((s) => s.map((seg) => (seg.id === id ? { ...seg, ...patch } : seg)));

  const addSegment = () => {
    setSegments((s) => {
      const last = s[s.length - 1];
      const next = newSegment(last?.type ?? "Walk");
      if (last?.destinationText) {
        next.originText = last.destinationText;
        next.originPlace = last.destinationPlace;
      }
      return [...s, next];
    });
  };

  const removeSegment = (id: string) =>
    setSegments((s) => (s.length === 1 ? s : s.filter((seg) => seg.id !== id)));

  const calculateSegment = (id: string) => {
    const seg = segments.find((s) => s.id === id);
    if (!seg) return;
    if (!seg.originPlace) return toast.error("Please select a valid origin from the suggestions list");
    if (!seg.destinationPlace) return toast.error("Please select a valid destination from the suggestions list");

    updateSegment(id, { calculating: true, distance: null });
    try {
      const km = haversineKm(seg.originPlace, seg.destinationPlace);
      if (km <= 0.01) {
        updateSegment(id, { calculating: false });
        return toast.error("Origin and destination appear to be the same location");
      }
      if (km > 500) {
        updateSegment(id, { calculating: false });
        return toast.error("Distance is too long (max 500 km per segment)");
      }
      updateSegment(id, { distance: Number(km.toFixed(2)), calculating: false });
      toast.success(`Distance: ${km.toFixed(2)} km`);
    } catch (e: any) {
      updateSegment(id, { calculating: false });
      toast.error(e.message ?? "Could not calculate distance");
    }
  };

  const rateFor = (type: string) =>
    Number(activeRules.find((r) => r.transport_type === type)?.points_per_km ?? 0);

  const totalKm = segments.reduce((sum, s) => sum + (s.distance ?? 0), 0);
  const totalPoints = segments.reduce(
    (sum, s) => sum + Math.floor((s.distance ?? 0) * rateFor(s.type)),
    0,
  );

  const canSubmit =
    activeRules.length > 0 &&
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
        transport_type: TO_DB_TYPE[only.type] ?? only.type,
        distance_km: only.distance!,
        user_id: (await supabase.auth.getUser()).data.user!.id,
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Activity logged! Points awarded.");
      await qc.invalidateQueries();
      qc.resetQueries();
      await new Promise(r => setTimeout(r, 600));
      navigate({ to: "/dashboard" });
      return;
    }

    const payload = segments.map((s) => ({
      transport_type: TO_DB_TYPE[s.type] ?? s.type,
      distance_km: s.distance,
    }));

    const { error } = await supabase.rpc("log_multi_modal_trip", { _segments: payload as any });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Multi-modal trip logged! ${segments.length} segments, +${totalPoints} pts`);
    await qc.invalidateQueries();
    qc.resetQueries();
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Log a green trip</h1>
        <p className="text-sm text-muted-foreground">
          Add one or more segments — e.g. walk to the bus, take the bus, then ride an e-scooter home.
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
                      {formatTransportType(seg.type)}
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
                  {rulesLoading ? (
                    <div className="flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
                      {activeRules.map((r) => {
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
                              {formatTransportType(r.transport_type)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {Number(r.points_per_km)} pts/km
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <AddressInput
                    label="From"
                    value={seg.originText}
                    resolvedPlace={seg.originPlace}
                    onChange={(text) =>
                      updateSegment(seg.id, { originText: text, originPlace: null, distance: null })
                    }
                    onSelect={(place) =>
                      updateSegment(seg.id, {
                        originText: place.display_name.split(",")[0],
                        originPlace: place,
                        distance: null,
                      })
                    }
                  />
                  <AddressInput
                    label="To"
                    value={seg.destinationText}
                    resolvedPlace={seg.destinationPlace}
                    iconColor="text-primary"
                    onChange={(text) =>
                      updateSegment(seg.id, { destinationText: text, destinationPlace: null, distance: null })
                    }
                    onSelect={(place) =>
                      updateSegment(seg.id, {
                        destinationText: place.display_name.split(",")[0],
                        destinationPlace: place,
                        distance: null,
                      })
                    }
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => calculateSegment(seg.id)}
                  disabled={seg.calculating || !seg.originPlace || !seg.destinationPlace}
                  className="w-full"
                >
                  {seg.calculating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Calculating…</>
                  ) : (
                    "Calculate distance"
                  )}
                </Button>

                <div className="flex items-center justify-between rounded-md border border-border bg-secondary p-3 text-sm">
                  <span className="text-muted-foreground">
                    Distance:{" "}
                    <span className="font-medium text-foreground">
                      {seg.distance ? `${seg.distance.toFixed(2)} km` : "—"}
                    </span>
                  </span>
                  <span className="font-semibold text-primary">+{segPts} pts</span>
                </div>

                {seg.originPlace && seg.destinationPlace && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${seg.originPlace.lat},${seg.originPlace.lon}&destination=${seg.destinationPlace.lat},${seg.destinationPlace.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open route in Google Maps
                  </a>
                )}
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
          Distances are straight-line (as the crow flies). Select locations from the dropdown to ensure accuracy.
        </p>
      </form>
    </div>
  );
}
