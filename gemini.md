# 🏕️ gemini.md — Camping Dashboard Project Constitution
> **This file is law.** Only update when: a schema changes, a rule is added, or the architecture is modified.
> Last Updated: 2026-03-06

---

## 📌 Project Identity
- **Project Name:** Camping Dashboard — Algonquin Wilderness Mission Control
- **Trip:** Algonquin Park · Maple Lake — Site 4
- **System Pilot:** Antigravity (B.L.A.S.T. Protocol)
- **Status:** 🟢 PHASE 2 — Supabase Data Live

---

## 🗺️ Architecture: A.N.T. 3-Layer System

```
📂 Camping Dashboard/
├── gemini.md                    # Project Constitution (this file)
├── .env                         # API Keys/Secrets
├── architecture/                # Layer 1: SOPs & Technical Specs
├── tools/                       # Layer 3: Deterministic Python Scripts
├── .tmp/                        # Ephemeral workbench
└── camping-dashboard/           # Next.js app (Vercel deployment target)
    ├── src/
    │   ├── app/                 # Next.js App Router
    │   ├── components/
    │   │   ├── ui/              # Shared UI primitives
    │   │   └── cards/           # Feature cards
    │   ├── lib/
    │   │   ├── helpers.ts       # Derived logic functions
    │   │   └── mockData.ts      # All mock data (single source)
    │   └── types/
    │       └── index.ts         # All TypeScript interfaces
    ├── package.json
    └── tsconfig.json
```

---

## 🧭 Discovery Answers (Confirmed 2026-03-06)

| Q | Answer |
|---|--------|
| North Star | Expedition-feel dashboard for an Algonquin backcountry canoe trip to Maple Lake Site 4 |
| Integrations | Supabase (DB), Modal (weather jobs), Mapbox/Leaflet (maps), weather API (future) |
| Source of Truth | Supabase database; mock data for MVP |
| Delivery | Vercel-hosted web dashboard (desktop-first, responsive) |
| Behavioral Rules | Reliability > cleverness · Clarity > clutter · Cinematic but practical · 10-second glance readability |

---

## 📐 Data Schema

### Input Schema (Supabase Tables)

```json
{
  "trips": {
    "id": "uuid",
    "name": "string",
    "park_name": "string",
    "lake_name": "string",
    "site_name": "string",
    "start_date": "date",
    "end_date": "date",
    "launch_point_name": "string",
    "launch_lat": "float",
    "launch_lng": "float",
    "site_lat": "float",
    "site_lng": "float",
    "distance_km": "float",
    "notes": "text",
    "theme_mode": "enum(auto|day|night)",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  },
  "weather_current": {
    "id": "uuid", "trip_id": "uuid",
    "temperature_c": "float", "wind_kph": "float",
    "humidity": "int", "rain_chance": "int",
    "sunset_time": "time", "sunrise_time": "time",
    "moonset_time": "time", "visibility": "int",
    "condition_label": "string", "icon": "string",
    "updated_at": "timestamp"
  },
  "weather_forecast": {
    "id": "uuid", "trip_id": "uuid",
    "forecast_date": "date", "high_c": "float", "low_c": "float",
    "condition_label": "string", "rain_chance": "int",
    "wind_kph": "float", "icon": "string"
  },
  "gear_items": {
    "id": "uuid", "trip_id": "uuid",
    "name": "string", "category": "string",
    "packed": "boolean", "owner": "string",
    "priority": "enum(critical|high|low)",
    "notes": "text", "weight_kg": "float"
  },
  "timeline_events": {
    "id": "uuid", "trip_id": "uuid",
    "day_number": "int", "event_time": "time",
    "title": "string", "details": "string", "sort_order": "int",
    "phase": "enum(Transit|Setup|Sustain|Leisure|None)"
  },
  "meals": {
    "id": "uuid", "trip_id": "uuid",
    "day_number": "int", "meal_type": "enum(breakfast|lunch|dinner|snack)",
    "title": "string", "prep_type": "enum(dehydrated|fresh|fire)",
    "calories": "int", "assigned_to": "string", "notes": "text"
  },
  "crew_members": {
    "id": "uuid", "trip_id": "uuid",
    "name": "string", "role": "string",
    "load_item": "string", "load_weight_kg": "float",
    "canoe_number": "int", "notes": "text"
  },
  "park_intel": {
    "id": "uuid", "trip_id": "uuid",
    "fire_restriction": "string", "wildlife_notes": "text",
    "ranger_station": "string", "firewood_percent": "int",
    "water_notes": "text", "custom_notes": "text",
    "updated_at": "timestamp"
  },
  "offline_status": {
    "id": "uuid", "trip_id": "uuid",
    "maps_cached": "boolean", "permit_saved": "boolean",
    "route_downloaded": "boolean", "satellite_device_connected": "boolean",
    "satellite_device_name": "string", "emergency_contact_ready": "boolean",
    "updated_at": "timestamp"
  },
  "astro_data": {
    "id": "uuid", "trip_id": "uuid",
    "golden_hour_start": "time", "golden_hour_end": "time",
    "blue_hour_end": "time", "moon_phase": "string",
    "moon_illumination": "int", "milky_way_visibility": "string",
    "stargazing_notes": "text", "updated_at": "timestamp"
  },
  "alerts": {
    "id": "uuid", "trip_id": "uuid",
    "title": "string", "body": "text",
    "severity": "enum(info|warning|critical)",
    "source": "string", "is_active": "boolean",
    "created_at": "timestamp"
  },
  "settings": {
    "id": "uuid", "trip_id": "uuid",
    "manual_theme_override": "enum(auto|day|night)",
    "preferred_units": "enum(metric|imperial)",
    "show_astro": "boolean", "show_meals": "boolean",
    "show_offline": "boolean", "show_crew": "boolean"
  }
}
```

