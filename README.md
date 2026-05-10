# SafeRoute Website Documentation

SafeRoute is a web-based hackathon tool designed to determine walking and driving routes based on safety rather than the fastest time. Multiple possible routes are presented from the user’s starting point to the selected destination and colour-coded according to safety level:

- 🟢 Green = Safest
- 🟡 Yellow = Moderately Safe
- 🔴 Red = Least Safe

This allows users to make more informed travel decisions based on route safety.

---

# 1. Project Overview

- SafeRoute prioritizes safety during navigation by analyzing different route alternatives.
- Users can visually compare route safety levels before selecting a path.
- The application highlights illustrative lighting information and periodically refreshes route safety data.
- The project was built as a website rather than a browser extension to simplify deployment and maximize UI flexibility during the hackathon.

---

# 2. Technology Stack

| Layer | Technology |
|---|---|
| Map Rendering | Google Maps JavaScript API |
| Routing / Road Geometry | Google Maps Directions API via Python |
| Geospatial Helpers | Turf.js |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI |

---

# 3. Key Features

- Multiple route alternatives displayed simultaneously
- Safety-based colour coding for routes
- Interactive route selection
- Illustrative lighting visualization
- Periodic safety refresh updates
- Modern responsive user interface
- Real-time map interaction using Google Maps

---

# 4. System Architecture

## Frontend
The Next.js frontend renders Google Maps and communicates with backend APIs.

## Backend
The FastAPI backend processes:
- Route requests
- Geocoding
- Safety scoring

## External APIs
Google Maps APIs provide:
- Route alternatives
- Road geometry
- Geolocation services

---

# 5. Prerequisites

Before running the project, ensure you have:

- Node.js 18+ and npm
- Python 3.10+
- Google Cloud project with billing enabled
- Google Maps API keys
- Directions API enabled
- Geocoding API enabled
- Maps JavaScript API enabled

---

# 6. Installation and Setup

## Backend Setup

```bash
cd backend

python3 -m venv .venv

# Activate virtual environment
# Linux / macOS
source .venv/bin/activate

# Windows
.venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
```

Add your Google Maps API key to `.env`:

```env
GOOGLE_MAPS_API_KEY=your_api_key
```

Run the backend server:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## Frontend Setup

```bash
cd frontend

cp .env.local.example .env.local
```

Add the following environment variables:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Install dependencies and start the development server:

```bash
npm install

npm run dev
```

Open:

```text
http://localhost:3000
```

---

# 7. Product Priorities and Roadmap

- Safety-first navigation
- Fastest reasonable routes
- Road quality assessment
- Lighting analysis
- Road population density
- Eco-friendly routing
- Urban help-ready areas

---

# 8. Repository Structure

```text
backend/
│
├── FastAPI backend handling:
│   ├── Geocoding
│   ├── Routing
│   └── Safety scoring

frontend/
│
├── Next.js frontend handling:
│   ├── Google Maps integration
│   ├── UI rendering
│   └── Turf.js geospatial processing
```

---

# 9. Future Improvements

- Integration with real crime and incident datasets
- Real lighting infrastructure data
- Crowd density analytics
- AI-based safety prediction
- Mobile app deployment
- User-reported safety incidents

---

# 10. Conclusion

SafeRoute demonstrates how modern web technologies and geospatial APIs can be combined to create a safer navigation experience. The project successfully showcases:

- Route safety visualization
- Multi-route comparisons
- Interactive mapping
- Scalable architecture for future expansion

The project provides a strong foundation for integrating real-world safety and urban analytics datasets in future versions.

---
