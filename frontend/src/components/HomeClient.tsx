"use client";

import { useCallback, useEffect, useState } from "react";
import RouteMap from "@/components/RouteMap";
import { fetchRoutes, geocodeAddress, refreshRouteSafety } from "@/lib/api";
import { resolveToLatLng } from "@/lib/geo";
import type { LatLng, RouteLeg } from "@/types/route";

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
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [routes, setRoutes] = useState<RouteLeg[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planRoutes = useCallback(async () => {
    setError(null);
    setLoading(true);
    setSelectedRouteId(null);
    try {
      const o = await resolveToLatLng(startInput, geocodeAddress);
      const d = await resolveToLatLng(endInput, geocodeAddress);
      setOrigin(o);
      setDestination(d);
      const data = await fetchRoutes(o, d);
      setRoutes(data.routes);
      if (!data.routes.length) {
        setError("No routes returned. Try nearby addresses or coordinates.");
      }
    } catch (e) {
      setRoutes([]);
      setOrigin(null);
      setDestination(null);
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [startInput, endInput]);

  useEffect(() => {
    if (!selectedRouteId || !origin || !destination) return;
    const id = window.setInterval(async () => {
      try {
        const snap = await refreshRouteSafety(selectedRouteId, origin, destination);
        setRoutes((prev) =>
          prev.map((r) =>
            r.id === snap.id
              ? {
                  ...r,
                  safety_score: snap.safety_score,
                  safety_tier: snap.safety_tier,
                  color: snap.color,
                }
              : r,
          ),
        );
      } catch {
        /* ignore transient refresh errors */
      }
    }, 8000);
    return () => window.clearInterval(id);
  }, [selectedRouteId, origin, destination]);

  return (
    <div className="flex h-[100dvh] flex-col md:flex-row">
      <aside className="z-10 flex w-full shrink-0 flex-col border-b border-slate-200 bg-white shadow-sm md:w-[400px] md:border-b-0 md:border-r">
        <div className="border-b border-slate-100 px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">SafeRoute</h1>
          <p className="text-xs text-slate-500">Safer paths, not just faster ones.</p>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Starting point
            </label>
            <div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-400">
              <span className="pt-1 text-sm font-bold text-emerald-600">A</span>
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                placeholder="Address or lat,lng"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Destination
            </label>
            <div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-rose-400 focus-within:ring-1 focus-within:ring-rose-400">
              <span className="pt-1 text-sm font-bold text-rose-600">B</span>
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                placeholder="Address or lat,lng"
              />
            </div>
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
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </div>
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
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {selectedRouteId ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  <div className="font-medium">Selected route</div>
                  <p className="mt-1 text-amber-900/90">
                    Other paths are hidden. Street lighting is illustrative where open data is
                    unavailable. Safety score refreshes every ~8s while this route is selected.
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold text-amber-900 underline"
                    onClick={() => setSelectedRouteId(null)}
                  >
                    Show all routes again
                  </button>
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

      <main className="relative min-h-[50vh] flex-1 bg-slate-100 md:min-h-0">
        <RouteMap
          origin={origin}
          destination={destination}
          routes={routes}
          selectedRouteId={selectedRouteId}
        />
      </main>
    </div>
  );
}
