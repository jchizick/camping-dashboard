# Follow-up: multi-trip weather refresh on Supabase Cron

## Scope and non-goals

This is a separate architecture proposal, not part of the prep-feed cleanup
worker diff. The current Vercel Cron entries and weather routes remain
unchanged until this replacement is implemented, deployed, and verified.

The replacement should use one Supabase Cron coordinator for all eligible
trips. It must not create one job per trip, assume Maple Lake, or bind the
orchestrator to one weather provider.

## Pattern to reuse from Our Adventures

The hosted Our Adventures `weather-for-adventure` Edge Function provides the
provider-boundary pattern to carry forward:

- resolve latitude, longitude, timezone, date, and time from the record rather
  than from a global default;
- isolate Open-Meteo request construction and response normalization;
- apply a finite provider timeout;
- distinguish missing coordinates, too-early forecasts, historical weather,
  provider unavailability, and a successful forecast;
- fingerprint provider inputs and retain provider/fetched/expiry metadata in a
  cache;
- vary freshness by how soon the event occurs;
- keep server credentials inside the Edge runtime.

The camping implementation should reuse the pattern, not copy its
adventure-specific schema or user-request authorization. A scheduled worker
needs service-only claim and transition RPCs, while manual refresh still needs
an authenticated membership/permission boundary.

## Proposed architecture

Use a single Supabase Cron job to invoke a coordinator Edge Function at a
modest fixed interval, initially every 15 minutes. Supabase Vault should hold a
dedicated scheduler bearer secret; the service-role key remains an automatic
Edge Function secret.

The coordinator claims at most 10 due trips per run through a service-only,
atomic `FOR UPDATE SKIP LOCKED` RPC. Eligibility should require:

- valid campsite latitude and longitude;
- a trip date/status that still benefits from forecast or current conditions;
- no active worker lock;
- `weather_current.updated_at` or dedicated refresh metadata older than the
  freshness threshold;
- `next_attempt_at <= now()` after a prior provider failure.

Freshness should be explicit and testable. A reasonable starting policy is one
hour for active/near-term trips, three hours for trips within seven days, and
12 hours for later trips inside the provider forecast window. Trips outside
the forecast window can be deferred until their next eligibility time rather
than repeatedly calling the provider.

Each claimed trip is passed to a provider-neutral weather service:

```text
trip coordinates + timezone + requested window
  -> provider adapter
  -> normalized current/forecast result
  -> atomic persistence + refresh metadata
```

Start with an `open-meteo` adapter that reuses the current mapper semantics.
The normalized contract, not the coordinator, owns provider-specific fields.
Persist `provider`, `fetched_at`, `expires_at`, input fingerprint, last status,
and sanitized failure metadata so another provider can be added without
changing trip selection or scheduling.

Process the bounded batch with limited concurrency, for example two or three
provider requests at once. Retry transient timeouts, rate limits, and 5xx
responses with backoff and jitter. Treat invalid coordinates or normalization
failures as operator-visible failures rather than fabricating weather. Logs
and HTTP responses should contain aggregate counts and internal run IDs, not
trip names, coordinates, provider payloads, or credentials.

## Alerts

The existing `/api/refresh-alerts` route combines two different concerns:
Environment Canada weather alerts and Ontario Parks Algonquin operations
alerts. A future replacement should model these as provider adapters with
explicit geographic applicability, not apply Algonquin/Ontario feeds to every
trip. They may share the coordinator infrastructure, but they should retain
separate normalized contracts and freshness rules.

Removing the `trip-maple-lake-001` fallback is a required migration outcome.
No scheduled path should infer a default trip.

## Manual refresh

Preserve manual refresh by making it call the same provider-neutral service or
enqueue the selected trip with immediate priority. Authorization should come
from the authenticated user and trip membership/edit permission; it should not
depend on a browser-exposed secret or select a default trip. Return a localized
status for that trip while keeping the background batch independent.

## Rollout and retirement

1. Add reviewed schema/RPC changes, provider adapter tests, due-selection
   tests, bounded-batch tests, and manual-refresh authorization tests.
2. Deploy the Supabase function and one inactive or shadow-mode Cron job.
3. Compare normalized results, freshness decisions, provider failures, and
   manual refresh behavior across multiple trips with different coordinates.
4. Activate Supabase scheduling while preventing duplicate writes, then
   observe successful runs, retry behavior, and rate limits through at least
   one complete refresh window.
5. Verify trips with no coordinates are skipped safely and no code path uses
   Maple Lake or another default.
6. Only after production QA, remove the two Vercel Cron entries and retire the
   legacy scheduled behavior. Keep manual refresh available through the new
   service.

The prep-feed cleanup scheduler is independent of this plan and provides no
authorization to alter the current weather jobs.
