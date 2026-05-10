"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";
import type { LatLng, RouteLeg } from "@/types/route";

const ROUTES_SOURCE = "saferoute-routes";
const ROUTES_LAYER = "saferoute-routes-line";
const LIGHT_SOURCE = "saferoute-lighting";
const LIGHT_LAYER = "saferoute-lighting-fill";

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
    polys.push(turf.buffer(pt, 0.02 + rng() * 0.03, { units: "kilometers" }));
  }
  return turf.featureCollection(polys);
}

type Props = {
  origin: LatLng | null;
  destination: LatLng | null;
  routes: RouteLeg[];
  selectedRouteId: string | null;
};

export default function RouteMap({ origin, destination, routes, selectedRouteId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const markersRef = useRef<{ o?: mapboxgl.Marker; d?: mapboxgl.Marker }>({});

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    if (!token || !containerRef.current) return;

    setMapError(null);
    mapboxgl.accessToken = token;
    const container = containerRef.current;
    const map = new mapboxgl.Map({
      container,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-79.3832, 43.6532],
      zoom: 11,
      attributionControl: true,
    });
    mapRef.current = map;

    const resizeMap = () => {
      try {
        map.resize();
      } catch {
        /* ignore */
      }
    };

    const onMapError = (e: { error?: Error }) => {
      const msg = e.error?.message ?? "Map failed to load tiles or style.";
      setMapError(msg);
      console.error("[SafeRoute map]", e.error ?? e);
    };

    map.on("error", onMapError);

    const rafResize = () => {
      requestAnimationFrame(() => {
        resizeMap();
        requestAnimationFrame(resizeMap);
      });
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => rafResize());
      resizeObserver.observe(container);
    }

    window.addEventListener("resize", resizeMap);

    map.on("load", () => {
      rafResize();
      map.addSource(ROUTES_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: ROUTES_LAYER,
        type: "line",
        source: ROUTES_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 5,
          "line-opacity": 0.92,
        },
      });

      map.addSource(LIGHT_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer(
        {
          id: LIGHT_LAYER,
          type: "fill",
          source: LIGHT_SOURCE,
          paint: {
            "fill-color": "#fde047",
            "fill-opacity": 0.38,
          },
        },
        ROUTES_LAYER,
      );
      setMapLoaded(true);
      rafResize();
    });

    rafResize();

    return () => {
      window.removeEventListener("resize", resizeMap);
      resizeObserver?.disconnect();
      map.off("error", onMapError);
      markersRef.current.o?.remove();
      markersRef.current.d?.remove();
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
      setMapError(null);
    };
  }, [token]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    const clear = () => {
      markersRef.current.o?.remove();
      markersRef.current.d?.remove();
      markersRef.current = {};
    };

    clear();
    if (origin) {
      const el = document.createElement("div");
      el.className =
        "flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow ring-2 ring-white";
      el.textContent = "A";
      markersRef.current.o = new mapboxgl.Marker({ element: el })
        .setLngLat([origin.lng, origin.lat])
        .addTo(map);
    }
    if (destination) {
      const el = document.createElement("div");
      el.className =
        "flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-xs font-bold text-white shadow ring-2 ring-white";
      el.textContent = "B";
      markersRef.current.d = new mapboxgl.Marker({ element: el })
        .setLngLat([destination.lng, destination.lat])
        .addTo(map);
    }

    return clear;
  }, [mapLoaded, origin, destination]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const routeSrc = map.getSource(ROUTES_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    const lightSrc = map.getSource(LIGHT_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    if (!routeSrc || !lightSrc) return;

    const visible = selectedRouteId
      ? routes.filter((r) => r.id === selectedRouteId)
      : routes;

    const routeFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = visible.map((r) => ({
      type: "Feature",
      properties: { id: r.id, color: r.color },
      geometry: r.geometry,
    }));

    routeSrc.setData({ type: "FeatureCollection", features: routeFeatures });

    if (selectedRouteId) {
      const chosen = routes.find((r) => r.id === selectedRouteId);
      if (chosen) {
        const line = turf.lineString(chosen.geometry.coordinates);
        lightSrc.setData(buildFakeLighting(line, selectedRouteId));
        const bbox = turf.bbox(line);
        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding: 88, maxZoom: 14, duration: 650 },
        );
      } else {
        lightSrc.setData({ type: "FeatureCollection", features: [] });
      }
    } else {
      lightSrc.setData({ type: "FeatureCollection", features: [] });
      if (routeFeatures.length) {
        const fc = turf.featureCollection(routeFeatures);
        const bbox = turf.bbox(fc);
        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding: 72, maxZoom: 13, duration: 550 },
        );
      }
    }
  }, [mapLoaded, routes, selectedRouteId]);

  if (!token) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center bg-slate-900 p-6 text-center text-sm text-amber-100">
        Add{" "}
        <code className="mx-1 rounded bg-slate-800 px-1.5 py-0.5 text-amber-50">
          NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
        </code>{" "}
        to <code className="mx-1 rounded bg-slate-800 px-1.5 py-0.5">frontend/.env.local</code>.
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[280px] w-full flex-1 md:min-h-0">
      {mapError ? (
        <div className="absolute left-2 right-2 top-2 z-10 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 shadow-sm">
          <div className="font-semibold">Map could not load tiles</div>
          <p className="mt-1 leading-snug">
            {mapError} — If you use a restricted Mapbox token, add{" "}
            <code className="rounded bg-red-100 px-1">http://localhost:3000</code> (and{" "}
            <code className="rounded bg-red-100 px-1">http://127.0.0.1:3000</code>) under URL
            restrictions, then restart <code className="rounded bg-red-100 px-1">npm run dev</code>.
          </p>
        </div>
      ) : null}
      <div ref={containerRef} className="h-full w-full min-h-[280px] md:min-h-0" />
    </div>
  );
}
