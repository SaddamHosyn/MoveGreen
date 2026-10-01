const TRANSPORT_LABELS: Record<string, string> = {
  Walk: "Walk",
  Bike: "Bike",
  "Electric Bike": "Electric Bike",
  "E-Scooter": "E-Scooter",
  Bus: "Bus",
  Carpool: "Carpool",
};

export function formatTransportType(type: string): string {
  return TRANSPORT_LABELS[type] ?? type.replace("_", " ");
}
