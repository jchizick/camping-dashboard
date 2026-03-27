# Card Classification — Camping Dashboard

> Phase 3 reference document. Updated: 2026-03-07
> Defines which cards are system-fed, user-authored, or hybrid to guide CRUD implementation.

---

## System-Fed Cards
Driven by APIs, computed values, or derived state. Not directly user-authored.
Users cannot add/edit/delete data through these cards.

| Card | Source |
|---|---|
| Weather (Current) | weather API (Open-Meteo / similar) |
| Weather Forecast | weather API |
| Astro / Night Sky | astronomy computation |
| Map / Route | trip coordinates (launch_lat/lng, site_lat/lng) |
| Countdown | computed from trip.start_date |

---

## User-Authored Cards
Fully user-managed content. Phase 3 adds full CRUD (create / edit / delete).

| Card | Table | Priority |
|---|---|---|
| Gear Checklist | `gear_items` | Tier 1 |
| Meal Planner | `meals` | Tier 1 |
| Trip Timeline | `timeline_events` | Tier 1 |
| Crew Roster | `crew_members` | Tier 2 |
| Alerts / Notes (manual) | `alerts` (source='manual') | Tier 2 |

---

## Hybrid Cards
Combine user-entered data with computed or system-derived values.

| Card | User Input | System/Derived |
|---|---|---|
| Mission Readiness Score | gear packed state, meals planned, etc. | weighted score formula |
| Offline Vault Status | toggles (maps_cached, permit_saved, etc.) | derived readiness % |
| Park Intel | custom_notes, water_notes | fire restriction (external feed, Phase 3+) |
| Alerts (system) | dismiss action only | external source alerts |

---

## CRUD Rules by Type

- **System-Fed** → read-only display; no UI controls
- **User-Authored** → `+` button in card header; edit/delete per item; full Supabase CRUD
- **Hybrid** → case-by-case: toggles for boolean fields; read-only for computed outputs; manual fields are editable

---

## Implementation Order (Phase 3)

1. Gear Checklist (Tier 1)
2. Meal Planner (Tier 1)
3. Trip Timeline (Tier 1)
4. Crew Roster (Tier 2)
5. Alerts / Notes — manual entries only (Tier 2)
