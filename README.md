# SafeRoute

SafeRoute is a hackathon project: a **web app** (not a browser extension) that feels like familiar map search—point **A** to point **B**—while **prioritizing safety** over raw speed. Multiple paths are shown **color-coded** (green / yellow / red). Pick the route that fits you; the map **hides the others** and highlights **lighting** along the chosen path (illustrative where real lighting data is not wired yet).

## Stack

| Layer | Choice |
|--------|--------|
| Map rendering | **Google Maps JavaScript API** (Next.js client) |
| Routing / road geometry | **Google Maps Directions API** (`alternatives=true`) via Python |
| Geospatial helpers | **Turf.js** on the frontend |
| Frontend | **Next.js 14** (App Router, TypeScript, Tailwind) |
| Backend | **Python + FastAPI** |

**Why a website (not an extension)?** Faster to ship for a hackathon: one deploy target, no Chrome Web Store packaging, and full control over the UI.

## Prerequisites

- **Node.js 18+** and npm (for the frontend)
- **Python 3.10+** (for the API)
- **Google Cloud** project with billing, and API keys with:
  - **Backend:** Directions API + Geocoding API (server key; IP restriction recommended when deployed)
  - **Frontend:** Maps JavaScript API (browser key; **HTTP referrer** restriction recommended: `http://localhost:3000/*`, plus your production origin)

You can use **one** API key for both **only if** its restrictions work for both environments (often easier to use **two keys**: one referrer-restricted for the map, one IP-restricted for FastAPI).

## Setup

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Put your server key in .env as GOOGLE_MAPS_API_KEY=...
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (Maps JavaScript API enabled)
# and NEXT_PUBLIC_API_URL (default http://localhost:8000)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Product priorities (team roadmap)

1. Safety (primary)  
2. Fastest reasonable route  
3. Road quality  
4. Lighting  
5. Road population  
6. Eco-friendly (potential)  
7. Help-ready / urban population areas  

This repo implements **multi-route safety coloring**, **route selection**, **illustrative lighting**, and **periodic safety refresh** on the selected route. The safety model is **heuristic + small time jitter** for demo “live” updates until you plug in real incident / lighting / crowd datasets.

## Repo layout

```
backend/     FastAPI — geocode, directions, safety scoring
frontend/    Next.js + Google Maps JS + Turf
```
