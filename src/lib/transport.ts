const TRANSPORT_MAP: Record<string, string> = {
  walk: "Walk",
  walking: "Walk",
  bike: "Bike",
  cycling: "Bike",
  bicycling: "Bike",
  electric_bike: "Electric Bike",
  "electric bike": "Electric Bike",
  ebike: "Electric Bike",
  e_scooter: "E-Scooter",
  "e-scooter": "E-Scooter",
  scooter: "E-Scooter",
  bus: "Bus",
  transit: "Bus",
  carpool: "Carpool",
  carpooling: "Carpool",
};

export function normalizeTransportType(rawType: string): string {
  if (!rawType) return "Other";
  const clean = rawType.trim().toLowerCase();
  const key = clean.replace(/[\s-]+/g, "_");
  return TRANSPORT_MAP[key] ?? TRANSPORT_MAP[clean] ?? (clean.charAt(0).toUpperCase() + clean.slice(1));
}

export function formatTransportType(type: string): string {
  return normalizeTransportType(type);
}
