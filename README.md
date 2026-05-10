# SafeRoute

SafeRoute is a web-based hackathon tool designed to determine walking and driving routes based on safety rather than the fastest time. Multiple possible routes are presented from the user’s starting point to the selected destination and colour-coded according to safety level:

- Green = safest
- Yellow = moderately safe
- Red = higher risk in our demo model

This allows users to make more informed travel decisions based on route safety.

---

## 1. Project overview

- SafeRoute prioritizes safety during navigation by analyzing different route alternatives.
- Users can visually compare route safety levels before selecting a path.
- The application highlights illustrative lighting information and periodically refreshes route safety data.
- **Places-style autocomplete** (Google Places), **“Here”** buttons for **current location** on A and B, **travel modes** (driving, walking, transit, cycling), and **“Why this rating?”** explanations for each route.
- The project was built as a website rather than a browser extension to simplify deployment and maximize UI flexibility during the hackathon.

---

## 2. Technology stack

| Layer | Technology |
| --- | --- |
| Map rendering | Google Maps JavaScript API |
| Routing / road geometry | Google Maps Directions API via Python |
| Geospatial helpers | Turf.js |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI |

---

## 3. Key features

- Multiple route alternatives displayed simultaneously
- Safety-based colour coding for routes
- Interactive route selection
- Illustrative lighting visualization
- Periodic safety refresh updates
- Modern responsive user interface
- Real-time map interaction using Google Maps
- Autocomplete search for start and destination
- Travel mode: driving, walking, transit (optional bus preference), cycling
- Plain-language reasons for each route’s tier (demo model — see disclaimer in the app)

---

## 4. System architecture

### Frontend

The Next.js frontend renders Google Maps and communicates with backend APIs.

### Backend

The FastAPI backend processes:

- Route requests (including travel mode and optional transit bus bias)
- Geocoding (address or `place_id` from autocomplete)
- Places autocomplete (proxied with your server key)
- Safety scoring and human-readable reason strings

### External APIs (Google Cloud)

Enable on the keys you use:

- **Backend key:** Directions API, Geocoding API, **Places API** (Place Autocomplete)
- **Browser key:** Maps JavaScript API (HTTP referrer restrictions for `localhost` and production)

You may use one key for both only if your restriction model allows it; often teams use two keys (server vs browser).

---

## 5. Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- Google Cloud project with billing enabled
- APIs enabled as listed above

---

## 6. Installation and setup

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Add your **server** Google API key to `backend/.env`:

```env
GOOGLE_MAPS_API_KEY=your_api_key
```

Run the backend:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local
```

Add to `frontend/.env.local`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_browser_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## 7. Secrets (do not commit tokens)

- Put keys only in `backend/.env` and `frontend/.env.local` (both gitignored).
- Do not paste keys into source files or push them to GitHub.
- If a key was ever exposed, revoke it in Google Cloud and create a new one.

---

## 8. Product priorities and roadmap

1. Safety-first navigation  
2. Fastest reasonable routes  
3. Road quality assessment  
4. Lighting analysis  
5. Road population density  
6. Eco-friendly routing  
7. Urban help-ready areas  

Future improvements: real crime/incident feeds, verified street lighting, crowd density, richer transit preferences, mobile apps.

---

## 9. Repository structure

```text
backend/     FastAPI — geocode, place autocomplete, directions, safety scoring
frontend/    Next.js + Google Maps JS + Turf
```

---

## 10. Honest note on “reasons”

Safety tiers and bullet reasons are generated from **heuristic and demo placeholders** (speed/duration shape, seeded lighting/crowd language, and explicit “not live data” lines). They are meant for **UX transparency**, not verified incident or threat reporting. Replace with real datasets when available.

---

# 11. Current Functionality and Known Limitations

## Automatic Location Detection

SafeRoute supports automatic location detection when users allow browser location permissions. Once permission is granted, the application autofills the user's current location into the route input fields.

### Current Behavior
- Automatically detects the user's location
- Autofills both the starting point and destination fields when permission is granted
- Supports route transportation options including:
  -  Walking
  -  Driving
  -  Public Transit / Bus

### Known Limitations
- The current implementation does not resolve the detected coordinates into a detailed address or place name like Google Maps.
- Instead of displaying a readable location such as:
  
  ```text
  1600 Amphitheatre Parkway, Mountain View, CA
  ```

  it currently fills the field using a generic "Current Location" value.

- Both the starting point and destination fields may autofill simultaneously when location permissions are enabled, which can create usability issues during route selection.

### Planned Improvements
Future versions aim to:
- Reverse geocode coordinates into real addresses and place names
- Improve autofill behavior to only populate the starting location by default
- Enhance the user experience to behave more similarly to Google Maps
- Improve transportation mode selection and route recommendations

---
