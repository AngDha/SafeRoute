import type { LatLng, RoutesResponse, SafetyRefresh } from "@/types/route";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const j = JSON.parse(text);
      detail = j.detail ?? text;
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json() as Promise<T>;
}

export async function geocodeAddress(address: string): Promise<{ location: LatLng; formatted_address?: string }> {
  return postJson("/api/geocode", { address });
}

export async function fetchRoutes(origin: LatLng, destination: LatLng): Promise<RoutesResponse> {
  return postJson("/api/routes", { origin, destination });
}

export async function refreshRouteSafety(
  routeId: string,
  origin: LatLng,
  destination: LatLng,
): Promise<SafetyRefresh> {
  return postJson(`/api/routes/${encodeURIComponent(routeId)}/safety`, {
    origin,
    destination,
  });
}
