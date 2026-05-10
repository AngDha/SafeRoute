export type LatLng = { lat: number; lng: number };

export type RouteLeg = {
  id: string;
  summary: string;
  duration_seconds: number;
  distance_meters: number;
  safety_score: number;
  safety_tier: "safe" | "moderate" | "dangerous";
  color: string;
  geometry: GeoJSON.LineString;
};

export type RoutesResponse = {
  routes: RouteLeg[];
  updated_at: number;
};

export type SafetyRefresh = {
  id: string;
  safety_score: number;
  safety_tier: "safe" | "moderate" | "dangerous";
  color: string;
  updated_at: number;
};
