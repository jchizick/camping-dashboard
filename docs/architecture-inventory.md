# Camping Dashboard — Architecture Inventory

> Generated from codebase inspection. Documentation only — no production changes.

---

## 1. App Structure

- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5
- **Styling:** Tailwind CSS v4, CSS variables (day/night theming), custom SVG topo background
- **Icons:** Lucide React
- **Mapping:** MapTiler SDK, Leaflet + React-Leaflet (Leaflet CSS loaded via CDN in layout)
- **Fonts:** Inter (Google Fonts, layout `<head>`), JetBrains Mono (imported in `globals.css`)
- **Deployment:** Vercel (`vercel.json` with cron jobs configured)
- **Linting:** ESLint 9 + eslint-config-next

### Entry Points

| File | Role |
|------|------|
| `src/app/layout.tsx` | Root layout. Loads fonts, Leaflet CSS, `<TopoBackground />`, dark class on `<html>` |
| `src/app/page.tsx` | Single-page dashboard. `'use client'`. Wraps in `<AuthProvider>` → `<DashboardLoader>` → `<DashboardContent>` |
| `src/app/globals.css` | Design tokens, theme variables (`:root` / `.dark`), CRUD sheet styles, scrollbar styles |

### Routing

- **Single page app** — only `/` route serves the dashboard
- **API routes:** `/api/refresh-weather`, `/api/refresh-alerts`
- **Auth route:** `/auth/callback` (Google OAuth redirect handler)

---

## 2. Dashboard Modules / Cards

### UI Primitives (`src/components/ui/`)

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| GlassCard | `GlassCard.tsx` | Glassmorphism card wrapper | Implemented |
| Primitives (Card) | `Primitives.tsx` | Base `<Card>` component with title/icon/action slot | Implemented |
| SectionHeader | `SectionHeader.tsx` | Section heading with icon | Implemented |
| IconLabel | `IconLabel.tsx` | Icon + text label row | Implemented |
| MetricRow | `MetricRow.tsx` | Label/value metric display | Implemented |
| StatusPill | `StatusPill.tsx` | Colored status badge | Implemented |
| ProgressBar | `ProgressBar.tsx` | Animated progress bar | Implemented |
| MiniForecastDay | `MiniForecastDay.tsx` | Single forecast day column | Implemented |
| ChecklistItem | `ChecklistItem.tsx` | Toggleable checklist row | Implemented |
| CrudSheet | `CrudSheet.tsx` | Slide-out side panel for CRUD forms | Implemented |
| TopoBackground | `TopoBackground.tsx` | Full-page SVG topographic texture background | Implemented |
| MissionBriefModal | `MissionBriefModal.tsx` | Full-screen video modal (mission brief) | Implemented |
| ProjectIntelModal | `ProjectIntelModal.tsx` | Full-screen markdown-like text modal (tech stack summary) | Implemented |

### Feature Cards (`src/components/cards/`)

