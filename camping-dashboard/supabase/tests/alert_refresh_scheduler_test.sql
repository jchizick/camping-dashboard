begin;
select plan(34);

select has_table('public', 'alert_refresh_state', 'alerts have provider-scoped refresh state');
select has_pk('public', 'alert_refresh_state', 'alert state has a composite primary key');
select has_index('public', 'alert_refresh_state', 'alert_refresh_state_due_idx', 'due alert work is indexed');
select has_index('public', 'alert_refresh_state', 'alert_refresh_state_stale_lock_idx', 'stale alert locks are indexed');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.alert_refresh_state'::regclass),
  'alert state has RLS enabled'
);
select policies_are(
  'public', 'alert_refresh_state', array['alert_refresh_state_member_select'],
  'alert state exposes only member reads'
);
select isnt(
  has_function_privilege('anon', 'public.claim_due_trip_alerts(text,integer,integer)', 'execute'),
  true, 'anonymous clients cannot claim scheduled alerts'
);
select isnt(
  has_function_privilege('authenticated', 'public.claim_due_trip_alerts(text,integer,integer)', 'execute'),
  true, 'authenticated clients cannot claim scheduled alerts'
);
select ok(
  has_function_privilege('service_role', 'public.claim_due_trip_alerts(text,integer,integer)', 'execute'),
  'service role can claim scheduled alerts'
);
select ok(
  has_function_privilege('authenticated', 'public.claim_trip_alerts_manual(text,text,integer,integer)', 'execute'),
  'authenticated clients can enter the authorization-checked manual claim'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.claim_trip_alerts_manual(text,text,integer,integer)'::regprocedure),
  'manual alert claims centralize authorization in SECURITY DEFINER'
);
select results_eq(
  $$
    select count(*)::bigint
    from pg_proc p
    where p.oid in (
      'public.claim_due_trip_alerts(text,integer,integer)'::regprocedure,
      'public.claim_trip_alerts_manual(text,text,integer,integer)'::regprocedure,
      'public.persist_trip_alerts(text,text,text,jsonb)'::regprocedure,
      'public.retry_trip_alerts(text,text,text,text,text)'::regprocedure,
      'public.fail_trip_alerts(text,text,text,text,text)'::regprocedure
    )
      and p.proconfig = array['search_path=""']
  $$,
  array[5::bigint],
  'all public alert RPCs use an empty search path'
);
select alike(
  pg_get_functiondef('public.claim_due_trip_alerts(text,integer,integer)'::regprocedure),
  '%for update of s skip locked%',
  'scheduled alert claims use FOR UPDATE SKIP LOCKED'
);
select isnt(
  has_table_privilege('authenticated', 'public.alert_refresh_state', 'insert'),
  true, 'authenticated clients cannot write alert state directly'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alert-owner@example.com', '', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alert-viewer@example.com', '', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alert-outsider@example.com', '', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.trips (
  id, name, start_date, end_date, map_style, country_code, region_code,
  park_alert_provider, park_alert_external_id,
  weather_alert_provider, weather_alert_region_code
)
values
  ('alerts-active', 'Active', current_date - 1, current_date + 1, 'openstreetmap',
   'CA', 'ON', 'ontario-parks', 'algonquin/backcountry', 'environment-canada', 'onrm31'),
  ('alerts-upcoming', 'Upcoming', current_date + 7, current_date + 8, 'openstreetmap',
   'CA', 'ON', 'ontario-parks', 'algonquin/backcountry', null, null),
  ('alerts-distant', 'Distant', current_date + 8, current_date + 9, 'openstreetmap',
   'CA', 'ON', 'ontario-parks', 'algonquin/backcountry', null, null),
  ('alerts-past', 'Past', current_date - 4, current_date - 2, 'openstreetmap',
   'CA', 'ON', 'ontario-parks', 'algonquin/backcountry', null, null),
  ('alerts-unsupported', 'Unsupported', current_date, current_date + 1, 'openstreetmap',
   'US', 'NY', null, null, null, null),
  ('alerts-deleting', 'Deleting', current_date, current_date + 1, 'openstreetmap',
   'CA', 'ON', 'ontario-parks', 'algonquin/backcountry', null, null),
  ('alerts-manual', 'Manual', current_date + 30, current_date + 31, 'openstreetmap',
   'CA', 'ON', 'ontario-parks', 'algonquin/backcountry', 'environment-canada', 'onrm31');

