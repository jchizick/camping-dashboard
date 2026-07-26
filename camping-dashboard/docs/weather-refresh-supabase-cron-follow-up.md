# Multi-trip weather refresh architecture

## Decision

Camping Dashboard weather refresh moves to one provider-neutral Supabase Edge
Function, `refresh-trip-weather`, coordinated by one hourly Supabase Cron job,
`refresh-due-trip-weather`. It does not create one job per trip and does not
assume a default or Maple Lake trip.

This document records the reviewed local design. The hosted migration, Edge
Function deployment, Vault secret, Cron activation, and Vercel cutover remain
staged operations. The existing Vercel weather schedule stays in place until a
real hosted Supabase cycle succeeds, even though its missing `trip_id` contract
currently makes it ineffective.

The prep-feed cleanup scheduler and `/api/refresh-alerts` are independent and
must not be changed by the weather rollout.

## Existing failure

`vercel.json` invokes `/api/refresh-weather` daily at 11:00 UTC without query
parameters. The legacy route requires `trip_id`, so scheduled calls return 400.
The route also performed three independent writes: current upsert, forecast
upsert, then stale-row deletion. A later failure could therefore leave a
half-new weather view.

`/api/refresh-alerts` runs daily at 11:15 UTC, is hardcoded to
`trip-maple-lake-001`, and uses Ontario/Canada-specific sources. It remains
unchanged pending the separate alerts proposal.

## Our Adventures comparison

The accessible Our Adventures implementation supplied useful patterns:

- an isolated Open-Meteo request/normalization boundary;
- a nine-second provider timeout;
- coordinates and provider timezone rather than a global default;
- nullable provider fields instead of fabricated values;
- deterministic request fingerprinting;
- persisted provider, fetched, expiry, and payload metadata;
- stale content retained when the provider fails.

Camping Dashboard does not copy its per-adventure invocation, raw JSON cache,
adventure lifecycle rules, or logs containing record identifiers. Camping adds
a bounded multi-trip coordinator, relational atomic persistence, shared manual
and scheduled locks, and aggregate-only logs.

## Eligibility and freshness

Camping requests five calendar days from Open-Meteo. A scheduled trip is
eligible only when:

- latitude and longitude are both present and within valid ranges;
- canonical start and end dates are present and ordered;
- deletion is not pending;
- the trip is active, or starts within the next four provider-local calendar
  days; and
- its per-trip refresh state is due.

Completed trips, distant-future trips, missing/invalid dates, missing/invalid
coordinates, and deletion-pending trips are not claimed. There is no current
archive/live-module column, so no display label is treated as archive state.

The provider timezone persisted after a successful response determines the
local date around midnight. A trip with no known provider timezone initially
uses UTC; the first valid response replaces that bootstrap value.

One hourly coordinator selects only due trips:

| Trip state | Successful refresh interval |
| --- | --- |
| Active | 2 hours |
| Starts within 48 hours | 3 hours |
| Other upcoming trip inside five-day horizon | 6 hours |
| Distant future or completed | Not scheduled |

Manual owner/editor refresh bypasses freshness and date-horizon selection, but
still requires valid canonical coordinates, a shared lock, and a ten-minute
cooldown.

## Provider and persistence boundaries

`supabase/functions/_shared/weatherProvider.ts` defines the small provider
contract and the single Open-Meteo adapter. It constructs a deterministic
five-day metric request with `timezone=auto`, validates aligned arrays and
required current fields, converts the provider-local observation time to UTC,
maps WMO codes, and preserves unavailable optional fields as `null`.

The request fingerprint contains only stable provider inputs. The payload
fingerprint contains normalized source data and excludes request time, secrets,
headers, and unstable object ordering. Open-Meteo exposes processing duration,
not a provider-generation timestamp, so `providerGeneratedAt` remains null.

`persist_trip_weather` is the transaction boundary. It verifies the held trip
lock, canonical trip coordinates, normalized schema, timezone, timestamps, and
fingerprints. It then upserts current weather, deliberately replaces that
trip's forecast rows, records synchronization metadata, and releases the lock
in one transaction. An exception rolls back every content and state change.
Older requests cannot overwrite newer weather. An identical payload fingerprint
updates freshness metadata without rewriting content.

## Locking, retries, and stale data

`weather_refresh_state` owns operational state separately from content. Both
scheduled and manual paths transition a trip to `refreshing` with the same
`locked_by`/`locked_at` contract.

Scheduled claims use deterministic oldest-due ordering and
`FOR UPDATE SKIP LOCKED`, with batch size 10, concurrency 2, a nine-second
provider timeout, and a 15-minute stale-lock threshold. A missing worker can be
reclaimed until three automatic attempts are exhausted.

Retryable failures include timeout, network/DNS failure, HTTP 429, HTTP 5xx,
and unexpected transient pipeline/database errors. Backoff is approximately
15 minutes, one hour, then six hours, with up to 60 seconds of database-side
jitter. Provider request rejection and normalized contract mismatch are
operator-action failures.

Failures never delete current or forecast content. State distinguishes:

- `idle`: last successful weather is usable;
- `refreshing`: a refresh is in progress;
- `retry`: stale weather is usable while an automatic retry is scheduled;
- `failed`: stale weather remains usable, or weather is unavailable if no
  successful content exists.

## Authentication and exposure

Scheduled invocation uses a dedicated `WEATHER_REFRESH_CRON_SECRET`; it is not
the prep-feed secret. The secret is stored as an Edge Function secret and in
Vault for the Cron request. The service-role key remains server-only.

The Next.js `/api/refresh-weather` route is POST-only. It validates the signed-in
user with `getUser()`, obtains that session's access token server-side, and
invokes the Edge Function manual mode. The database manual claim permits only
owners and editors through the hardened trip authorization helper. Viewers,
non-members, anonymous users, lock collisions, and cooldown collisions cannot
force a refresh. Coordinates always come from the claimed trip row.

Responses and logs contain aggregate counts, duration, run ID, and sanitized
error category only. They do not contain trip IDs, names, coordinates, provider
URLs/bodies, user identifiers, cookies, authorization headers, or secrets.

## Rollout boundary

After explicit local approval:

1. Apply the exact reviewed migration to hosted Supabase.
2. Deploy `refresh-trip-weather`.
3. Set a distinct Edge Function scheduler secret and matching Vault value.
4. Create exactly one hourly `refresh-due-trip-weather` job.
5. Perform staged scheduled and authenticated manual QA while the Vercel
   weather entry still exists.
6. Confirm an immediate second run skips fresh work, transient failure retains
   valid weather, ineligible trips are skipped, and function/pg_cron/pg_net
   logs are sanitized.
7. Only then remove `/api/refresh-weather` from `vercel.json`, leaving
   `/api/refresh-alerts` unchanged, deploy, and observe a real scheduled cycle.

Rollback disables the Supabase Cron without deleting content. The last valid
weather remains available. Re-adding the Vercel schedule is safe only after its
request contract is corrected.