| Card | File | Data Source | Status |
|------|------|-------------|--------|
| HeroHeader | `HeroHeader.tsx` | `Trip`, `WeatherCurrent`, `ReadinessScore`, `CountdownResult` from Supabase | Implemented |
| CountdownCard | `CountdownCard.tsx` | Derived from `trip.start_date` via `getTripCountdown()` | Implemented |
| WeatherCard | `WeatherCard.tsx` | `WeatherCurrent`, `AstroData` from Supabase | Implemented |
| ForecastCard | `ForecastCard.tsx` | `WeatherForecast[]` from Supabase | Implemented |
| MapRouteCard | `MapRouteCard.tsx` | `Trip` (lat/lng). Dynamic import of `MapRouteCardInner` | Implemented |
| MapRouteCardInner | `MapRouteCardInner.tsx` | MapTiler SDK, custom map style ID, hardcoded center coords | Implemented |
| ReadinessScoreCard | `ReadinessScoreCard.tsx` | `ReadinessScore` (computed in page from helpers) | Implemented |
| GearChecklistCard | `GearChecklistCard.tsx` | `GearItem[]` from Supabase. Full CRUD via mutations | Implemented |
| GearFormSheet | `GearFormSheet.tsx` | Slide-out form for add/edit gear | Implemented |
| TimelineCard | `TimelineCard.tsx` | `TimelineEvent[]` from Supabase. Full CRUD | Implemented |
| TimelineFormSheet | `TimelineFormSheet.tsx` | Slide-out form for add/edit timeline events | Implemented |
| ParkIntelCard | `ParkIntelCard.tsx` | `ParkIntel` from Supabase. Editable (update only) | Implemented |
| ParkIntelFormSheet | `ParkIntelFormSheet.tsx` | Slide-out form for editing park intel | Implemented |
| AlertsCard | `AlertsCard.tsx` | `Alert[]` from Supabase. Manual add/delete supported | Implemented |
| AlertFormSheet | `AlertFormSheet.tsx` | Slide-out form for adding manual alerts | Implemented |
| MealPlannerCard | `MealPlannerCard.tsx` | `Meal[]` from Supabase. Full CRUD. Visibility controlled by `settings.show_meals` | Implemented |
| MealFormSheet | `MealFormSheet.tsx` | Slide-out form for add/edit meals | Implemented |
| CrewRosterCard | `CrewRosterCard.tsx` | `CrewMember[]` from Supabase. Full CRUD. Visibility: `settings.show_crew` | Implemented |
| CrewFormSheet | `CrewFormSheet.tsx` | Slide-out form for add/edit crew | Implemented |
| OfflineVaultCard | `OfflineVaultCard.tsx` | `OfflineStatus` from Supabase. Toggle booleans. Visibility: `settings.show_offline` | Implemented |
| AstroCard | `AstroCard.tsx` | `AstroData`, `WeatherCurrent` from Supabase. Visibility: `settings.show_astro` | Implemented |

---

## 3. Data and State

### Supabase — Primary Data Store (Implemented, Live)

- **Browser client:** `src/lib/supabase.ts` — `createBrowserClient` from `@supabase/ssr`
- **Admin client:** `src/lib/supabaseAdmin.ts` — `createClient` with `SUPABASE_SERVICE_ROLE_KEY` (server-only, used by API routes)
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (in `.env.local`)

### Data Fetching

- **`src/lib/fetchDashboard.ts`** — Batch fetches all 12 tables in `Promise.all()` via Supabase browser client. Hardcoded `TRIP_ID = 'trip-maple-lake-001'`. Called once on page load in `DashboardLoader`.

### Mutations

- **`src/lib/mutations.ts`** — Centralized Supabase mutation helpers for: gear (CRUD + toggle), meals (CRUD), timeline (CRUD), crew (CRUD), alerts (create/deactivate/delete), park intel (update), offline status (update). All use browser client. All use hardcoded `TRIP_ID`.

### Derived State / Helpers

- **`src/lib/helpers.ts`** — Pure functions for:
  - `getTripCountdown()` — live countdown from start date
  - `getThemeModeFromTime()` — day/night auto-switch (defined but theme is currently hardcoded to `'night'` in `page.tsx`)
  - `calculateGearReadiness()`, `calculateMealCompleteness()`, `calculateOfflineReadiness()`, `calculateTimelineCompleteness()`, `calculateWeatherPreparedness()`
  - `calculateOverallReadiness()` — weighted composite (gear 35%, meals 20%, weather 15%, offline 20%, timeline 10%)
  - `getReadinessLabel()` — score → label mapping
  - `getSkyQuality()`, `getHeadlampTime()`, `getGoldenHourLabel()` — astro helpers
  - `formatTripDates()`, `getTripDays()`, `groupBy()`, `padTwo()`

### Weather Mapper

- **`src/lib/weatherMapper.ts`** — Maps Open-Meteo API response to Supabase `weather_current` and `weather_forecast` schema. Includes WMO weather code → label/icon lookup tables.

### Auth

- **`src/lib/authContext.tsx`** — React context provider. Supabase Google OAuth. Email whitelist (`esheridan9@gmail.com`, `jordanlanechizick@gmail.com`). Non-whitelisted users get read-only access (mutation handlers gated by `isAuthorized`).
- **`src/app/auth/callback/route.ts`** — Server-side OAuth code exchange. Creates Supabase session via cookies.

### Static Data / localStorage

- **No `mockData.ts` file exists** — all data is live from Supabase
- **No localStorage usage detected** in any source file

### TypeScript Types

