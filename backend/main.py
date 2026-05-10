"""
SafeRoute API: Google Directions (alternatives) + geocoding + safety scoring.
Scores are heuristic for the hackathon; optional jitter simulates live risk updates.
"""

from __future__ import annotations

import hashlib
import os
import time
from typing import Any

import httpx
import polyline
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

GOOGLE_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app = FastAPI(title="SafeRoute API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LatLng(BaseModel):
    lat: float
    lng: float


class GeocodeRequest(BaseModel):
    address: str = Field(..., min_length=1)


class RoutesRequest(BaseModel):
    origin: LatLng
    destination: LatLng


def _require_google_key() -> str:
    if not GOOGLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="GOOGLE_MAPS_API_KEY is not configured on the server.",
        )
    return GOOGLE_KEY


def _stable_hash(s: str) -> int:
    return int(hashlib.sha256(s.encode("utf-8")).hexdigest()[:12], 16)


def _safety_score(encoded_polyline: str, duration_s: float, distance_m: float) -> tuple[float, str]:
    """
    Heuristic 0–100 (higher = safer). Hackathon demo: blend stability from geometry
    with small time-based jitter when re-scored for "real-time" feel.
    """
    h = _stable_hash(encoded_polyline)
    base = 35 + (h % 45)  # 35–79 stable band per route shape

    # Slightly favor routes that are not extreme speed-vs-distance (proxy for highway-only dash).
    if distance_m > 0:
        km_h = (distance_m / 1000) / max(duration_s / 3600, 1e-3)
        if km_h > 85:
            base -= 8
        elif km_h < 25:
            base += 4

    jitter = (time.time() % 17) - 8  # ±8 live-ish swing on refresh
    score = max(0, min(100, base + jitter))

    if score >= 67:
        tier = "safe"
    elif score >= 42:
        tier = "moderate"
    else:
        tier = "dangerous"
    return score, tier


def _tier_color(tier: str) -> str:
    return {"safe": "#22c55e", "moderate": "#eab308", "dangerous": "#ef4444"}.get(
        tier, "#64748b"
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/geocode")
async def geocode(body: GeocodeRequest) -> dict[str, Any]:
    key = _require_google_key()
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {"address": body.address, "key": key}
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url, params=params)
    data = r.json()
    if data.get("status") not in ("OK",):
        raise HTTPException(
            status_code=400,
            detail=data.get("error_message") or data.get("status") or "Geocoding failed",
        )
    first = (data.get("results") or [None])[0]
    if not first:
        raise HTTPException(status_code=404, detail="No results")
    loc = first["geometry"]["location"]
    return {
        "formatted_address": first.get("formatted_address"),
        "location": {"lat": loc["lat"], "lng": loc["lng"]},
    }


@app.post("/api/routes")
async def routes(body: RoutesRequest) -> dict[str, Any]:
    key = _require_google_key()
    origin = f"{body.origin.lat},{body.origin.lng}"
    destination = f"{body.destination.lat},{body.destination.lng}"
    url = "https://maps.googleapis.com/maps/api/directions/json"
    params = {
        "origin": origin,
        "destination": destination,
        "alternatives": "true",
        "key": key,
    }
    async with httpx.AsyncClient(timeout=45) as client:
        r = await client.get(url, params=params)
    data = r.json()
    status = data.get("status")
    if status not in ("OK",):
        raise HTTPException(
            status_code=400,
            detail=data.get("error_message") or status or "Directions failed",
        )

    out_routes: list[dict[str, Any]] = []
    for idx, leg in enumerate(data.get("routes", [])):
        enc = leg.get("overview_polyline", {}).get("points")
        if not enc:
            continue
        coords = polyline.decode(enc)
        geo_coords = [[lng, lat] for lat, lng in coords]

        legs = leg.get("legs") or []
        duration_s = sum(l.get("duration", {}).get("value", 0) for l in legs)
        distance_m = sum(l.get("distance", {}).get("value", 0) for l in legs)

        score, tier = _safety_score(enc, float(duration_s), float(distance_m))
        route_id = f"route-{idx}-{_stable_hash(enc) % 10_000}"

        out_routes.append(
            {
                "id": route_id,
                "summary": leg.get("summary") or f"Route {idx + 1}",
                "duration_seconds": duration_s,
                "distance_meters": distance_m,
                "safety_score": round(score, 1),
                "safety_tier": tier,
                "color": _tier_color(tier),
                "geometry": {"type": "LineString", "coordinates": geo_coords},
            }
        )

    # Prefer safer routes first in the list (still show all on map).
    out_routes.sort(key=lambda x: x["safety_score"], reverse=True)

    return {"routes": out_routes, "updated_at": time.time()}


@app.post("/api/routes/{route_id}/safety")
async def route_safety_refresh(route_id: str, body: RoutesRequest) -> dict[str, Any]:
    """
    Recompute safety for a single route after selection (same Directions call, pick matching id).
    """
    bundle = await routes(body)
    for rt in bundle["routes"]:
        if rt["id"] == route_id:
            return {
                "id": rt["id"],
                "safety_score": rt["safety_score"],
                "safety_tier": rt["safety_tier"],
                "color": rt["color"],
                "updated_at": time.time(),
            }
    raise HTTPException(status_code=404, detail="Route not found")
