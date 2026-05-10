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

export async function resolveToLatLng(
  raw: string,
  geocode: (address: string) => Promise<{ location: { lat: number; lng: number } }>,
): Promise<{ lat: number; lng: number }> {
  const direct = parseLatLng(raw);
  if (direct) return direct;
  const res = await geocode(raw);
  return res.location;
}
