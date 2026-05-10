import type { LatLng, RoutesResponse, SafetyRefresh, TravelMode, AutocompletePrediction } from "@/types/route";

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

export async function geocodeResolve(body: {
  address?: string;
  place_id?: string;
}): Promise<{ location: LatLng; formatted_address?: string }> {
  return postJson("/api/geocode", body);
}

/** @deprecated use geocodeResolve */
export async function geocodeAddress(address: string): Promise<{ location: LatLng; formatted_address?: string }> {
  return geocodeResolve({ address });
}

export async function fetchAutocomplete(
  input: string,
  sessionToken: string,
): Promise<AutocompletePrediction[]> {
  const q = input.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ input: q, sessiontoken: sessionToken });
  const res = await fetch(`${API}/api/places/autocomplete?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Autocomplete failed");
  }
  const data = (await res.json()) as { predictions: AutocompletePrediction[] };
  return data.predictions ?? [];
}

export async function fetchRoutes(
  origin: LatLng,
  destination: LatLng,
  travelMode: TravelMode,
  transitPreferBus: boolean,
): Promise<RoutesResponse> {
  return postJson("/api/routes", {
    origin,
    destination,
    travel_mode: travelMode,
    transit_prefer_bus: transitPreferBus,
  });
}

export async function refreshRouteSafety(
  routeId: string,
  origin: LatLng,
  destination: LatLng,
  travelMode: TravelMode,
  transitPreferBus: boolean,
): Promise<SafetyRefresh> {
  return postJson(`/api/routes/${encodeURIComponent(routeId)}/safety`, {
    origin,
    destination,
    travel_mode: travelMode,
    transit_prefer_bus: transitPreferBus,
  });
}
