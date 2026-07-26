begin;
select plan(50);

select has_table(
  'public',
  'weather_refresh_state',
  'weather refresh state has a dedicated table'
);
select col_is_pk(
  'public',
  'weather_refresh_state',
  'trip_id',
  'weather state is singleton-scoped by trip'
);
select results_eq(
  $$
    select con.confdeltype::text
    from pg_constraint con
    where con.conname = 'weather_refresh_state_trip_id_fkey'
  $$,
  array['c'::text],
  'weather state cascades when a trip is deleted'
);
select has_index(
  'public',
  'weather_refresh_state',
  'weather_refresh_state_due_idx',
  'due work has a partial ordering index'
);
select has_index(
  'public',
  'weather_refresh_state',
  'weather_refresh_state_stale_lock_idx',
  'refreshing work has a stale-lock index'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.weather_refresh_state'::regclass),
  'weather refresh state has RLS enabled'
);
select policies_are(
  'public',
  'weather_refresh_state',
  array['weather_refresh_state_member_select'],
  'weather state has only the member read policy'
);
select isnt(
  has_function_privilege('anon', 'public.claim_due_trip_weather(text,integer,integer)', 'execute'),
  true,
  'anonymous clients cannot claim scheduled weather'
);
select isnt(
  has_function_privilege('authenticated', 'public.claim_due_trip_weather(text,integer,integer)', 'execute'),
  true,
  'authenticated clients cannot claim scheduled weather'
);
select ok(
  has_function_privilege('service_role', 'public.claim_due_trip_weather(text,integer,integer)', 'execute'),
  'service role can claim scheduled weather'
);
select isnt(
  has_function_privilege('anon', 'public.claim_trip_weather_manual(text,text,integer,integer)', 'execute'),
  true,
  'anonymous clients cannot invoke manual weather claims'
);
select ok(
  has_function_privilege('authenticated', 'public.claim_trip_weather_manual(text,text,integer,integer)', 'execute'),
  'authenticated clients can enter the authorization-checked manual claim'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.claim_trip_weather_manual(text,text,integer,integer)'::regprocedure),
  'manual claim is SECURITY DEFINER so authorization is centralized'
);
select results_eq(
  $$
    select count(*)::bigint
    from pg_proc p
    where p.oid in (
      'public.claim_due_trip_weather(text,integer,integer)'::regprocedure,
      'public.claim_trip_weather_manual(text,text,integer,integer)'::regprocedure,
      'public.persist_trip_weather(text,text,jsonb)'::regprocedure,
      'public.retry_trip_weather(text,text,text,text)'::regprocedure,
      'public.fail_trip_weather(text,text,text,text)'::regprocedure
    )
      and p.proconfig = array['search_path=""']
  $$,
  array[5::bigint],
  'all public weather RPCs use an empty search path'
);
select alike(
  pg_get_functiondef('public.claim_due_trip_weather(text,integer,integer)'::regprocedure),
  '%for update of s skip locked%',
  'scheduled claims use FOR UPDATE SKIP LOCKED'
);
select results_eq(
  $$
    select count(*)::bigint
    from pg_constraint
    where conrelid = 'public.weather_refresh_state'::regclass
      and conname = 'weather_refresh_state_status_check'
  $$,
  array[1::bigint],
  'weather refresh statuses are constrained'
);
select isnt(
  has_table_privilege('authenticated', 'public.weather_refresh_state', 'insert'),
  true,
  'authenticated clients cannot write operational weather state directly'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'weather-owner@example.com', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'weather-viewer@example.com', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'weather-outsider@example.com', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.trips (
  id, name, start_date, end_date, campsite_latitude, campsite_longitude, map_style
)
values
  ('weather-active', 'Active', current_date - 1, current_date + 1, 45.1, -78.1, 'openstreetmap'),
  ('weather-upcoming', 'Upcoming', current_date + 3, current_date + 4, 45.2, -78.2, 'openstreetmap'),
  ('weather-distant', 'Distant', current_date + 8, current_date + 9, 45.3, -78.3, 'openstreetmap'),
  ('weather-past', 'Past', current_date - 9, current_date - 8, 45.4, -78.4, 'openstreetmap'),
  ('weather-missing-coordinates', 'Missing coordinates', current_date, current_date + 1, null, null, 'openstreetmap'),
  ('weather-deleting', 'Deleting', current_date, current_date + 1, 45.5, -78.5, 'openstreetmap'),
  ('weather-fresh', 'Fresh', current_date, current_date + 1, 45.6, -78.6, 'openstreetmap'),
  ('weather-manual', 'Manual', current_date + 30, current_date + 31, 45.7, -78.7, 'openstreetmap'),
  ('weather-editor', 'Editor', current_date + 30, current_date + 31, 45.8, -78.8, 'openstreetmap');

update public.trips
set deletion_pending_at = now(),
    deletion_token = gen_random_uuid()
where id = 'weather-deleting';

insert into public.trip_members (trip_id, user_id, role)
values
  ('weather-manual', '00000000-0000-0000-0000-000000000301', 'owner'),
  ('weather-manual', '00000000-0000-0000-0000-000000000302', 'viewer'),
  ('weather-editor', '00000000-0000-0000-0000-000000000301', 'editor');

insert into public.weather_refresh_state (trip_id, next_refresh_at)
select id, now() - interval '1 hour'
from public.trips
where id like 'weather-%'
on conflict (trip_id) do update set next_refresh_at = excluded.next_refresh_at;

update public.weather_refresh_state
set next_refresh_at = now() + interval '1 hour'
where trip_id = 'weather-fresh';

set local role service_role;

create temporary table claimed_weather on commit drop as
select * from public.claim_due_trip_weather('scheduled-one', 10, 900);

select is(
  (select count(*)::integer from claimed_weather),
  2,
  'only active and forecast-horizon due trips are claimed'
);
select results_eq(
  $$ select trip_id from claimed_weather order by trip_id $$,
  $$ values ('weather-active'::text), ('weather-upcoming'::text) $$,
  'eligibility excludes distant, completed, incomplete, deleting, and fresh trips'
);
select results_eq(
  $$
    select trip_id
    from public.weather_refresh_state
    where trip_id in (
      'weather-distant',
      'weather-past',
      'weather-missing-coordinates',
      'weather-deleting',
      'weather-fresh'
    )
      and status = 'idle'
    order by trip_id
  $$,
  $$
    values
      ('weather-deleting'::text),
      ('weather-distant'::text),
      ('weather-fresh'::text),
      ('weather-missing-coordinates'::text),
      ('weather-past'::text)
  $$,
  'ineligible trips remain unmodified'
);
select results_eq(
  $$
    select latitude, longitude
    from claimed_weather
    where trip_id = 'weather-active'
  $$,
  $$ values (45.1::double precision, -78.1::double precision) $$,
  'claims derive coordinates from the canonical trip row'
);
select is(
  (select count(*)::integer from public.claim_due_trip_weather('scheduled-two', 10, 900)),
  0,
  'overlapping coordinator runs cannot reclaim active locks'
);
select results_eq(
  $$
    select attempt_count
    from public.weather_refresh_state
    where trip_id in ('weather-active', 'weather-upcoming')
    order by trip_id
  $$,
  array[1, 1],
  'claiming increments attempt counts atomically'
);

insert into public.weather_current (
  trip_id, temperature_c, condition_label, icon, updated_at
)
values ('weather-active', 9, 'Old weather', 'cloud', now() - interval '1 day');

select ok(
  public.retry_trip_weather(
    'weather-active',
    'scheduled-one',
    'provider_timeout',
    'Weather provider timed out.'
  ),
  'retryable failures release one claimed trip'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.weather_refresh_state
    where trip_id = 'weather-active'
      and status = 'retry'
      and locked_at is null
      and next_refresh_at between now() + interval '15 minutes'
        and now() + interval '16 minutes 5 seconds'
  $$,
  array[1::bigint],
  'first retry uses the bounded fifteen-minute backoff with jitter'
);
select is(
  (select temperature_c from public.weather_current where trip_id = 'weather-active'),
  9::double precision,
  'a failed provider attempt preserves last valid current weather'
);

select is(
  public.persist_trip_weather(
    'weather-upcoming',
    'scheduled-one',
    jsonb_build_object(
      'provider', 'open-meteo',
      'requestedAt', now()::text,
      'providerGeneratedAt', null,
      'sourceObservedAt', now()::text,
      'timezone', 'America/Toronto',
      'utcOffsetSeconds', -14400,
      'requestFingerprint', repeat('a', 64),
      'fingerprint', repeat('b', 64),
      'current', jsonb_build_object(
        'temperatureC', 21.5,
        'weatherCode', 2,
        'conditionLabel', 'Partly Cloudy',
        'icon', 'cloud-sun',
        'windKph', null,
        'humidity', null,
        'rainChance', null,
        'sunriseTime', '05:57',
        'sunsetTime', '20:46',
        'visibilityMeters', null
      ),
      'daily', jsonb_build_array(
        jsonb_build_object(
          'forecast_date', current_date::text,
          'high_c', 23.0,
          'low_c', 12.0,
          'condition_label', 'Partly Cloudy',
          'rain_chance', null,
          'wind_kph', null,
          'icon', 'cloud-sun'
        ),
        jsonb_build_object(
          'forecast_date', (current_date + 1)::text,
          'high_c', null,
          'low_c', 11.0,
          'condition_label', 'Rain',
          'rain_chance', 70,
          'wind_kph', 20,
          'icon', 'cloud-rain'
        ),
        jsonb_build_object(
          'forecast_date', (current_date + 2)::text,
          'high_c', 20,
          'low_c', 10,
          'condition_label', 'Clear Sky',
          'rain_chance', 5,
          'wind_kph', 10,
          'icon', 'sun'
        ),
        jsonb_build_object(
          'forecast_date', (current_date + 3)::text,
          'high_c', 19,
          'low_c', 9,
          'condition_label', 'Overcast',
          'rain_chance', 20,
          'wind_kph', 12,
          'icon', 'cloud'
        ),
        jsonb_build_object(
          'forecast_date', (current_date + 4)::text,
          'high_c', 18,
          'low_c', 8,
          'condition_label', 'Rain Showers',
          'rain_chance', 60,
          'wind_kph', 25,
          'icon', 'cloud-rain'
        )
      )
    )
  ),
  'updated',
  'persistence accepts one validated normalized payload'
);
select results_eq(
  $$
    select temperature_c, wind_kph
    from public.weather_current
    where trip_id = 'weather-upcoming'
  $$,
  $$ values (21.5::double precision, null::double precision) $$,
  'current weather persists required values and preserves optional nulls'
);
select is(
  (select count(*)::integer from public.weather_forecast where trip_id = 'weather-upcoming'),
  5,
  'five-day forecast replacement is committed with current weather'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.weather_refresh_state
    where trip_id = 'weather-upcoming'
      and status = 'idle'
      and attempt_count = 0
      and locked_at is null
      and provider = 'open-meteo'
      and provider_timezone = 'America/Toronto'
      and payload_fingerprint = repeat('b', 64)
  $$,
  array[1::bigint],
  'success records provider, timezone, fingerprint, and releases the lock'
);
select is(
  (select count(*)::integer from public.claim_due_trip_weather('scheduled-three', 10, 900)),
  0,
  'a successful upcoming trip is not immediately due again'
);

insert into public.trips (
  id, name, start_date, end_date, campsite_latitude, campsite_longitude, map_style
)
values (
  'weather-stale-lock',
  'Stale lock',
  current_date,
  current_date + 1,
  45.9,
  -78.9,
  'openstreetmap'
);
insert into public.weather_refresh_state (
  trip_id,
  status,
  attempt_count,
  next_refresh_at,
  locked_at,
  locked_by,
  last_attempt_at
)
values (
  'weather-stale-lock',
  'refreshing',
  1,
  now() - interval '1 hour',
  now() - interval '20 minutes',
  'lost-worker',
  now() - interval '20 minutes'
);

select is(
  (
    select count(*)::integer
    from public.claim_due_trip_weather('recovery-worker', 10, 900)
    where trip_id = 'weather-stale-lock'
  ),
  1,
  'a stale scheduled lock is recoverable'
);
select results_eq(
  $$
    select attempt_count, locked_by
    from public.weather_refresh_state
    where trip_id = 'weather-stale-lock'
  $$,
  $$ values (2, 'recovery-worker'::text) $$,
  'stale-lock recovery increments the attempt and installs the new worker lock'
);

update public.weather_refresh_state
set status = 'refreshing',
    locked_at = now(),
    locked_by = 'stale-writer',
    last_attempt_at = now(),
    last_success_at = now() + interval '1 minute',
    attempt_count = 1
where trip_id = 'weather-upcoming';

select throws_ok(
  $$
    select public.persist_trip_weather(
      'weather-upcoming',
      'stale-writer',
      jsonb_build_object(
        'provider', 'open-meteo',
        'requestedAt', (now() - interval '1 hour')::text,
        'providerGeneratedAt', null,
        'sourceObservedAt', (now() - interval '1 hour')::text,
        'timezone', 'America/Toronto',
        'utcOffsetSeconds', -14400,
        'requestFingerprint', repeat('c', 64),
        'fingerprint', repeat('d', 64),
        'current', jsonb_build_object(
          'temperatureC', -40,
          'weatherCode', 0,
          'conditionLabel', 'Clear Sky',
          'icon', 'sun'
        ),
        'daily', jsonb_build_array(
          jsonb_build_object(
            'forecast_date', current_date::text,
            'condition_label', 'Clear Sky',
            'icon', 'sun'
          ),
          jsonb_build_object(
            'forecast_date', (current_date + 1)::text,
            'condition_label', 'Clear Sky',
            'icon', 'sun'
          ),
          jsonb_build_object(
            'forecast_date', (current_date + 2)::text,
            'condition_label', 'Clear Sky',
            'icon', 'sun'
          ),
          jsonb_build_object(
            'forecast_date', (current_date + 3)::text,
            'condition_label', 'Clear Sky',
            'icon', 'sun'
          ),
          jsonb_build_object(
            'forecast_date', (current_date + 4)::text,
            'condition_label', 'Clear Sky',
            'icon', 'sun'
          )
        )
      )
    )
  $$,
  '22000',
  'Stale weather payload rejected',
  'an older request cannot overwrite newer weather'
);
select is(
  (select temperature_c from public.weather_current where trip_id = 'weather-upcoming'),
  21.5::double precision,
  'stale payload rejection leaves valid content unchanged'
);

update public.weather_refresh_state
set status = 'refreshing',
    locked_at = now(),
    locked_by = 'same-payload',
    last_attempt_at = now(),
    last_success_at = now() - interval '1 minute',
    attempt_count = 1
where trip_id = 'weather-upcoming';

select is(
  public.persist_trip_weather(
    'weather-upcoming',
    'same-payload',
    jsonb_build_object(
      'provider', 'open-meteo',
      'requestedAt', now()::text,
      'providerGeneratedAt', null,
      'sourceObservedAt', now()::text,
      'timezone', 'America/Toronto',
      'utcOffsetSeconds', -14400,
      'requestFingerprint', repeat('a', 64),
      'fingerprint', repeat('b', 64),
      'current', jsonb_build_object(
        'temperatureC', 21.5,
        'weatherCode', 2,
        'conditionLabel', 'Partly Cloudy',
        'icon', 'cloud-sun'
      ),
      'daily', jsonb_build_array(
        jsonb_build_object(
          'forecast_date', current_date::text,
          'condition_label', 'Partly Cloudy',
          'icon', 'cloud-sun'
        ),
        jsonb_build_object(
          'forecast_date', (current_date + 1)::text,
          'condition_label', 'Partly Cloudy',
          'icon', 'cloud-sun'
        ),
        jsonb_build_object(
          'forecast_date', (current_date + 2)::text,
          'condition_label', 'Partly Cloudy',
          'icon', 'cloud-sun'
        ),
        jsonb_build_object(
          'forecast_date', (current_date + 3)::text,
          'condition_label', 'Partly Cloudy',
          'icon', 'cloud-sun'
        ),
        jsonb_build_object(
          'forecast_date', (current_date + 4)::text,
          'condition_label', 'Partly Cloudy',
          'icon', 'cloud-sun'
        )
      )
    )
  ),
  'unchanged',
  'an identical payload fingerprint avoids unnecessary content writes'
);
select is(
  (select temperature_c from public.weather_current where trip_id = 'weather-upcoming'),
  21.5::double precision,
  'unchanged fingerprints preserve the existing weather rows'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000301","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)::integer
    from public.claim_trip_weather_manual('weather-manual', 'manual-owner', 600, 900)
  ),
  1,
  'an owner can manually refresh a distant-future trip'
);
select is(
  (
    select count(*)::integer
    from public.claim_trip_weather_manual('weather-manual', 'manual-overlap', 600, 900)
  ),
  0,
  'manual and scheduled paths share the same lock'
);
select is(
  (
    select count(*)::integer
    from public.claim_trip_weather_manual('weather-editor', 'manual-editor', 600, 900)
  ),
  1,
  'an editor can manually refresh an authorized trip'
);

