# Alert scheduler architecture

Status: locally implemented; hosted migration, Edge deployment, scheduler
configuration, Vercel cutover, and production QA are intentionally pending
review.

The legacy `/api/refresh-alerts` schedule is the final Vercel Cron. It runs
daily at `15 11 * * *`, assumes `trip-maple-lake-001`, Algonquin Park,
Ontario, and Canada, and directly scrapes Ontario Parks HTML and the
Environment Canada `onrm31` Atom feed. It deletes rows by source before
inserting replacements and fabricates informational rows after provider
failure. The dashboard previously kept dismissal only in component memory and
could not distinguish a confirmed empty result from unsupported, failed, or
never-run providers.

The replacement uses one Supabase coordinator and explicit nullable trip
coverage:

- `country_code` and `region_code`
- `park_alert_provider` plus `park_alert_external_id`
- `weather_alert_provider` plus `weather_alert_region_code`

Display labels and coordinates do not imply coverage. The legacy trip is
guardedly mapped to `CA`, `ON`, `ontario-parks`,
`algonquin/backcountry`, `environment-canada`, and `onrm31`. All other trips
remain valid without an automated source.

Initial adapters are deliberately limited to Ontario Parks HTML and
Environment Canada Atom. They emit normalized provider identity, stable
external identity, severity, lifecycle, attribution, timestamps, and
deterministic fingerprints. They never emit fake all-clear alerts. Unrecognized
provider markup is an operational parser failure, not an authoritative empty
result.

Scheduled eligibility requires valid dates, no pending deletion, at least one
configured provider, a due provider state, and a local calendar date from
seven days before the trip through one day after it ends. Distant and old
trips are not continuously polled. A provider is refreshed every six hours
after success; the coordinator is intended to run every three hours so due
work is picked up promptly without scraping hourly.

Identity is `(trip_id, provider, external_id)`. Provider updates reuse a row,
provider and trip boundaries cannot overwrite each other, and dismissal
metadata survives upserts. Complete authoritative results resolve missing
active alerts but retain history. Request, parser, normalization, or database
failure leaves prior alerts intact. Empty complete results resolve prior
provider rows without creating an all-clear row.

`alert_refresh_state` holds one lock and retry lifecycle per trip/provider.
Claims use deterministic oldest-due ordering with `FOR UPDATE SKIP LOCKED`.
Locks expire after 15 minutes. Provider work is processed in batches of 10
with concurrency 2. Retry delays are approximately 30 minutes, two hours, and
eight hours with bounded jitter; the third failure pauses in `failed`.
Unsupported configuration is not repeatedly claimed.

The `refresh-trip-alerts` Edge Function accepts POST only. Scheduled mode uses
the dedicated `ALERT_REFRESH_CRON_SECRET`; manual mode verifies the caller JWT
and invokes an owner/editor-only claim RPC. Public responses and structured
logs contain only run IDs, counts, durations, and sanitized error codes. Raw
HTML/XML, alert descriptions, full provider URLs, trip/park names,
coordinates, user identities, tokens, and secrets are excluded.

`/api/refresh-alerts` is retained as a private, no-store authenticated manual
proxy. It accepts only a trip ID, derives coverage in the database, shares
locks and a ten-minute cooldown with scheduled work, and maps Edge failures to
sanitized application errors.

The Vercel schedule remains in place until hosted staged QA is approved. The
weather and prep-feed schedulers are unchanged.
