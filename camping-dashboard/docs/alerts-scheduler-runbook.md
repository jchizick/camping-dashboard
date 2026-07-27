# Supabase trip alert scheduler runbook

## Planned hosted configuration

- Edge Function: `refresh-trip-alerts`
- Cron name: `refresh-due-trip-alerts`
- Schedule: `0 */3 * * *`
- Batch size: 10 provider jobs
- Provider concurrency: 2
- Provider request timeout: 10 seconds
- Lock timeout: 15 minutes
- Dedicated Edge secret and Vault value: `ALERT_REFRESH_CRON_SECRET`

Create the Cron only after the migration and Edge Function pass hosted staged
QA. Use the established Vault-backed `pg_cron` plus `pg_net` pattern. Keep the
function URL and bearer value in Vault; do not put them in migration SQL.
Confirm exactly one active job by name and schedule. Prep-feed cleanup and
weather refresh must remain unchanged.

## State interpretation

- No `alert_refresh_state` rows: no automated provider configured.
- `idle` with no `last_success_at`: supported but never successfully checked.
- `processing`: a scheduled or manual run owns the provider lock.
- `retry`: prior data is retained and may be stale; an automatic retry is due.
- `failed`: automatic retries are exhausted or operator action is needed.
- `unsupported`: provider configuration cannot run and is not reclaimed.
- `idle` with a recent `last_success_at` and no active rows: provider
  successfully reported an authoritative empty set.

`claim_trip_alerts_manual` is intentionally `SECURITY DEFINER` because the
authenticated caller cannot write service-owned refresh state directly. It
has an empty search path, uses fully qualified objects, is granted only to
`authenticated`, checks `auth.uid()`, and enforces
`app_private.can_edit_trip` before deriving provider context. Supabase may
therefore report the generic signed-in SECURITY DEFINER advisory; review these
controls rather than weakening refresh-state RLS or granting direct writes.

Immediately after deployment, Supabase may also report unused-index INFO
notices for `alerts_active_provider_idx` and `alerts_expiry_idx`. Both indexes
support the new active-provider and expiry lifecycle queries and should remain
while production usage statistics accumulate. Do not remove them based only on
the initial unused-index advisory.

Inspect operational columns only. Avoid selecting alert bodies or trip display
fields during routine diagnosis.

```sql
select trip_id, provider, status, last_attempt_at, last_success_at,
       next_refresh_at, attempt_count, last_error_code
from public.alert_refresh_state
order by next_refresh_at, trip_id, provider;
```

To force one configured provider due:

```sql
update public.alert_refresh_state
set status = 'idle', next_refresh_at = now(), locked_at = null, locked_by = null,
    attempt_count = 0, updated_at = now()
where trip_id = '<approved-trip-id>' and provider = '<approved-provider>';
```

To retry one failed provider, use the same state transition only after its
configuration and error code have been reviewed. To disable an invalid
mapping, clear the matching provider and canonical external-ID fields on the
trip, then invoke `app_private.sync_trip_alert_states` through an approved
service context. Do not infer replacement IDs from labels or coordinates.

Verify provider metadata without selecting trip names or coordinates:

```sql
select id, country_code, region_code, park_alert_provider,
       park_alert_external_id, weather_alert_provider,
       weather_alert_region_code
from public.trips
where id = '<approved-trip-id>';
```

Clear exactly one stale lock only after confirming it is older than the
15-minute worker timeout:

```sql
update public.alert_refresh_state
set status = 'retry', locked_at = null, locked_by = null,
    next_refresh_at = now(), last_error_code = 'worker_interrupted',
    last_error_summary = 'Stale worker lock cleared by an operator.',
    updated_at = now()
where trip_id = '<approved-trip-id>'
  and provider = '<approved-provider>'
  and status = 'processing'
  and locked_at <= now() - interval '15 minutes';
```

An authoritative empty result is an `idle` provider with a recent
`last_success_at` and no active alerts for the same trip/provider. Confirm it
without reading alert text:

```sql
select s.trip_id, s.provider, s.status, s.last_success_at,
       count(a.id) filter (where a.is_active) as active_alerts
from public.alert_refresh_state s
left join public.alerts a
  on a.trip_id = s.trip_id and a.provider = s.provider
where s.trip_id = '<approved-trip-id>'
  and s.provider = '<approved-provider>'
group by s.trip_id, s.provider, s.status, s.last_success_at;
```

Before and after a controlled provider refresh, verify dismissal preservation
by identity and timestamp only:

```sql
select provider, external_id, dismissed_at, acknowledged_at
from public.alerts
where trip_id = '<approved-trip-id>'
  and provider = '<approved-provider>'
  and dismissed_at is not null;
```

## Parser changes and failures

A provider contract failure preserves prior alerts. Confirm the sanitized
error code, reproduce against a sanitized fixture, update the adapter and
fixture, and run the offline suite plus a separate real-provider contract
check. Never add fallback alerts or interpret unrecognized markup as empty.

## Secret rotation and scheduler control

Rotate the Edge secret and Vault value together, update the Cron bearer lookup,
then invoke one aggregate-only scheduler request. Disable the Cron with
`cron.unschedule('refresh-due-trip-alerts')` during incident response. Do not
disable weather or prep-feed jobs.

## Cutover and rollback

After hosted QA:

1. Confirm explicit legacy trip mappings and one successful two-provider run.
2. Confirm deduplication, empty-result behavior, failure retention, cooldown,
   owner/editor authorization, and viewer/non-member denial.
3. Create exactly one `refresh-due-trip-alerts` Cron.
4. Remove only `/api/refresh-alerts` from `vercel.json`, leaving the route as
   the manual endpoint.
5. Deploy and confirm Vercel reports zero scheduled jobs.
6. Confirm the production dashboard distinguishes fresh empty, unsupported,
   processing, and stale failure states.

Rollback by unscheduling the Supabase alert Cron and retaining all provider
configuration and alert history. Re-add the Vercel schedule only if the
hardcoded legacy behavior is intentionally restored and approved.