update public.trips
set deletion_pending_at = now(), deletion_token = gen_random_uuid()
where id = 'alerts-deleting';

insert into public.trip_members (trip_id, user_id, role)
values
  ('alerts-manual', '00000000-0000-0000-0000-000000000401', 'owner'),
  ('alerts-manual', '00000000-0000-0000-0000-000000000402', 'viewer');

set local role service_role;
create temporary table claimed_alerts on commit drop as
select * from public.claim_due_trip_alerts('alerts-worker', 10, 900);

select is((select count(*)::integer from claimed_alerts), 3, 'only due supported provider jobs are claimed');
select results_eq(
  $$ select trip_id || ':' || provider from claimed_alerts order by 1 $$,
  $$ values
    ('alerts-active:environment-canada'::text),
    ('alerts-active:ontario-parks'::text),
    ('alerts-upcoming:ontario-parks'::text)
  $$,
  'eligibility supports multiple providers and excludes distant, old, deleting, and unconfigured trips'
);
select is(
  (select count(*)::integer from public.claim_due_trip_alerts('overlap', 10, 900)),
  0, 'overlapping scheduled runs cannot reclaim active locks'
);

insert into public.alerts (
  id, trip_id, title, body, severity, source, is_active,
  provider, external_id, category, status, dismissed_at
)
values (
  'prior-alert', 'alerts-active', 'Prior warning', 'Retained body', 'warning',
  'Ontario Parks', true, 'ontario-parks', 'prior', 'closure', 'active', now()
);

select ok(
  public.retry_trip_alerts(
    'alerts-active', 'environment-canada', 'alerts-worker',
    'provider_timeout', 'Alert provider timed out.'
  ),
  'retryable provider failure releases only that provider lock'
);
select is(
  (select body from public.alerts where id = 'prior-alert'),
  'Retained body',
  'provider failure preserves prior valid alerts'
);

select is(
  public.persist_trip_alerts(
    'alerts-active',
    'ontario-parks',
    'alerts-worker',
    jsonb_build_object(
      'provider', 'ontario-parks',
      'fetchedAt', now()::text,
      'fingerprint', repeat('a', 64),
      'complete', true,
      'alerts', jsonb_build_array(jsonb_build_object(
        'provider', 'ontario-parks',
        'externalId', 'new-closure',
        'category', 'closure',
        'severity', 'warning',
        'title', 'New closure',
        'summary', 'Normalized public summary.',
        'details', null,
        'sourceUrl', 'https://www.ontarioparks.ca/park/algonquin/backcountry/alerts',
        'issuedAt', null,
        'effectiveAt', null,
        'expiresAt', null,
        'updatedAt', null,
        'status', 'active',
        'fingerprint', repeat('b', 64)
      ))
    )
  ),
  'updated',
  'atomic persistence accepts a complete normalized provider result'
);
select results_eq(
  $$
    select title, is_active, status, dismissed_at is null
    from public.alerts
    where trip_id = 'alerts-active' and provider = 'ontario-parks'
      and external_id = 'new-closure'
  $$,
  $$ values ('New closure'::text, true, 'active'::text, true) $$,
  'new provider alert is inserted with canonical identity and active lifecycle'
);
select results_eq(
  $$
    select status, attempt_count, locked_at is null
    from public.alert_refresh_state
    where trip_id = 'alerts-active' and provider = 'ontario-parks'
  $$,
  $$ values ('idle'::text, 0, true) $$,
  'successful persistence releases the provider lock'
);

update public.alerts set dismissed_at = now()
where trip_id = 'alerts-active' and provider = 'ontario-parks' and external_id = 'new-closure';
update public.alert_refresh_state
set status = 'processing', locked_at = now(), locked_by = 'update-worker',
    last_attempt_at = now(), attempt_count = 1
where trip_id = 'alerts-active' and provider = 'ontario-parks';

