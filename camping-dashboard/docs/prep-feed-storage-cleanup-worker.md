# Prep-feed Storage cleanup worker

## Architecture

Image replacement writes the new `prep_feed_items` values and queues the old
canonical Storage path in one database transaction. The request then attempts
immediate idempotent cleanup. A successful immediate cleanup deletes its queue
receipt. A failed immediate cleanup remains available for the background
worker.

The background processor is a Supabase Edge Function scheduled by Supabase
Cron. This platform was selected because:

- Supabase Cron and Edge Functions are available on the hosted project;
- the repository already has two Vercel Cron routes, while no connected Vercel
  plan metadata was available to confirm that an hourly third job is supported;
- Storage, database RPCs, and Edge Function logs remain on one platform;
- the service-role key is supplied by the Edge runtime and never crosses the
  scheduler request;
- a dedicated Cron secret can remain in Vault and Edge Function secrets.

There must be no competing Vercel or external scheduler for this worker.

## Existing Vercel Cron inventory

The cleanup worker does not replace either existing Vercel job. This inventory
is a read-only record of the configuration in `vercel.json` and the route
implementations at the time the worker was introduced.

| Route | Cadence | Purpose | Weather-related | Hardcoded trip | Provider | Required secrets/configuration | Needed after cleanup scheduler |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/refresh-weather` | `0 11 * * *` (daily at 11:00 UTC) | Fetch and persist current conditions plus a five-day forecast for one explicitly selected trip | Yes | No. The route requires `trip_id`; the Vercel Cron request does not supply it, so the scheduled invocation currently returns `400` | Open-Meteo forecast API | `CRON_SECRET` for Vercel; `WEATHER_REFRESH_SECRET` for the legacy manual request; `NEXT_PUBLIC_SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY`; Open-Meteo needs no API key | Yes as an independent weather capability until a separately reviewed replacement passes QA. The current schedule defect is not changed here |
| `/api/refresh-alerts` | `15 11 * * *` (daily at 11:15 UTC) | Replace the selected trip's Ontario Parks backcountry alert and Environment Canada weather-alert rows | Partly: one provider is weather alerts; the other is park operations | Yes. With no query parameter it targets `trip-maple-lake-001`; its providers are also fixed to Algonquin/Ontario | Ontario Parks Algonquin backcountry alerts HTML and Environment Canada `onrm31_e.xml` ATOM feed | `CRON_SECRET` for Vercel; `WEATHER_REFRESH_SECRET` for the legacy manual request; `NEXT_PUBLIC_SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY`; neither provider needs an API key | Yes until the separately reviewed weather/alert replacement passes QA |

Do not edit or remove these jobs as part of prep-feed cleanup. The proposed
multi-trip replacement is documented separately in
`docs/weather-refresh-supabase-cron-follow-up.md`.

## Runtime contract

| Setting | Value |
| --- | --- |
| Scheduler | Supabase Cron (`pg_cron` + `pg_net`) |
| Cadence | Hourly, at minute 0 |
| HTTP timeout | 60 seconds |
| Batch size | 10 jobs |
| Maximum jobs per run | 10 jobs |
| Maximum automatic attempts | 5 |
| Stale-lock timeout | 15 minutes |
| Initial queue delay | 5 minutes, allowing the request's immediate cleanup first |
| Backoff after failures 1–4 | about 5 minutes, 15 minutes, 1 hour, 6 hours |
| Jitter | ±10 percent |

The fifth failed attempt becomes `failed` immediately. A worker interrupted
during its fifth attempt becomes `failed` when its lock expires. Jobs are
ordered by oldest due/locked timestamp, creation timestamp, then UUID.

Successful jobs are deleted. Failed jobs retain only the canonical internal
path, attempt timestamps, a short error code, and a sanitized error summary.
The worker does not store or log public URLs, signed URLs, credentials,
provider responses, user data, captions, or trip names.

## Security

The queue retains RLS with no user-facing policies. `anon` and `authenticated`
have no table or worker-RPC privileges. Only `service_role` can claim or
transition jobs.

The Edge Function is deployed with Supabase JWT verification disabled because
Supabase Cron uses a dedicated random bearer secret rather than a user JWT.
The handler rejects a missing or invalid bearer value with `401`. It accepts no
job IDs or paths in its request body; all work comes from the restricted claim
RPC.

Set the same high-entropy value in:

1. the Edge Function secret `PREP_FEED_CLEANUP_CRON_SECRET`; and
2. the Vault secret `prep_feed_cleanup_cron_secret`.

Never put this value in source control, a URL, a query string, a public
environment variable, or logs.

## Hosted deployment and schedule

Run these steps only after the local implementation checkpoint is approved.

1. Apply the reviewed database migration.
2. Deploy the function without platform JWT verification:

   ```sh
   npx supabase functions deploy process-prep-feed-cleanup \
     --project-ref <project-ref> \
     --no-verify-jwt
   ```

3. Set the Edge Function secret through the Supabase secret manager:

   ```sh
   npx supabase secrets set \
     PREP_FEED_CLEANUP_CRON_SECRET=<random-secret> \
     --project-ref <project-ref>
   ```

4. Enable `pg_cron` and `pg_net` without pinning extension versions:

   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   ```

