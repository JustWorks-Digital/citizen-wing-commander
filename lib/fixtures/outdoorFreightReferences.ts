/**
 * Per-location outdoor freight elevator reference photos (player-captured).
 * Keyed by wiki location slug. Missing slug → icon tooltip has text only.
 */
const OUTDOOR_FREIGHT_REFERENCES: Record<string, string> = {
  "baijini-point": "/images/outdoor-freight-elevators/baijini-point.jpg",
  "port-tressler": "/images/outdoor-freight-elevators/port-tressler.jpg",
  "seraphim-station": "/images/outdoor-freight-elevators/seraphim-station.jpg",
};

export function getOutdoorFreightReferenceSrc(
  locationSlug: string | null | undefined,
): string | null {
  if (!locationSlug) return null;
  return OUTDOOR_FREIGHT_REFERENCES[locationSlug] ?? null;
}