select is(
  public.persist_trip_alerts(
    'alerts-active', 'ontario-parks', 'update-worker',
    jsonb_build_object(
      'provider', 'ontario-parks', 'fetchedAt', now()::text,
      'fingerprint', repeat('c', 64), 'complete', true,
      'alerts', jsonb_build_array(jsonb_build_object(
        'provider', 'ontario-parks', 'externalId', 'new-closure',
        'category', 'closure', 'severity', 'critical', 'title', 'Updated closure',
        'summary', 'Updated.', 'details', null,
        'sourceUrl', 'https://www.ontarioparks.ca/park/algonquin/backcountry/alerts',
        'issuedAt', null, 'effectiveAt', null, 'expiresAt', null, 'updatedAt', null,
        'status', 'updated', 'fingerprint', repeat('d', 64)
      ))
    )
  ),
  'updated',
  'an update reuses the existing provider identity'
);
select ok(
  (select dismissed_at is not null from public.alerts
   where trip_id = 'alerts-active' and provider = 'ontario-parks'
     and external_id = 'new-closure'),
  'provider updates preserve dismissal state'
);

update public.alert_refresh_state
set status = 'processing', locked_at = now(), locked_by = 'empty-worker',
    last_attempt_at = now(), attempt_count = 1
where trip_id = 'alerts-active' and provider = 'ontario-parks';
select is(
  public.persist_trip_alerts(
    'alerts-active', 'ontario-parks', 'empty-worker',
    jsonb_build_object(
      'provider', 'ontario-parks', 'fetchedAt', now()::text,
      'fingerprint', repeat('e', 64), 'complete', true, 'alerts', '[]'::jsonb
    )
  ),
  'updated',
  'an authoritative empty result is accepted'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.alerts
    where trip_id = 'alerts-active' and provider = 'ontario-parks'
      and is_active
  $$,
  array[0::bigint],
  'authoritative empty result resolves missing provider alerts without deleting history'
);

update public.alert_refresh_state
set status = 'processing', locked_at = now(), locked_by = 'stale-worker',
    last_attempt_at = now(), last_success_at = now() + interval '1 minute',
    attempt_count = 1
where trip_id = 'alerts-active' and provider = 'ontario-parks';
select throws_ok(
  $$
    select public.persist_trip_alerts(
      'alerts-active', 'ontario-parks', 'stale-worker',
      jsonb_build_object(
        'provider', 'ontario-parks', 'fetchedAt', (now() - interval '1 hour')::text,
        'fingerprint', repeat('f', 64), 'complete', true, 'alerts', '[]'::jsonb
      )
    )
  $$,
  '22000', 'Stale alert payload rejected',
  'older provider results cannot overwrite newer state'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000401","role":"authenticated"}',
  true
);
select is(
  (select count(*)::integer
   from public.claim_trip_alerts_manual('alerts-manual', 'manual-owner', 600, 900)),
  2,
  'owner manual refresh derives both configured providers from the trip'
);
select is(
  (select count(*)::integer
   from public.claim_trip_alerts_manual('alerts-manual', 'manual-overlap', 600, 900)),
  0,
  'manual refresh shares provider locks and cooldowns with scheduled execution'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000402","role":"authenticated"}',
  true
);
select throws_ok(
  $$ select public.claim_trip_alerts_manual('alerts-manual', 'viewer', 600, 900) $$,
  '42501', 'Trip editor access required',
  'viewers cannot force alert refresh'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000403","role":"authenticated"}',
  true
);
select throws_ok(
  $$ select public.claim_trip_alerts_manual('alerts-manual', 'outsider', 600, 900) $$,
  '42501', 'Trip editor access required',
  'non-members cannot refresh another trip'
);

reset role;
select isnt(
  has_function_privilege('public', 'public.persist_trip_alerts(text,text,text,jsonb)', 'execute'),
  true, 'PUBLIC cannot execute alert persistence'
);
select isnt(
  has_function_privilege('authenticated', 'public.persist_trip_alerts(text,text,text,jsonb)', 'execute'),
  true, 'authenticated clients cannot execute service-only alert persistence'
);
select ok(
  has_function_privilege('service_role', 'public.persist_trip_alerts(text,text,text,jsonb)', 'execute'),
  'service role can execute atomic alert persistence'
);

select * from finish();
rollback;
