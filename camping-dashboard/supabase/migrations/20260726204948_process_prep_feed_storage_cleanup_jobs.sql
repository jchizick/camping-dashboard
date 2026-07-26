-- Background processing contract for prep-feed Storage cleanup jobs.
--
-- The queue remains service-only. Scheduled execution is provided by a
-- separately deployed Edge Function and Supabase Cron; scheduler credentials
-- live in Vault/Edge Function secrets and are never stored in this migration.

do $guard$
declare
  v_invalid_job uuid;
begin
  select j.id
  into v_invalid_job
  from public.prep_feed_storage_cleanup_jobs j
  where j.completed_at is null
    and (
      left(j.storage_path, length(j.trip_id) + 1) <> j.trip_id || '/'
      or length(j.storage_path) > 1024
      or position(chr(92) in j.storage_path) > 0
      or j.storage_path like '%..%'
      or j.storage_path like '/%'
      or j.storage_path like '%//%'
    )
  limit 1;

  if v_invalid_job is not null then
    raise exception
      'Cleanup worker migration aborted: open job % has an invalid canonical path',
      v_invalid_job;
  end if;
end
$guard$;

alter table public.prep_feed_storage_cleanup_jobs
  add column status text not null default 'pending',
  add column attempt_count integer not null default 0,
  add column next_attempt_at timestamp with time zone not null
    default (now() + interval '5 minutes'),
  add column locked_at timestamp with time zone,
  add column locked_by text,
  add column last_attempt_at timestamp with time zone,
  add column last_error_code text,
  add column last_error_summary text,
  add column failed_at timestamp with time zone,
  add constraint prep_feed_cleanup_status_check
    check (status in ('pending', 'processing', 'retry', 'failed')),
  add constraint prep_feed_cleanup_attempt_count_check
    check (attempt_count between 0 and 5),
  add constraint prep_feed_cleanup_lock_state_check
    check (
      (
        status = 'processing'
        and locked_at is not null
        and locked_by is not null
        and last_attempt_at is not null
      )
      or (
        status <> 'processing'
        and locked_at is null
        and locked_by is null
      )
    ),
  add constraint prep_feed_cleanup_failure_state_check
    check (
      (status = 'failed' and failed_at is not null)
      or (status <> 'failed' and failed_at is null)
    ),
  add constraint prep_feed_cleanup_worker_id_length_check
    check (locked_by is null or length(locked_by) between 1 and 128),
  add constraint prep_feed_cleanup_error_code_length_check
    check (last_error_code is null or length(last_error_code) between 1 and 64),
  add constraint prep_feed_cleanup_error_summary_length_check
    check (last_error_summary is null or length(last_error_summary) between 1 and 500);

create index prep_feed_storage_cleanup_due_idx
  on public.prep_feed_storage_cleanup_jobs (
    next_attempt_at,
    created_at,
    id
  )
  where completed_at is null
    and status in ('pending', 'retry');

create index prep_feed_storage_cleanup_processing_lock_idx
  on public.prep_feed_storage_cleanup_jobs (locked_at)
  where completed_at is null
    and status = 'processing';

create index prep_feed_storage_cleanup_failed_idx
  on public.prep_feed_storage_cleanup_jobs (failed_at)
  where completed_at is null
    and status = 'failed';

create or replace function public.claim_prep_feed_storage_cleanup_jobs(
  p_worker_id text,
  p_batch_size integer default 10,
  p_stale_after_seconds integer default 900
)
returns table (
  id uuid,
  trip_id text,
  storage_path text,
  attempt_count integer
)
language plpgsql
set search_path = ''
as $function$
begin
  if p_worker_id is null
    or length(p_worker_id) not between 1 and 128
    or p_batch_size not between 1 and 50
    or p_stale_after_seconds not between 1 and 3600
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid cleanup worker claim arguments';
  end if;

  -- A worker that disappeared during its fifth attempt has exhausted the
  -- automatic retry budget. Keep the row for operator review.
  update public.prep_feed_storage_cleanup_jobs j
  set status = 'failed',
      locked_at = null,
      locked_by = null,
      failed_at = now(),
      last_error_code = 'worker_interrupted',
      last_error_summary = 'Worker lock expired after the maximum attempt count.'
  where j.completed_at is null
    and j.status = 'processing'
    and j.attempt_count >= 5
    and j.locked_at <= now() - make_interval(secs => p_stale_after_seconds);

  return query
  with due as (
    select j.id
    from public.prep_feed_storage_cleanup_jobs j
    where j.completed_at is null
      and j.attempt_count < 5
      and (
        (
          j.status in ('pending', 'retry')
          and j.next_attempt_at <= now()
        )
        or (
          j.status = 'processing'
          and j.locked_at <= now() - make_interval(secs => p_stale_after_seconds)
        )
      )
    order by
      case
        when j.status = 'processing' then j.locked_at
        else j.next_attempt_at
      end,
      j.created_at,
      j.id
    for update skip locked
    limit p_batch_size
  )
  update public.prep_feed_storage_cleanup_jobs j
  set status = 'processing',
      attempt_count = j.attempt_count + 1,
      locked_at = now(),
      locked_by = p_worker_id,
      last_attempt_at = now(),
      failed_at = null
  from due
  where j.id = due.id
  returning j.id, j.trip_id, j.storage_path, j.attempt_count;
end
$function$;