reset role;
update public.weather_refresh_state
set status = 'idle',
    locked_at = null,
    locked_by = null,
    last_attempt_at = now()
where trip_id = 'weather-manual';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000301","role":"authenticated"}',
  true
);
select is(
  (
    select count(*)::integer
    from public.claim_trip_weather_manual('weather-manual', 'manual-cooldown', 600, 900)
  ),
  0,
  'manual refresh enforces its user-facing cooldown'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000302","role":"authenticated"}',
  true
);
select throws_ok(
  $$ select public.claim_trip_weather_manual('weather-manual', 'manual-viewer', 600, 900) $$,
  '42501',
  'Trip editor access required',
  'viewers cannot force weather refresh'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000303","role":"authenticated"}',
  true
);
select throws_ok(
  $$ select public.claim_trip_weather_manual('weather-manual', 'manual-outsider', 600, 900) $$,
  '42501',
  'Trip editor access required',
  'non-members cannot force cross-trip weather refresh'
);
select is(
  (select count(*)::integer from public.weather_refresh_state where trip_id = 'weather-manual'),
  0,
  'RLS hides another trip weather state from non-members'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000301","role":"authenticated"}',
  true
);
select is(
  (select count(*)::integer from public.weather_refresh_state where trip_id = 'weather-manual'),
  1,
  'RLS exposes weather state to trip members'
);

