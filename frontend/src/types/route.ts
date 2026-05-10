export type LatLng = { lat: number; lng: number };

export type TravelMode = "driving" | "walking" | "transit" | "bicycling";

export type RouteLeg = {
  id: string;
  summary: string;
  duration_seconds: number;
  distance_meters: number;
  safety_score: number;
  safety_tier: "safe" | "moderate" | "dangerous";
  color: string;
  safety_reasons: string[];
  safety_disclaimer: string;
  geometry: GeoJSON.LineString;
};

export type RoutesResponse = {
  routes: RouteLeg[];
  updated_at: number;
  travel_mode?: TravelMode;
};

export type SafetyRefresh = {
  id: string;
  safety_score: number;
  safety_tier: "safe" | "moderate" | "dangerous";
  color: string;
  safety_reasons: string[];
  safety_disclaimer: string;
  updated_at: number;
};

export type AutocompletePrediction = {
  description: string;
  place_id: string;
  main_text?: string;
  secondary_text?: string;
};
