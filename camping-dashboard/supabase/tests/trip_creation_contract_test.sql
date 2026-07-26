begin;
select plan(20);

select hasnt_column('public', 'settings', 'id', 'settings has no legacy id');
select col_is_pk('public', 'settings', 'trip_id', 'settings is keyed by trip_id');
select hasnt_column('public', 'park_intel', 'id', 'park intel has no legacy id');
select col_is_pk('public', 'park_intel', 'trip_id', 'park intel is keyed by trip_id');
select hasnt_column('public', 'offline_status', 'id', 'offline status has no legacy id');
select col_is_pk('public', 'offline_status', 'trip_id', 'offline status is keyed by trip_id');
select hasnt_column('public', 'astro_data', 'id', 'astro data has no legacy id');
select col_is_pk('public', 'astro_data', 'trip_id', 'astro data is keyed by trip_id');
select hasnt_column('public', 'weather_current', 'id', 'current weather has no legacy id');
select col_is_pk('public', 'weather_current', 'trip_id', 'current weather is keyed by trip_id');

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000123',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'trip-creation-test@example.com',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000123","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.create_trip(
      'Integration Test Trip',
      '2026-08-10'::date,
      '2026-08-12'::date,
      45.5001,
      -78.2002,
      'User Park',
      'User Lake',
      'Site 12',
      'Pinned campsite',
      'manual_map_selection',
      null
    )
  $$,
  'authenticated users can create a complete trip transaction'
);

select is(
  (select count(*)::integer from public.trips where name = 'Integration Test Trip'),
  1,
  'trip row was created'
);

select is(
  (select map_style from public.trips where name = 'Integration Test Trip'),
  'openstreetmap',
  'map style is assigned by the database'
);

select is(
  (select campsite_source from public.trips where name = 'Integration Test Trip'),
  'manual_map_selection',
  'selected campsite provenance is preserved'
);

select is(
  (
    select count(*)::integer
    from public.trip_members tm
    join public.trips t on t.id = tm.trip_id
    where t.name = 'Integration Test Trip'
      and tm.user_id = '00000000-0000-0000-0000-000000000123'
      and tm.role = 'owner'
  ),
  1,
  'creator receives the canonical owner membership'
);

select is(
  (
    select count(*)::integer
    from public.settings s
    join public.trips t on t.id = s.trip_id
    where t.name = 'Integration Test Trip'
  ),
  1,
  'mandatory settings singleton is created'
);

select is(
  (
    select count(*)::integer
    from public.park_intel p
    join public.trips t on t.id = p.trip_id
    where t.name = 'Integration Test Trip'
  ),
  0,
  'optional park intel is lazy'
);

select is(
  (
    select count(*)::integer
    from public.offline_status o
    join public.trips t on t.id = o.trip_id
    where t.name = 'Integration Test Trip'
  ),
  0,
  'optional offline state is lazy'
);

select is(
  (
    select count(*)::integer
    from public.weather_current w
    join public.trips t on t.id = w.trip_id
    where t.name = 'Integration Test Trip'
  ),
  0,
  'optional weather is lazy'
);

select throws_ok(
  $$
    select public.create_trip(
      'Missing Location',
      '2026-08-10'::date,
      '2026-08-12'::date,
      null,
      null
    )
  $$,
  '22023',
  'Valid campsite coordinates are required',
  'new trips require campsite coordinates'
);

select * from finish();
rollback;