reset role;
update public.weather_refresh_state
set status = 'refreshing',
    locked_at = now(),
    locked_by = 'permanent-worker',
    last_attempt_at = now(),
    attempt_count = 1
where trip_id = 'weather-manual';
set local role service_role;

select ok(
  public.fail_trip_weather(
    'weather-manual',
    'permanent-worker',
    'provider_contract',
    'Provider response did not match the expected contract.'
  ),
  'permanent failures release the lock and retain diagnostics'
);
select results_eq(
  $$
    select status, last_error_code
    from public.weather_refresh_state
    where trip_id = 'weather-manual'
  $$,
  $$ values ('failed'::text, 'provider_contract'::text) $$,
  'permanent failure state is operator-visible without deleting weather'
);
select isnt(
  has_function_privilege('public', 'public.persist_trip_weather(text,text,jsonb)', 'execute'),
  true,
  'PUBLIC cannot execute atomic weather persistence'
);
select isnt(
  has_function_privilege('authenticated', 'public.persist_trip_weather(text,text,jsonb)', 'execute'),
  true,
  'authenticated clients cannot execute service-only persistence'
);
select ok(
  has_function_privilege('service_role', 'public.persist_trip_weather(text,text,jsonb)', 'execute'),
  'service role can execute atomic weather persistence'
);

select * from finish();
rollback;