5. Store the project URL and the same Cron secret in Vault:

   ```sql
   select vault.create_secret(
     'https://<project-ref>.supabase.co',
     'prep_feed_cleanup_project_url'
   );

   select vault.create_secret(
     '<random-secret>',
     'prep_feed_cleanup_cron_secret'
   );
   ```

6. Create exactly one hourly job:

   ```sql
   select cron.schedule(
     'process-prep-feed-storage-cleanup',
     '0 * * * *',
     $schedule$
       select net.http_post(
         url := (
           select decrypted_secret
           from vault.decrypted_secrets
           where name = 'prep_feed_cleanup_project_url'
         ) || '/functions/v1/process-prep-feed-cleanup',
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'Authorization', 'Bearer ' || (
             select decrypted_secret
             from vault.decrypted_secrets
             where name = 'prep_feed_cleanup_cron_secret'
           )
         ),
         body := '{}'::jsonb,
         timeout_milliseconds := 60000
       );
     $schedule$
   );
   ```

`cron.schedule` replaces an existing job with the same name. Confirm there is
only one active row for this job name without selecting its command text:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'process-prep-feed-storage-cleanup';
```

## Observability

Every successful invocation emits one JSON log record containing:

- event name;
- run identifier;
- claimed, completed, retried, failed, and referenced-skip counts;
- duration in milliseconds.

The HTTP response contains the same summary counts and no job details. Obtain
the current queue summary with service-role/operator access:

```sql
select public.get_prep_feed_storage_cleanup_summary();
```

Inspect recent scheduler execution status:

```sql
select jobid, runid, status, start_time, end_time
from cron.job_run_details
where jobid = (
  select jobid
  from cron.job
  where jobname = 'process-prep-feed-storage-cleanup'
)
order by start_time desc
limit 20;
```

Inspect failed jobs without exposing public URLs or unrelated trip data:

```sql
select
  id,
  trip_id,
  storage_path,
  attempt_count,
  last_attempt_at,
  last_error_code,
  last_error_summary,
  failed_at
from public.prep_feed_storage_cleanup_jobs
where status = 'failed'
order by failed_at;
```

### Expected advisor notices

Two local INFO notices are intentional at initial rollout:

- `rls_enabled_no_policy` for
  `public.prep_feed_storage_cleanup_jobs`: the queue is service-only, so RLS
  plus no user policy is the intended boundary. Do not add a permissive policy
  to silence it.
- `unused_index` for `prep_feed_storage_cleanup_due_idx` and, on an empty
  hosted queue, `prep_feed_storage_cleanup_failed_idx`: a clean/reset database
  has little or no operator/worker traffic yet. Retain the indexes because they
  support due-job claiming and failed-job inspection.

## Single-job recovery

Before retrying one failed job:

1. verify the canonical path starts with `trip_id || '/'`;
2. verify no live item references it:

   ```sql
   select exists (
     select 1
     from public.prep_feed_items
     where storage_path = '<canonical-path>'
   );
   ```

3. verify object presence without generating a public or signed URL:

   ```sql
   select exists (
     select 1
     from storage.objects
     where bucket_id = 'prep-feed'
       and name = '<canonical-path>'
   );
   ```

After investigation, reset only that job:

```sql
select public.retry_failed_prep_feed_storage_cleanup_job('<job-id>'::uuid);
```

The RPC rejects retry when the path is live again and intentionally resets the
attempt/error metadata for that one job. To discard a permanently invalid job
after investigation, delete only its exact UUID with service-role/operator
access:

```sql
delete from public.prep_feed_storage_cleanup_jobs
where id = '<job-id>'::uuid
  and status = 'failed';
```

## Removal or rollback

Unschedule before removing the worker:

```sql
select cron.unschedule('process-prep-feed-storage-cleanup');
```

Then remove the Edge Function and its dedicated secrets through Supabase
management tooling. Do not remove `pg_cron`, `pg_net`, or Vault without first
checking whether another hosted feature uses them.