- **`src/types/index.ts`** — All interfaces: `Trip`, `WeatherCurrent`, `WeatherForecast`, `GearItem`, `TimelineEvent`, `Meal`, `CrewMember`, `ParkIntel`, `OfflineStatus`, `AstroData`, `Alert`, `Settings`, `CountdownResult`, `ReadinessScore`, `DashboardData`. Enums: `ThemeMode`, `ThemeOverride`, `Priority`, `MealType`, `PrepType`, `AlertSeverity`, `Units`, `TimelinePhase`.

---

## 4. API Routes

### `/api/refresh-weather` (`src/app/api/refresh-weather/route.ts`)
- **Method:** GET
- **Auth:** `CRON_SECRET` (Bearer header) or `WEATHER_REFRESH_SECRET` (query param)
- **Flow:** Fetches trip coords from Supabase → calls Open-Meteo API → maps via `weatherMapper.ts` → upserts `weather_current` → deletes + inserts `weather_forecast` rows
- **External API:** `https://api.open-meteo.com/v1/forecast` (current + 5-day daily)
- **Cron:** Vercel cron daily at `0 11 * * *` UTC (`vercel.json`)
- **Status:** Implemented, live

### `/api/refresh-alerts` (`src/app/api/refresh-alerts/route.ts`)
- **Method:** GET
- **Auth:** Same as refresh-weather
- **Flow:** Scrapes two sources, deduplicates by source, upserts into `alerts` table
  - **Ontario Parks:** Scrapes `https://www.ontarioparks.ca/park/algonquin/backcountry/alerts` (HTML → regex text extraction)
  - **Environment Canada:** Fetches `https://weather.gc.ca/rss/battleboard/onrm31_e.xml` (ATOM/XML → regex entry parsing)
- **Cron:** Vercel cron daily at `15 11 * * *` UTC (`vercel.json`)
- **Status:** Implemented, live

---

## 5. User Flows

### Loading Flow
1. `page.tsx` renders `<AuthProvider>` → `<DashboardLoader>`
2. `DashboardLoader` calls `fetchDashboardData()` (all 12 Supabase tables)
3. While loading: animated compass/radar spinner with "Initializing Mission Control" text
4. On error: error message displayed
5. On success: renders `<DashboardContent>`

### Auth Flow
1. User clicks "Sign In" button in `HeroHeader`
2. Triggers `supabase.auth.signInWithOAuth({ provider: 'google' })`
3. Google redirects to `/auth/callback`
4. Callback exchanges code for session via cookies
5. Redirects to `/`
6. `AuthProvider` checks email against whitelist → sets `isAuthorized`
7. Mutation handlers only passed to cards if `isAuthorized === true`

### Mission Brief Flow
1. User clicks "Mission Brief" button in `HeroHeader`
2. Opens `MissionBriefModal` — full-screen video player
3. Video source: Vercel Blob Storage (`mission-brief-v2.mp4`)
4. Close via ESC, click-outside, or X button

### Project Intel Flow
1. User clicks intel button in `OfflineVaultCard`
2. Opens `ProjectIntelModal` — scrollable markdown-style text describing tech stack
3. Content is hardcoded string constant in component file

### Gear Checklist Flow
1. `GearChecklistCard` displays gear grouped by category
2. Toggle packed status → optimistic update → `toggleGearPacked()` Supabase write → revert on error
3. Add/Edit: opens `GearFormSheet` slide-out → `createGearItem()` / `updateGearItem()`
4. Delete: `deleteGearItem()`
5. All gated by `isAuthorized`

### Meal Planning Flow
1. `MealPlannerCard` displays meals grouped by day
2. Add/Edit: `MealFormSheet` → `createMeal()` / `updateMeal()`
3. Delete: `deleteMeal()`
4. Visibility controlled by `settings.show_meals`

### Crew / Load Balance Flow
1. `CrewRosterCard` displays crew with canoe assignments and load weights
2. Add/Edit: `CrewFormSheet` → `createCrewMember()` / `updateCrewMember()`
3. Delete: `deleteCrewMember()`
4. Visibility controlled by `settings.show_crew`

### Timeline / Itinerary Flow
1. `TimelineCard` displays events grouped by day
2. Add/Edit: `TimelineFormSheet` → `createTimelineEvent()` / `updateTimelineEvent()`
3. Delete: `deleteTimelineEvent()`