create or replace function public.complete_prep_feed_storage_cleanup_job(
  p_job_id uuid,
  p_worker_id text
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_deleted boolean;
begin
  delete from public.prep_feed_storage_cleanup_jobs j
  where j.id = p_job_id
    and j.completed_at is null
    and j.status = 'processing'
    and j.locked_by = p_worker_id
  returning true into v_deleted;

  return coalesce(v_deleted, false);
end
$function$;

create or replace function public.retry_prep_feed_storage_cleanup_job(
  p_job_id uuid,
  p_worker_id text,
  p_next_attempt_at timestamp with time zone,
  p_error_code text,
  p_error_summary text
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_updated boolean;
begin
  if p_next_attempt_at <= now()
    or p_error_code is null
    or length(p_error_code) not between 1 and 64
    or p_error_summary is null
    or length(p_error_summary) not between 1 and 500
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid cleanup retry arguments';
  end if;

  update public.prep_feed_storage_cleanup_jobs j
  set status = 'retry',
      next_attempt_at = p_next_attempt_at,
      locked_at = null,
      locked_by = null,
      failed_at = null,
      last_error_code = p_error_code,
      last_error_summary = p_error_summary
  where j.id = p_job_id
    and j.completed_at is null
    and j.status = 'processing'
    and j.locked_by = p_worker_id
    and j.attempt_count < 5
  returning true into v_updated;

  return coalesce(v_updated, false);
end
$function$;

create or replace function public.fail_prep_feed_storage_cleanup_job(
  p_job_id uuid,
  p_worker_id text,
  p_error_code text,
  p_error_summary text
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_updated boolean;
begin
  if p_error_code is null
    or length(p_error_code) not between 1 and 64
    or p_error_summary is null
    or length(p_error_summary) not between 1 and 500
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid cleanup failure arguments';
  end if;

  update public.prep_feed_storage_cleanup_jobs j
  set status = 'failed',
      locked_at = null,
      locked_by = null,
      failed_at = now(),
      last_error_code = p_error_code,
      last_error_summary = p_error_summary
  where j.id = p_job_id
    and j.completed_at is null
    and j.status = 'processing'
    and j.locked_by = p_worker_id
  returning true into v_updated;

  return coalesce(v_updated, false);
end
$function$;

create or replace function public.retry_failed_prep_feed_storage_cleanup_job(
  p_job_id uuid
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_updated boolean;
begin
  if exists (
    select 1
    from public.prep_feed_storage_cleanup_jobs j
    join public.prep_feed_items p
      on p.storage_path = j.storage_path
    where j.id = p_job_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'Cleanup job path is referenced by a live prep-feed item';
  end if;

  update public.prep_feed_storage_cleanup_jobs j
  set status = 'retry',
      attempt_count = 0,
      next_attempt_at = now(),
      locked_at = null,
      locked_by = null,
      last_attempt_at = null,
      last_error_code = null,
      last_error_summary = null,
      failed_at = null
  where j.id = p_job_id
    and j.completed_at is null
    and j.status = 'failed'
  returning true into v_updated;

  return coalesce(v_updated, false);
end
$function$;

create or replace function public.get_prep_feed_storage_cleanup_summary()
returns jsonb
language sql
stable
set search_path = ''
as $function$
  select jsonb_build_object(
    'pending', count(*) filter (where j.status = 'pending'),
    'retry', count(*) filter (where j.status = 'retry'),
    'processing', count(*) filter (where j.status = 'processing'),
    'failed', count(*) filter (where j.status = 'failed'),
    'oldest_due_at', min(j.next_attempt_at) filter (
      where j.status in ('pending', 'retry')
    )
  )
  from public.prep_feed_storage_cleanup_jobs j
  where j.completed_at is null
$function$;

revoke all on function public.claim_prep_feed_storage_cleanup_jobs(
  text,
  integer,
  integer
) from public, anon, authenticated;
revoke all on function public.complete_prep_feed_storage_cleanup_job(
  uuid,
  text
) from public, anon, authenticated;
revoke all on function public.retry_prep_feed_storage_cleanup_job(
  uuid,
  text,
  timestamp with time zone,
  text,
  text
) from public, anon, authenticated;
revoke all on function public.fail_prep_feed_storage_cleanup_job(
  uuid,
  text,
  text,
  text
) from public, anon, authenticated;
revoke all on function public.retry_failed_prep_feed_storage_cleanup_job(
  uuid
) from public, anon, authenticated;
revoke all on function public.get_prep_feed_storage_cleanup_summary()
  from public, anon, authenticated;

grant execute on function public.claim_prep_feed_storage_cleanup_jobs(
  text,
  integer,
  integer
) to service_role;
grant execute on function public.complete_prep_feed_storage_cleanup_job(
  uuid,
  text
) to service_role;
grant execute on function public.retry_prep_feed_storage_cleanup_job(
  uuid,
  text,
  timestamp with time zone,
  text,
  text
) to service_role;
grant execute on function public.fail_prep_feed_storage_cleanup_job(
  uuid,
  text,
  text,
  text
) to service_role;
grant execute on function public.retry_failed_prep_feed_storage_cleanup_job(
  uuid
) to service_role;
grant execute on function public.get_prep_feed_storage_cleanup_summary()
  to service_role;

revoke all on table public.prep_feed_storage_cleanup_jobs
  from public, anon, authenticated;
revoke all on table public.prep_feed_storage_cleanup_jobs
  from service_role;
grant select, insert, update, delete
  on table public.prep_feed_storage_cleanup_jobs
  to service_role;
