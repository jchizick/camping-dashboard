begin;
select plan(30);

select results_eq(
  $$
    select count(*)::bigint
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'prep_feed_storage_cleanup_jobs'
      and column_name in (
        'status',
        'attempt_count',
        'next_attempt_at',
        'locked_at',
        'locked_by',
        'last_attempt_at',
        'last_error_code',
        'last_error_summary',
        'failed_at'
      )
  $$,
  array[9::bigint],
  'the cleanup queue has the complete retry and lock state model'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_constraint
    where conrelid = 'public.prep_feed_storage_cleanup_jobs'::regclass
      and conname = 'prep_feed_cleanup_status_check'
      and contype = 'c'
  $$,
  array[1::bigint],
  'cleanup statuses are constrained'
);

select has_index(
  'public',
  'prep_feed_storage_cleanup_jobs',
  'prep_feed_storage_cleanup_due_idx',
  'due cleanup work has a partial scheduling index'
);

select has_index(
  'public',
  'prep_feed_storage_cleanup_jobs',
  'prep_feed_storage_cleanup_processing_lock_idx',
  'processing locks have a stale-lock recovery index'
);

select has_index(
  'public',
  'prep_feed_storage_cleanup_jobs',
  'prep_feed_storage_cleanup_failed_idx',
  'permanent failures have an operational index'
);

select alike(
  pg_get_functiondef(
    'public.claim_prep_feed_storage_cleanup_jobs(text,integer,integer)'::regprocedure
  ),
  '%for update skip locked%',
  'claiming uses FOR UPDATE SKIP LOCKED'
);

select isnt(
  has_function_privilege(
    'anon',
    'public.claim_prep_feed_storage_cleanup_jobs(text,integer,integer)',
    'execute'
  ),
  true,
  'anonymous clients cannot claim cleanup jobs'
);

select isnt(
  has_function_privilege(
    'authenticated',
    'public.claim_prep_feed_storage_cleanup_jobs(text,integer,integer)',
    'execute'
  ),
  true,
  'authenticated clients cannot claim cleanup jobs'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.claim_prep_feed_storage_cleanup_jobs(text,integer,integer)',
    'execute'
  ),
  'service role can claim cleanup jobs'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.complete_prep_feed_storage_cleanup_job(uuid,text)',
    'execute'
  ),
  'service role can complete cleanup jobs'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.retry_prep_feed_storage_cleanup_job(uuid,text,timestamp with time zone,text,text)',
    'execute'
  ),
  'service role can schedule cleanup retries'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.fail_prep_feed_storage_cleanup_job(uuid,text,text,text)',
    'execute'
  ),
  'service role can retain permanent cleanup failures'
);

select isnt(
  has_function_privilege(
    'authenticated',
    'public.retry_failed_prep_feed_storage_cleanup_job(uuid)',
    'execute'
  ),
  true,
  'authenticated clients cannot manually retry failed jobs'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.retry_failed_prep_feed_storage_cleanup_job(uuid)',
    'execute'
  ),
  'service role has the single-job manual retry path'
);

select isnt(
  has_function_privilege(
    'authenticated',
    'public.get_prep_feed_storage_cleanup_summary()',
    'execute'
  ),
  true,
  'authenticated clients cannot inspect operational queue counts'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_proc p
    where p.oid in (
      'public.claim_prep_feed_storage_cleanup_jobs(text,integer,integer)'::regprocedure,
      'public.complete_prep_feed_storage_cleanup_job(uuid,text)'::regprocedure,
      'public.retry_prep_feed_storage_cleanup_job(uuid,text,timestamp with time zone,text,text)'::regprocedure,
      'public.fail_prep_feed_storage_cleanup_job(uuid,text,text,text)'::regprocedure,
      'public.retry_failed_prep_feed_storage_cleanup_job(uuid)'::regprocedure,
      'public.get_prep_feed_storage_cleanup_summary()'::regprocedure
    )
      and not p.prosecdef
      and p.proconfig = array['search_path=""']
  $$,
  array[6::bigint],
  'worker RPCs are invoker-rights functions with an empty search path'
);

insert into public.trips (id, name, map_style)
values ('cleanup-worker-test-trip', 'Cleanup Worker Test', 'openstreetmap');

insert into public.prep_feed_storage_cleanup_jobs (
  id,
  trip_id,
  storage_path
)
values (
  '10000000-0000-0000-0000-000000000007',
  'cleanup-worker-test-trip',
  'cleanup-worker-test-trip/user/grace-period.jpg'
);

select ok(
  (
    select next_attempt_at - created_at
    from public.prep_feed_storage_cleanup_jobs
    where id = '10000000-0000-0000-0000-000000000007'
  ) between interval '4 minutes 59 seconds' and interval '5 minutes 1 second',
  'new jobs wait five minutes before background claiming'
);

insert into public.prep_feed_storage_cleanup_jobs (
  id,
  trip_id,
  storage_path,
  created_at,
  next_attempt_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'cleanup-worker-test-trip',
    'cleanup-worker-test-trip/user/due.jpg',
    now() - interval '2 hours',
    now() - interval '1 hour'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'cleanup-worker-test-trip',
    'cleanup-worker-test-trip/user/future.jpg',
    now() - interval '1 hour',
    now() + interval '1 hour'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'cleanup-worker-test-trip',
    'cleanup-worker-test-trip/user/stale.jpg',
    now() - interval '90 minutes',
    now() - interval '1 hour'
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'cleanup-worker-test-trip',
    'cleanup-worker-test-trip/user/active.jpg',
    now() - interval '80 minutes',
    now() - interval '1 hour'
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    'cleanup-worker-test-trip',
    'cleanup-worker-test-trip/user/exhausted.jpg',
    now() - interval '70 minutes',
    now() - interval '1 hour'
  );

