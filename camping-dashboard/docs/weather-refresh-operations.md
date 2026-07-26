# Weather refresh operations

## Components

- Edge Function: `refresh-trip-weather`
- Planned Supabase Cron job: `refresh-due-trip-weather`
- Planned cadence: `0 * * * *`
- Provider: Open-Meteo through the normalized adapter
- Forecast horizon: five calendar days
- Batch size: 10 trips
- Provider concurrency: 2
- Provider timeout: 9 seconds per trip
- Stale lock: 15 minutes
- Automatic attempts: 3
- Manual cooldown: 10 minutes

The hosted Cron is intentionally not created by the schema migration. Its URL
and dedicated bearer secret belong in Supabase Vault and Edge Function secrets,
not source control.

## Eligibility and freshness

A trip must have valid paired coordinates, ordered start/end dates, no pending
deletion, and be active or starting within four provider-local calendar days.
Successful active trips are due after two hours, trips starting within 48 hours
after three hours, and other eligible upcoming trips after six hours.
Completed and distant-future trips stop automatic refresh.

`provider_timezone` determines date boundaries after the first success. UTC is
the bootstrap fallback when no provider timezone has been learned.

## Inspect state

Use a service-role or direct database operator session. Do not expose this
operational query to clients.

```sql
select
  status,
  count(*) as trips,
  min(next_refresh_at) as oldest_next_refresh
from public.weather_refresh_state
group by status
order by status;
```

Inspect due/retry/failed rows without selecting trip names or coordinates:

```sql
select
  trip_id,
  status,
  attempt_count,
  last_attempt_at,
  last_success_at,
  next_refresh_at,
  last_error_code,
  provider
from public.weather_refresh_state
where status in ('retry', 'failed')
   or next_refresh_at <= now()
order by next_refresh_at, last_attempt_at nulls first;
```

Treat the trip ID as operationally sensitive and do not copy it into tickets,
logs, or public responses.

## Force or retry one trip

After confirming the exact target:

```sql
update public.weather_refresh_state
set status = 'idle',
    attempt_count = 0,
    next_refresh_at = now(),
    locked_at = null,
    locked_by = null,
    last_error_code = null,
    last_error_summary = null,
    updated_at = now()
where trip_id = '<confirmed-trip-id>';
```

Do not change the trip's dates or coordinates merely to force weather due.
Owners/editors can instead use the dashboard manual refresh, subject to its
lock and cooldown.

## Failure triage

- `provider_timeout`, `provider_network`, `provider_rate_limited`, and
  `provider_unavailable` usually indicate a provider/network incident and are
  retried.
- `provider_rejected` indicates provider-side request rejection.
- `provider_contract` indicates unexpected or malformed normalized data and
  requires adapter/provider investigation.
- `weather_pipeline_error` is deliberately generic. Correlate its run ID with
  sanitized Edge Function and database logs.
- `worker_interrupted` means a lock outlived the worker and exhausted the
  automatic attempt budget.

Never paste raw provider bodies, complete request URLs, coordinates,
authorization headers, or secrets into logs.

## Timestamp verification

The dashboard status uses `weather_refresh_state.source_observed_at`, the
provider observation converted to UTC. `last_success_at` records transaction
completion. `weather_current.updated_at` remains compatible with existing
readers and is set to the source observation time.

Stale `retry` or `failed` data is intentional and remains visible. Do not delete
weather rows to clear an operational error.

## Cron control and secret rotation

To disable scheduling without losing weather, unschedule by job name:

```sql
select cron.unschedule('refresh-due-trip-weather');
```

Before creating or rotating the job, verify there is no duplicate:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'refresh-due-trip-weather';
```

Rotate by generating a new dedicated secret, updating the Edge Function secret,
updating the named Vault value, testing a direct scheduler-authenticated call,
and then observing the next Cron/pg_net result. Do not reuse the prep-feed
cleanup secret and do not store plaintext in migration SQL.

## Rollback

1. Disable `refresh-due-trip-weather`.
2. Leave `weather_current`, `weather_forecast`, and refresh state intact.
3. Continue serving last valid weather as stale.
4. Fix and redeploy the Edge Function or RPC contract.
5. Re-enable one Cron job after a direct authenticated QA run.

The old Vercel weather schedule should be reintroduced only if its missing-trip
request contract is first corrected. `/api/refresh-alerts` is independent and
must remain configured throughout weather rollback.