### Alerts Flow
1. `AlertsCard` displays active alerts with severity badges
2. Automated alerts populated via `/api/refresh-alerts` cron (Ontario Parks + Environment Canada)
3. Manual alert add/delete supported via `AlertFormSheet`

### Offline Vault Flow
1. `OfflineVaultCard` displays boolean checklist (maps cached, permit saved, etc.)
2. Toggle items → optimistic update → `updateOfflineStatus()` Supabase write
3. "Project Intel" button opens `ProjectIntelModal`

### Park Intel Flow
1. `ParkIntelCard` displays fire restrictions, wildlife notes, ranger station, firewood %, water notes
2. Edit: `ParkIntelFormSheet` → `updateParkIntel()`

### Weather / Forecast Flow
1. `WeatherCard` shows current conditions (temp, wind, humidity, rain chance, sunrise/sunset, visibility)
2. `ForecastCard` shows multi-day forecast
3. Data refreshed by `/api/refresh-weather` cron → Open-Meteo API → Supabase
4. Dashboard reads from Supabase on page load (no client-side weather API calls)

### Map Flow
1. `MapRouteCard` dynamically imports `MapRouteCardInner` (client-side only)
2. `MapRouteCardInner` renders MapTiler SDK map with custom style, hardcoded center coordinates
3. No route polyline drawn — map shows terrain at zoom 14.1
4. No markers currently rendered

---

## 6. Python Tools (`tools/`)

| Script | Purpose | Status |
|--------|---------|--------|
| `algonquin_alerts_scraper.py` | Scrapes Ontario Parks alerts page → upserts to Supabase `alerts` table | Implemented (standalone, superseded by API route) |
| `ec_weather_scraper.py` | Fetches Environment Canada ATOM feed → upserts to Supabase `alerts` table | Implemented (standalone, superseded by API route) |
| `clear_alerts.py` | Deletes all non-manual alerts from Supabase | Implemented (admin utility) |
| `requirements.txt` | Python deps: `requests`, `beautifulsoup4`, `supabase`, `python-dotenv` | Present |

> Note: The Python scrapers appear to be the original standalone versions. Their logic has been ported into the Next.js API routes (`/api/refresh-alerts`), which are now the primary mechanism via Vercel cron.

---

## 7. Future / Planned Systems

Only items directly referenced in code, comments, or docs:

- **Modal (scheduled jobs):** Referenced in `architecture/project-summary.md` and `gemini.md` as "planned" for scheduled background jobs. Not implemented.
- **Day/Night auto-theme:** `getThemeModeFromTime()` is implemented in `helpers.ts` but theme is hardcoded to `'night'` in `page.tsx` line 204. Auto-switch is not active.
- **Moonrise/moonset data:** Comments in `weatherMapper.ts` note "moonrise / moonset are NOT available from Open-Meteo — defaulted to `'--:--'`". `WeatherCurrent` type still has `moonset_time` field.
- **Map route polyline / markers:** `MapRouteCard` receives `trip.launch_lat/lng` and `trip.site_lat/lng` but `MapRouteCardInner` does not render markers or a route line.
- **Settings management UI:** `Settings` table is read from Supabase but no UI exists to modify settings.
- **Algonquin alerts feed (Phase 3):** Referenced in `gemini.md` integrations table as "🟡 Phase 3".

---

## 8. Architecture Docs (`architecture/`)

| File | Content |
|------|---------|
| `card-classification.md` | Card taxonomy and classification rules |
| `project-summary.md` | Tools & technology stack narrative (same content as ProjectIntelModal) |
| `weather-api.md` | Weather API integration documentation |

---

## 9. Config Files

| File | Purpose |
|------|---------|
| `vercel.json` | Cron jobs: `/api/refresh-weather` (daily 11:00 UTC), `/api/refresh-alerts` (daily 11:15 UTC) |
| `next.config.ts` | Minimal Next.js config |
| `tsconfig.json` | TypeScript config with `@/` path alias |
| `postcss.config.mjs` | PostCSS with Tailwind plugin |
| `eslint.config.mjs` | ESLint config |
| `.env.local` | Supabase URL, anon key, service role key, MapTiler key, cron secret, weather refresh secret |
| `gemini.md` | Project constitution — schema, rules, behavioral guidelines |
