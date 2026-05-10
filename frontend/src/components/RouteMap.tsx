"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import * as turf from "@turf/turf";
import type { LatLng, RouteLeg } from "@/types/route";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromId(id: string): number {
  let h = 1779033703;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function buildFakeLighting(
  line: GeoJSON.Feature<GeoJSON.LineString>,
  routeId: string,
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const rng = mulberry32(seedFromId(routeId));
  const lenKm = turf.length(line, { units: "kilometers" });
  const polys: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const steps = Math.min(50, Math.max(10, Math.floor(lenKm * 4)));
  for (let i = 0; i < steps; i++) {
    if (rng() > 0.5) continue;
    const dist = ((i + rng()) / steps) * lenKm;
    const pt = turf.along(line, dist, { units: "kilometers" });
    const buf = turf.buffer(pt, 0.02 + rng() * 0.03, { units: "kilometers" });
    if (buf?.geometry?.type === "Polygon") {
      polys.push(buf as GeoJSON.Feature<GeoJSON.Polygon>);
    }
  }
  return turf.featureCollection(polys);
}

function lineStringToPath(line: GeoJSON.LineString): google.maps.LatLngLiteral[] {
  return line.coordinates.map(([lng, lat]) => ({ lat, lng }));
}

type Props = {
  origin: LatLng | null;
  destination: LatLng | null;
  routes: RouteLeg[];
  selectedRouteId: string | null;
};

export default function RouteMap({ origin, destination, routes, selectedRouteId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const polygonsRef = useRef<google.maps.Polygon[]>([]);
  const resizeDisposablesRef = useRef<{
    observer?: ResizeObserver;
    onResize?: () => void;
  }>({});

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

  useEffect(() => {
    if (!apiKey || !containerRef.current) return;

    let cancelled = false;
    setMapError(null);

    const container = containerRef.current;
    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["geometry"],
    });

    loader
      .load()
      .then(() => {
        if (cancelled || !containerRef.current) return;

        const map = new google.maps.Map(containerRef.current, {
          center: { lat: 43.6532, lng: -79.3832 },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        mapRef.current = map;

        const resize = () => {
          google.maps.event.trigger(map, "resize");
        };
        const ro = new ResizeObserver(() => {
          requestAnimationFrame(resize);
        });
        ro.observe(container);
        window.addEventListener("resize", resize);
        resizeDisposablesRef.current = { observer: ro, onResize: resize };
        requestAnimationFrame(resize);

        setMapReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load Google Maps.";
          setMapError(msg);
          console.error("[SafeRoute Google Maps]", err);
        }
      });

    return () => {
      cancelled = true;

      resizeDisposablesRef.current.observer?.disconnect();
      if (resizeDisposablesRef.current.onResize) {
        window.removeEventListener("resize", resizeDisposablesRef.current.onResize);
      }
      resizeDisposablesRef.current = {};

      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
      polygonsRef.current.forEach((p) => p.setMap(null));
      polygonsRef.current = [];

      if (mapRef.current && typeof google !== "undefined" && google.maps?.event) {
        google.maps.event.clearInstanceListeners(mapRef.current);
      }
      mapRef.current = null;
      setMapReady(false);
      setMapError(null);
      container.innerHTML = "";
    };
  }, [apiKey]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const mk = (pos: LatLng, label: string, fill: string) => {
      const marker = new google.maps.Marker({
        map,
        position: { lat: pos.lat, lng: pos.lng },
        label: { text: label, color: "#ffffff", fontSize: "12px", fontWeight: "700" },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: fill,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      markersRef.current.push(marker);
    };

    if (origin) mk(origin, "A", "#059669");
    if (destination) mk(destination, "B", "#e11d48");
  }, [mapReady, origin, destination]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    polygonsRef.current.forEach((p) => p.setMap(null));
    polygonsRef.current = [];

    const visible = selectedRouteId
      ? routes.filter((r) => r.id === selectedRouteId)
      : routes;

    const bounds = new google.maps.LatLngBounds();

    visible.forEach((r) => {
      const path = lineStringToPath(r.geometry);
      path.forEach((pt) => bounds.extend(pt));
      const poly = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: r.color,
        strokeOpacity: 0.95,
        strokeWeight: 5,
        map,
      });
      polylinesRef.current.push(poly);
    });

    if (selectedRouteId) {
      const chosen = routes.find((x) => x.id === selectedRouteId);
      if (chosen) {
        const line = turf.lineString(chosen.geometry.coordinates);
        const fc = buildFakeLighting(line, selectedRouteId);
        fc.features.forEach((f) => {
          if (f.geometry.type !== "Polygon") return;
          const rings = f.geometry.coordinates.map((ring) =>
            ring.map(([lng, lat]) => ({ lat, lng })),
          );
          const poly = new google.maps.Polygon({
            paths: rings,
            strokeColor: "#ca8a04",
            strokeOpacity: 0.35,
            strokeWeight: 0,
            fillColor: "#fde047",
            fillOpacity: 0.35,
            map,
          });
          polygonsRef.current.push(poly);
        });
      }
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 72, right: 72, bottom: 72, left: 72 });
    }
  }, [mapReady, routes, selectedRouteId]);

  if (!apiKey) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center bg-slate-900 p-6 text-center text-sm text-amber-100">
        Add{" "}
        <code className="mx-1 rounded bg-slate-800 px-1.5 py-0.5 text-amber-50">
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        </code>{" "}
        to <code className="mx-1 rounded bg-slate-800 px-1.5 py-0.5">frontend/.env.local</code> and
        enable <strong className="text-amber-50">Maps JavaScript API</strong> for that key in Google
        Cloud.
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[280px] w-full flex-1 md:min-h-0">
      {mapError ? (
        <div className="absolute left-2 right-2 top-2 z-10 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 shadow-sm">
          <div className="font-semibold">Google Maps did not load</div>
          <p className="mt-1 leading-snug">
            {mapError} — Enable <strong>Maps JavaScript API</strong> for this key. If the key uses
            HTTP referrer restrictions, allow <code className="rounded bg-red-100 px-1">http://localhost:3000/*</code>{" "}
            (and your production origin). Restart <code className="rounded bg-red-100 px-1">npm run dev</code> after
            changing <code className="rounded bg-red-100 px-1">.env.local</code>.
          </p>
        </div>
      ) : null}
      <div ref={containerRef} className="h-full w-full min-h-[280px] md:min-h-0" />
    </div>
  );
}
