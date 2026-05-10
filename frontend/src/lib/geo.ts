import { geocodeResolve } from "@/lib/api";
import type { LatLng } from "@/types/route";

function parseLatLng(input: string): { lat: number; lng: number } | null {
  const s = input.trim();
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Resolve a search box to coordinates: explicit coords, geocoded place_id, or geocoded free text.
 */
export async function resolveSearchToLatLng(
  raw: string,
  placeId: string | null,
  coordsOverride: LatLng | null,
): Promise<LatLng> {
  if (coordsOverride) return coordsOverride;
  if (placeId) {
    const res = await geocodeResolve({ place_id: placeId });
    return res.location;
  }
  const direct = parseLatLng(raw);
  if (direct) return direct;
  const res = await geocodeResolve({ address: raw.trim() });
  return res.location;
}
