"""
SafeRoute API: Google Directions (alternatives) + geocoding + Places autocomplete + safety scoring.
Scores are heuristic for the hackathon; reasons explain proxy signals (not live crime/lighting feeds).
"""

from __future__ import annotations

import hashlib
import os
import time
from typing import Any, Dict, List, Literal, Optional

import httpx
import polyline
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

load_dotenv()

GOOGLE_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

TravelMode = Literal["driving", "walking", "transit", "bicycling"]

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
    address: Optional[str] = None
    place_id: Optional[str] = None

    @model_validator(mode="after")
    def require_address_or_place(self) -> "GeocodeRequest":
        a = (self.address or "").strip()
        p = (self.place_id or "").strip()
        if not a and not p:
            raise ValueError("Provide address or place_id")
        return self


class RoutesRequest(BaseModel):
    origin: LatLng
    destination: LatLng
    travel_mode: TravelMode = "driving"
    transit_prefer_bus: bool = False


def _require_google_key() -> str:
    if not GOOGLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="GOOGLE_MAPS_API_KEY is not configured on the server.",
        )
    return GOOGLE_KEY


def _stable_hash(s: str) -> int:
    return int(hashlib.sha256(s.encode("utf-8")).hexdigest()[:12], 16)


def _evaluate_route_safety(
    encoded_polyline: str,
    duration_s: float,
    distance_m: float,
) -> Dict[str, Any]:
    """
    Heuristic 0–100 (higher = safer) plus human-readable reasons tied to the same proxies.
    """
    h = _stable_hash(encoded_polyline)
    base = 35 + (h % 45)

    km_h = 0.0
    if distance_m > 0:
        km_h = (distance_m / 1000) / max(duration_s / 3600, 1e-3)
        if km_h > 85:
            base -= 8
        elif km_h < 25:
            base += 4

    jitter = (time.time() % 17) - 8
    score = max(0, min(100, base + jitter))

    if score >= 67:
        tier = "safe"
    elif score >= 42:
        tier = "moderate"
    else:
        tier = "dangerous"

    reasons: List[str] = []

    if distance_m > 0:
        if km_h > 80:
            reasons.append(
                "Higher average speeds along parts of this path — our demo model treats that as slightly higher exposure."
            )
        elif km_h < 30:
            reasons.append(
                "Slower-moving segments (walking-like speeds in the profile) rank a bit better in our demo comfort proxy."
            )

    # Deterministic “signals” from route fingerprint (clearly labeled as demo estimates).
    lighting_idx = h % 4
    lighting_msgs = [
        "Night lighting coverage (demo estimate): fewer well-lit blocks along portions of this polyline.",
        "Night lighting coverage (demo estimate): mixed lit and unlit segments.",
        "Night lighting coverage (demo estimate): mostly average municipal lighting in the model.",
        "Night lighting coverage (demo estimate): relatively more lit arterial segments in the model.",
    ]
    reasons.append(lighting_msgs[lighting_idx])

    crowd_idx = (h // 7) % 3
    crowd_msgs = [
        "Pedestrian / roadside crowding proxy (demo): busier mixed-use stretches in the model.",
        "Pedestrian / roadside crowding proxy (demo): moderate activity band.",
        "Pedestrian / roadside crowding proxy (demo): quieter segments in the model.",
    ]
    reasons.append(crowd_msgs[crowd_idx])

    incident_idx = (h // 13) % 3
    incident_msgs = [
        "Historical incident density layer: not connected — placeholder band only (no live police feed).",
        "Historical incident density layer: not connected — placeholder band only (no live police feed).",
        "Historical incident density layer: not connected — placeholder band only (no live police feed).",
    ]
    reasons.append(incident_msgs[incident_idx])

    if tier == "dangerous":
        reasons.append(
            "Overall tier is lower because the blended demo score fell in the higher-risk band — not due to a verified active threat."
        )
    elif tier == "moderate":
        reasons.append(
            "Overall tier is mid-range: a mix of proxy factors; still verify the corridor yourself, especially at night."
        )
    else:
        reasons.append(
            "Overall tier is higher on our demo blend — still use normal caution; this is not a guarantee of safety."
        )

    disclaimer = (
        "SafeRoute’s tiers combine geometry, speed/duration heuristics, and seeded demo signals. "
        "We do not yet ingest live crime, outages, or verified street-lamp inventories."
    )

    return {
        "safety_score": round(score, 1),
        "safety_tier": tier,
        "color": {"safe": "#22c55e", "moderate": "#eab308", "dangerous": "#ef4444"}.get(
            tier, "#64748b"
        ),
        "safety_reasons": reasons,
        "safety_disclaimer": disclaimer,
    }


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/api/places/autocomplete")
async def places_autocomplete(
    q: str = Query("", alias="input", min_length=0),
    sessiontoken: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    """Google Places Autocomplete (legacy) — enable Places API on the same server key."""
    key = _require_google_key()
    q = q.strip()
    if len(q) < 2:
        return {"predictions": []}

    url = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
    params: Dict[str, str] = {"input": q, "key": key}
    if sessiontoken:
        params["sessiontoken"] = sessiontoken

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(url, params=params)
    data = r.json()
    status = data.get("status")
    if status not in ("OK", "ZERO_RESULTS"):
        raise HTTPException(
            status_code=400,
            detail=data.get("error_message") or status or "Autocomplete failed",
        )

    preds = []
    for p in data.get("predictions", [])[:10]:
        preds.append(
            {
                "description": p.get("description"),
                "place_id": p.get("place_id"),
                "main_text": (p.get("structured_formatting") or {}).get("main_text"),
                "secondary_text": (p.get("structured_formatting") or {}).get("secondary_text"),
            }
        )
    return {"predictions": preds}


@app.post("/api/geocode")
async def geocode(body: GeocodeRequest) -> Dict[str, Any]:
    key = _require_google_key()
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params: Dict[str, str] = {"key": key}
    if body.place_id and body.place_id.strip():
        params["place_id"] = body.place_id.strip()
    else:
        params["address"] = (body.address or "").strip()

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
async def routes(body: RoutesRequest) -> Dict[str, Any]:
    key = _require_google_key()
    origin = f"{body.origin.lat},{body.origin.lng}"
    destination = f"{body.destination.lat},{body.destination.lng}"
    url = "https://maps.googleapis.com/maps/api/directions/json"
    params: Dict[str, str] = {
        "origin": origin,
        "destination": destination,
        "alternatives": "true",
        "mode": body.travel_mode,
        "key": key,
    }
    if body.travel_mode == "transit" and body.transit_prefer_bus:
        params["transit_mode"] = "bus"
    if body.travel_mode == "transit":
        # Helps Google return transit results instead of ZERO_RESULTS in many cities.
        params["departure_time"] = str(int(time.time()))

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.get(url, params=params)
    data = r.json()
    status = data.get("status")
    if status not in ("OK",):
        raise HTTPException(
            status_code=400,
            detail=data.get("error_message") or status or "Directions failed",
        )

    out_routes: List[Dict[str, Any]] = []
    for idx, leg in enumerate(data.get("routes", [])):
        enc = leg.get("overview_polyline", {}).get("points")
        if not enc:
            continue
        coords = polyline.decode(enc)
        geo_coords = [[lng, lat] for lat, lng in coords]

        legs = leg.get("legs") or []
        duration_s = sum(l.get("duration", {}).get("value", 0) for l in legs)
        distance_m = sum(l.get("distance", {}).get("value", 0) for l in legs)

        ev = _evaluate_route_safety(enc, float(duration_s), float(distance_m))
        route_id = f"route-{idx}-{_stable_hash(enc) % 10_000}"

        out_routes.append(
            {
                "id": route_id,
                "summary": leg.get("summary") or f"Route {idx + 1}",
                "duration_seconds": duration_s,
                "distance_meters": distance_m,
                "safety_score": ev["safety_score"],
                "safety_tier": ev["safety_tier"],
                "color": ev["color"],
                "safety_reasons": ev["safety_reasons"],
                "safety_disclaimer": ev["safety_disclaimer"],
                "geometry": {"type": "LineString", "coordinates": geo_coords},
            }
        )

    out_routes.sort(key=lambda x: x["safety_score"], reverse=True)

    return {
        "routes": out_routes,
        "updated_at": time.time(),
        "travel_mode": body.travel_mode,
    }


@app.post("/api/routes/{route_id}/safety")
async def route_safety_refresh(route_id: str, body: RoutesRequest) -> Dict[str, Any]:
    bundle = await routes(body)
    for rt in bundle["routes"]:
        if rt["id"] == route_id:
            return {
                "id": rt["id"],
                "safety_score": rt["safety_score"],
                "safety_tier": rt["safety_tier"],
                "color": rt["color"],
                "safety_reasons": rt["safety_reasons"],
                "safety_disclaimer": rt["safety_disclaimer"],
                "updated_at": time.time(),
            }
    raise HTTPException(status_code=404, detail="Route not found")
