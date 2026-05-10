"use client";

import { useCallback, useEffect, useState } from "react";
import PlaceSearchInput from "@/components/PlaceSearchInput";
import RouteMap from "@/components/RouteMap";
import { fetchRoutes, refreshRouteSafety } from "@/lib/api";
import { resolveSearchToLatLng } from "@/lib/geo";
import type { LatLng, RouteLeg, TravelMode } from "@/types/route";

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return `${h} h ${rest} min`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function tierLabel(tier: RouteLeg["safety_tier"]): string {
  if (tier === "safe") return "Safer";
  if (tier === "moderate") return "Moderate risk";
  return "Higher risk";
}

export default function HomeClient() {
  const [startInput, setStartInput] = useState("Union Station, Toronto");
  const [endInput, setEndInput] = useState("CN Tower, Toronto");
  const [startPlaceId, setStartPlaceId] = useState<string | null>(null);
  const [endPlaceId, setEndPlaceId] = useState<string | null>(null);
  const [startCoords, setStartCoords] = useState<LatLng | null>(null);
  const [endCoords, setEndCoords] = useState<LatLng | null>(null);
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [routes, setRoutes] = useState<RouteLeg[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>("driving");
  const [transitPreferBus, setTransitPreferBus] = useState(false);

  const planRoutes = useCallback(async () => {
    setError(null);
    setGeoHint(null);
    setLoading(true);
    setSelectedRouteId(null);
    try {
      const o = await resolveSearchToLatLng(startInput, startPlaceId, startCoords);
      const d = await resolveSearchToLatLng(endInput, endPlaceId, endCoords);
      setOrigin(o);
      setDestination(d);
      const data = await fetchRoutes(o, d, travelMode, transitPreferBus);
      setRoutes(data.routes);
      if (!data.routes.length) {
        setError("No routes returned. Try another mode, nearby places, or coordinates.");
      }
    } catch (e) {
      setRoutes([]);
      setOrigin(null);
      setDestination(null);
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [startInput, endInput, startPlaceId, endPlaceId, startCoords, endCoords, travelMode, transitPreferBus]);

  useEffect(() => {
    if (!selectedRouteId || !origin || !destination) return;
    const id = window.setInterval(async () => {
      try {
        const snap = await refreshRouteSafety(
          selectedRouteId,
          origin,
          destination,
          travelMode,
          transitPreferBus,
        );
        setRoutes((prev) =>
          prev.map((r) =>
            r.id === snap.id
              ? {
                  ...r,
                  safety_score: snap.safety_score,
                  safety_tier: snap.safety_tier,
                  color: snap.color,
                  safety_reasons: snap.safety_reasons,
                  safety_disclaimer: snap.safety_disclaimer,
                }
              : r,
          ),
        );
      } catch {
        /* ignore */
      }
    }, 8000);
    return () => window.clearInterval(id);
  }, [selectedRouteId, origin, destination, travelMode, transitPreferBus]);

  const useMyLocationStart = () => {
    setGeoHint(null);
    if (!navigator.geolocation) {
      setGeoHint("This browser does not support location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setStartCoords({ lat: latitude, lng: longitude });
        setStartPlaceId(null);
        setStartInput("Current location");
      },
      () => {
        setGeoHint("Could not read your location (permission denied or unavailable).");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  const useMyLocationEnd = () => {
    setGeoHint(null);
    if (!navigator.geolocation) {
      setGeoHint("This browser does not support location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setEndCoords({ lat: latitude, lng: longitude });
        setEndPlaceId(null);
        setEndInput("Current location");
      },
      () => {
        setGeoHint("Could not read your location (permission denied or unavailable).");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col md:flex-row">
      <aside className="z-10 flex w-full shrink-0 flex-col border-b border-slate-200 bg-white shadow-sm md:h-full md:w-[400px] md:min-h-0 md:border-b-0 md:border-r">
        <div className="border-b border-slate-100 px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">SafeRoute</h1>
          <p className="text-xs text-slate-500">Safer paths, not just faster ones.</p>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="sr-start">
              Starting point
            </label>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <PlaceSearchInput
                  id="sr-start"
                  letter="A"
                  accent="emerald"
                  value={startInput}
                  onChangeValue={(v) => {
                    setStartInput(v);
                    setStartCoords(null);
                  }}
                  placeId={startPlaceId}
                  onPlaceIdChange={setStartPlaceId}
                  placeholder="Search or lat,lng"
                />
              </div>
              <button
                type="button"
                title="Use your current location as start"
                onClick={useMyLocationStart}
                className="shrink-0 self-start rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Here
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="sr-end">
              Destination
            </label>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <PlaceSearchInput
                  id="sr-end"
                  letter="B"
                  accent="rose"
                  value={endInput}
                  onChangeValue={(v) => {
                    setEndInput(v);
                    setEndCoords(null);
                  }}
                  placeId={endPlaceId}
                  onPlaceIdChange={setEndPlaceId}
                  placeholder="Search or lat,lng"
                />
              </div>
              <button
                type="button"
                title="Use your current location as destination"
                onClick={useMyLocationEnd}
                className="shrink-0 self-start rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Here
              </button>
            </div>
          </div>

          {geoHint ? <p className="text-xs text-amber-800">{geoHint}</p> : null}

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="sr-mode">
              Travel mode
            </label>
            <select
              id="sr-mode"
              value={travelMode}
              onChange={(e) => setTravelMode(e.target.value as TravelMode)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            >
              <option value="driving">Driving</option>
              <option value="walking">Walking</option>
              <option value="transit">Transit (bus &amp; rail)</option>
              <option value="bicycling">Cycling</option>
            </select>
            {travelMode === "transit" ? (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={transitPreferBus}
                  onChange={(e) => setTransitPreferBus(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Prefer bus segments when possible
              </label>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void planRoutes()}
            disabled={loading}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Finding routes…" : "Search"}
          </button>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>
          ) : null}

          {routes.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between pt-2">
                <h2 className="text-sm font-semibold text-slate-800">Routes</h2>
                <span className="text-[11px] text-slate-500">Green = safer · Red = riskier</span>
              </div>
              <ul className="flex flex-col gap-2">
                {routes.map((r) => {
                  const active = r.id === selectedRouteId;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRouteId(r.id);
                        }}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                          active
                            ? "border-slate-900 bg-slate-900 text-white shadow-md"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className="mt-0.5 h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
                            style={{ backgroundColor: r.color }}
                            title={tierLabel(r.safety_tier)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className={`text-sm font-medium ${active ? "text-white" : "text-slate-900"}`}>
                              {r.summary}
                            </div>
                            <div
                              className={`mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs ${
                                active ? "text-slate-200" : "text-slate-500"
                              }`}
                            >
                              <span>{formatDuration(r.duration_seconds)}</span>
                              <span>{formatDistance(r.distance_meters)}</span>
                              <span>
                                Safety {r.safety_score.toFixed(0)} — {tierLabel(r.safety_tier)}
                              </span>
                            </div>
                            <details
                              className={`mt-2 text-left text-[11px] ${active ? "text-slate-200" : "text-slate-600"}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <summary
                                className={`cursor-pointer font-semibold ${active ? "text-slate-100" : "text-slate-700"}`}
                              >
                                Why this rating?
                              </summary>
                              <ul className="mt-1.5 list-disc space-y-1 pl-4 leading-snug">
                                {(r.safety_reasons ?? []).map((line, i) => (
                                  <li key={i}>{line}</li>
                                ))}
                              </ul>
                              <p className={`mt-2 text-[10px] leading-snug ${active ? "text-slate-300" : "text-slate-500"}`}>
                                {r.safety_disclaimer}
                              </p>
                            </details>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {selectedRouteId ? (
                <div className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="min-w-0 flex-1 leading-snug">
                      <span className="font-semibold">Single-route view.</span>{" "}
                      <span className="text-amber-900/90">
                        Other paths are hidden. Safety still refreshes ~every 8s.
                      </span>
                    </p>
                    <button
                      type="button"
                      className="shrink-0 rounded-md bg-amber-200/80 px-2 py-1 text-[11px] font-semibold text-amber-950 hover:bg-amber-200"
                      onClick={() => setSelectedRouteId(null)}
                    >
                      Show all routes
                    </button>
                  </div>
                  <details className="mt-2 text-[11px] text-amber-900/85">
                    <summary className="cursor-pointer select-none font-medium text-amber-900 hover:underline">
                      Why lighting looks like this
                    </summary>
                    <p className="mt-1.5 leading-relaxed">
                      Street lighting along the path is <strong>illustrative</strong> until we plug in
                      real lighting or street-lamp datasets. It is seeded from your route so it stays
                      stable for the demo.
                    </p>
                  </details>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Tap a route to keep only that path on the map and show lighting along it.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </aside>

      <main className="relative flex min-h-[45vh] flex-1 flex-col bg-slate-100 md:min-h-0 md:overflow-hidden">
        <div className="relative min-h-0 flex-1 md:absolute md:inset-0">
          <RouteMap
            origin={origin}
            destination={destination}
            routes={routes}
            selectedRouteId={selectedRouteId}
          />
        </div>
      </main>
    </div>
  );
}