update public.prep_feed_storage_cleanup_jobs
set status = 'processing',
    attempt_count = 1,
    locked_at = now() - interval '20 minutes',
    locked_by = 'lost-worker',
    last_attempt_at = now() - interval '20 minutes'
where id = '10000000-0000-0000-0000-000000000003';

update public.prep_feed_storage_cleanup_jobs
set status = 'processing',
    attempt_count = 1,
    locked_at = now(),
    locked_by = 'active-worker',
    last_attempt_at = now()
where id = '10000000-0000-0000-0000-000000000004';

update public.prep_feed_storage_cleanup_jobs
set status = 'processing',
    attempt_count = 5,
    locked_at = now() - interval '20 minutes',
    locked_by = 'exhausted-worker',
    last_attempt_at = now() - interval '20 minutes'
where id = '10000000-0000-0000-0000-000000000005';

set local role service_role;

create temporary table claimed_cleanup_jobs on commit drop as
select *
from public.claim_prep_feed_storage_cleanup_jobs('worker-a', 2, 60);

select is(
  (select count(*)::integer from claimed_cleanup_jobs),
  2,
  'a claim returns only the configured batch size'
);

select results_eq(
  $$
    select id
    from claimed_cleanup_jobs
    order by id
  $$,
  $$
    values
      ('10000000-0000-0000-0000-000000000001'::uuid),
      ('10000000-0000-0000-0000-000000000003'::uuid)
  $$,
  'claims include due pending work and a stale processing lock'
);

select results_eq(
  $$
    select attempt_count
    from public.prep_feed_storage_cleanup_jobs
    where id in (
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000003'
    )
    order by id
  $$,
  array[1, 2],
  'claiming increments attempt counts atomically'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.prep_feed_storage_cleanup_jobs
    where id in (
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000003'
    )
      and status = 'processing'
      and locked_by = 'worker-a'
      and locked_at is not null
  $$,
  array[2::bigint],
  'claimed jobs carry the new worker lock'
);

select is(
  (
    select count(*)::integer
    from public.claim_prep_feed_storage_cleanup_jobs('worker-b', 10, 60)
  ),
  0,
  'a duplicate invocation cannot reclaim active jobs or future work'
);

select is(
  (
    select status
    from public.prep_feed_storage_cleanup_jobs
    where id = '10000000-0000-0000-0000-000000000005'
  ),
  'failed',
  'an exhausted stale lock becomes a permanent failure'
);

select ok(
  public.retry_prep_feed_storage_cleanup_job(
    '10000000-0000-0000-0000-000000000001',
    'worker-a',
    now() + interval '5 minutes',
    'storage_503',
    'Temporary Storage failure.'
  ),
  'a claimed transient failure can be scheduled for retry'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.prep_feed_storage_cleanup_jobs
    where id = '10000000-0000-0000-0000-000000000001'
      and status = 'retry'
      and next_attempt_at > now()
      and locked_at is null
      and locked_by is null
      and last_error_code = 'storage_503'
  $$,
  array[1::bigint],
  'retry transitions preserve sanitized diagnostics and release the lock'
);

select ok(
  public.fail_prep_feed_storage_cleanup_job(
    '10000000-0000-0000-0000-000000000003',
    'worker-a',
    'invalid_storage_path',
    'Canonical validation failed.'
  ),
  'a poisoned claimed job can be retained for review'
);

insert into public.prep_feed_items (
  id,
  trip_id,
  image_url,
  storage_path,
  caption
)
values (
  '20000000-0000-0000-0000-000000000001',
  'cleanup-worker-test-trip',
  null,
  'cleanup-worker-test-trip/user/stale.jpg',
  'Live reference'
);

select throws_ok(
  $$
    select public.retry_failed_prep_feed_storage_cleanup_job(
      '10000000-0000-0000-0000-000000000003'
    )
  $$,
  '23514',
  'Cleanup job path is referenced by a live prep-feed item',
  'manual retry refuses a path that became live again'
);

delete from public.prep_feed_items
where id = '20000000-0000-0000-0000-000000000001';

select ok(
  public.retry_failed_prep_feed_storage_cleanup_job(
    '10000000-0000-0000-0000-000000000003'
  ),
  'manual retry resets one investigated failed job'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.prep_feed_storage_cleanup_jobs
    where id = '10000000-0000-0000-0000-000000000003'
      and status = 'retry'
      and attempt_count = 0
      and failed_at is null
      and last_error_code is null
  $$,
  array[1::bigint],
  'manual retry intentionally clears failure metadata'
);

update public.prep_feed_storage_cleanup_jobs
set next_attempt_at = now() + interval '1 day'
where id = '10000000-0000-0000-0000-000000000003';

insert into public.prep_feed_storage_cleanup_jobs (
  id,
  trip_id,
  storage_path,
  created_at,
  next_attempt_at
)
values (
  '10000000-0000-0000-0000-000000000006',
  'cleanup-worker-test-trip',
  'cleanup-worker-test-trip/user/complete.jpg',
  now() - interval '3 hours',
  now() - interval '2 hours'
);

select public.claim_prep_feed_storage_cleanup_jobs('worker-complete', 1, 60);

select ok(
  public.complete_prep_feed_storage_cleanup_job(
    '10000000-0000-0000-0000-000000000006',
    'worker-complete'
  ),
  'successful cleanup deletes the queue receipt'
);

select * from finish();
rollback;
