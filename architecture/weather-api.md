# Weather API SOP — Open-Meteo Integration

**Last Updated:** 2026-03-12
**Status:** ✅ Live (on-demand refresh)

---

## Overview

Weather data is fetched from [Open-Meteo](https://open-meteo.com/) (free, no API key required) via a Next.js API route and written into Supabase. The dashboard reads from Supabase — there is no direct API call from the browser to Open-Meteo.

```
Open-Meteo API (no key needed)
     ↓  GET /v1/forecast?latitude=...&longitude=...
/api/refresh-weather  (Next.js route, server-side)
     ↓  upsert weather_current, delete+insert weather_forecast
Supabase (gdsmyxzqtmhwbcyobzou)
     ↓  read on next page load
Dashboard
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/api/refresh-weather/route.ts` | The API route. Fetches, maps, and upserts. |
| `src/lib/weatherMapper.ts` | Maps Open-Meteo JSON → our Supabase schema. WMO code table lives here. |
| `src/lib/supabaseAdmin.ts` | Server-only Supabase client using `SUPABASE_SERVICE_ROLE_KEY`. Never import in browser. |
| `src/components/cards/WeatherCard.tsx` | Renders weather; includes dev-only refresh button. |

---

## Environment Variables Required

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` / Vercel | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` / Vercel | Public anon key for reads |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` / Vercel | **Server-only.** Bypasses RLS for upserts. Never expose to browser. |
| `WEATHER_REFRESH_SECRET` | `.env.local` / Vercel | Shared secret to authorize refresh calls. |
| `NEXT_PUBLIC_WEATHER_REFRESH_SECRET` | `.env.local` / Vercel | Same value — exposed to browser so the WeatherCard button can pass it. |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` must **never** be used in client-side code. It is only safe inside API routes (server-side).

---

## How to Trigger a Refresh

### Via browser (dev mode)
1. Visit dashboard with `?dev=true` appended: `http://localhost:3000/?dev=true`
2. Click the **⟳ Refresh Weather** button in the Weather card.
3. Page reloads ~1.2s after success showing the new data.

### Via direct API call (curl / Hoppscotch)
```bash
curl "http://localhost:3000/api/refresh-weather?secret=YOUR_SECRET"
```
Returns:
```json
{
  "ok": true,
  "updated_at": "2026-03-12T12:00:00.000Z",
  "current": { "temperature_c": 4.2, "condition_label": "Partly Cloudy", "icon": "⛅" },
  "forecast_days": 5
}
```

---

## Open-Meteo Parameters

**Endpoint:** `https://api.open-meteo.com/v1/forecast`

| Parameter | Value |
|-----------|-------|
| `latitude` | `trip.site_lat` (from Supabase) |
| `longitude` | `trip.site_lng` (from Supabase) |
| `timezone` | `America/Toronto` |
| `forecast_days` | `5` |
| `current` | `temperature_2m, relative_humidity_2m, wind_speed_10m, weather_code, precipitation_probability` |
| `daily` | `weather_code, temperature_2m_max, temperature_2m_min, precipitation_probability_max, wind_speed_10m_max, sunrise, sunset, moonrise, moonset` |

---

## WMO Weather Code → Label/Icon

The mapping lives in `src/lib/weatherMapper.ts` (`WMO_LABELS` + `WMO_ICONS`).
Source: [Open-Meteo WMO codes](https://open-meteo.com/en/docs#weathervariables)

---

## Supabase Write Strategy

| Table | Strategy |
|-------|---------|
| `weather_current` | `upsert` on fixed ID `weather-maple-lake-current` |
| `weather_forecast` | `DELETE` all rows for `trip_id`, then `INSERT` fresh 5-day set |

---

## Phase 3: Scheduled Refresh (Planned)

Future: A Modal.com scheduled job will call the refresh endpoint on a cron schedule (e.g. every 3 hours during the trip). The endpoint contract won't change — add the cron call in Modal's `@app.function(schedule=Period(hours=3))`.

---

## Self-Annealing Notes

- If Open-Meteo returns a non-200 → route returns `502`, logs the body.
- If Supabase upsert fails → route returns `500`, nothing is partially written (upsert is atomic per table).
- The dashboard's `fetchDashboard.ts` falls back to `mockData` if Supabase has no weather rows — safe fallback throughout.