### Output / Payload Schema (Dashboard State)

```json
{
  "trip": "Trip",
  "currentWeather": "WeatherCurrent",
  "forecast": "WeatherForecast[]",
  "gear": "GearItem[]",
  "timeline": "TimelineEvent[]",
  "meals": "Meal[]",
  "crew": "CrewMember[]",
  "parkIntel": "ParkIntel",
  "offlineStatus": "OfflineStatus",
  "astro": "AstroData",
  "alerts": "Alert[]",
  "settings": "Settings",
  "derived": {
    "countdown": "CountdownResult",
    "themeMode": "day | night",
    "readinessScore": "ReadinessScore",
    "gearReadiness": "float (0-100)",
    "mealCompleteness": "float (0-100)",
    "offlineReadiness": "float (0-100)",
    "timelineCompleteness": "float (0-100)",
    "weatherPreparedness": "float (0-100)"
  }
}
```

---

## 🔗 Integrations & External Services

| Service | Purpose | Status |
|---------|---------|--------|
| Supabase | Primary database | 🟡 Planned |
| Modal | Scheduled weather refresh jobs | 🟡 Planned |
| Weather API (Open-Meteo or similar) | Forecast + current conditions | 🟡 Planned |
| Leaflet / Mapbox | Map embed + route display | 🟡 MVP with Leaflet |
| Vercel | Frontend hosting | 🟡 Planned |
| Algonquin alerts feed | Manual notes / park intel | 🟡 Phase 3 |

---

## 📏 Behavioral Rules

### Visual Philosophy
- Cinematic wilderness mission-control aesthetic
- Glassmorphism panels (tasteful — no neon)
- Day Mode: warm amber / pine tones, muted gold accent
- Night Mode: deep blue/indigo, ember gold accent
- Theme auto-switches by local time (sunrise/sunset), manual override supported
- 10-second glance readability rule for all key data

### Readiness Score Weights
| Component | Weight |
|-----------|--------|
| Gear | 35% |
| Meals | 20% |
| Weather preparedness | 15% |
| Offline safety | 20% |
| Timeline completeness | 10% |

### Readiness Labels
| Score | Label |
|-------|-------|
| 90–100 | Locked In |
| 75–89 | Nearly Ready |
| 50–74 | Needs Attention |
| <50 | Not Ready |

### Invariants (Never Break These)
- All intermediate files go in `.tmp/` — never in project root
- Secrets live only in `.env` — never hardcoded
- Business logic in `tools/` is deterministic Python only
- Mock data lives in `lib/mockData.ts` — never inside components
- Helper functions live in `lib/helpers.ts` — not inline in JSX
- UI components do not fetch data directly
- Update this file before updating any code if schema/rules change

### "Do Not" Rules
- Do not make it feel like a generic SaaS dashboard
- Do not make it feel like a gaming HUD
- Do not use neon or oversaturated colors
- Do not combine server state with transient UI state
- Do not hardcode values inside card components

---

## 🛡️ Self-Annealing Protocol
When a tool fails:
1. **Analyze** — Read the full stack trace. No guessing.
2. **Patch** — Fix the script in `tools/`
3. **Test** — Confirm the fix works
4. **Document** — Update the corresponding `architecture/*.md` SOP with the new learning

---

## 📜 Maintenance Log
| Date | Change | Author |
|------|--------|--------|
| 2026-03-05 | Initial constitution created | System Pilot |
| 2026-03-06 | Full schema, integrations, and behavioral rules defined from discovery brief | System Pilot |
| 2026-03-20 | Replaced `moonrise_time` with `visibility` in `weather_current` schema | System Pilot |
