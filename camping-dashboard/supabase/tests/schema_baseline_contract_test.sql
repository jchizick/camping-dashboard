begin;
select plan(19);

select has_table(
  'public',
  'prep_feed_storage_cleanup_jobs',
  'cleanup queue is reconstructed'
);

select col_is_pk(
  'public',
  'weather_current',
  'trip_id',
  'weather current is a trip singleton'
);

select results_eq(
  $$
    select con.confdeltype::text
    from pg_constraint con
    where con.conname = 'weather_current_trip_id_fkey'
      and con.conrelid = 'public.weather_current'::regclass
  $$,
  array['c'::text],
  'singleton foreign keys cascade'
);

select has_index(
  'public',
  'weather_forecast',
  'weather_forecast_trip_date_key',
  'forecast trip/date uniqueness is present'
);

select is(
  (
    select roles::text collate "C"
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'member_upload_prep_feed'
  ),
  '{authenticated}'::text collate "C",
  'Storage uploads target authenticated users'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'member_upload_prep_feed',
        'member_delete_prep_feed'
      )
  $$,
  array[2::bigint],
  'only the two canonical prep-feed mutation policies exist'
);

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
values
(
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'baseline-owner@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000302',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'baseline-editor@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000303',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'baseline-viewer@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

create function public.test_reject_settings()
returns trigger
language plpgsql
as $function$
begin
  raise exception 'forced settings failure';
end
$function$;

create trigger test_reject_settings
before insert on public.settings
for each row execute function public.test_reject_settings();

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000301","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.create_trip(
      'Atomic Rollback Trip',
      '2026-10-01'::date,
      '2026-10-03'::date,
      45.1,
      -78.1
    )
  $$,
  'P0001',
  'forced settings failure',
  'a late create_trip failure is surfaced'
);

reset role;

select is(
  (select count(*)::integer from public.trips where name = 'Atomic Rollback Trip'),
  0,
  'create_trip rolls back earlier inserts atomically'
);

drop trigger test_reject_settings on public.settings;
drop function public.test_reject_settings();

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000301","role":"authenticated"}',
  true
);

select set_config(
  'test.baseline_trip_id',
  public.create_trip(
    'Baseline Contract Trip',
    '2026-10-01'::date,
    '2026-10-03'::date,
    45.1,
    -78.1
  ),
  true
);

insert into public.trip_members (trip_id, user_id, role)
values
  (
    current_setting('test.baseline_trip_id'),
    '00000000-0000-0000-0000-000000000302',
    'editor'
  ),
  (
    current_setting('test.baseline_trip_id'),
    '00000000-0000-0000-0000-000000000303',
    'viewer'
  );

select ok(
  app_private.is_trip_owner(current_setting('test.baseline_trip_id')),
  'the trip creator is the owner'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000302","role":"authenticated"}',
  true
);

select ok(
  app_private.can_edit_trip(current_setting('test.baseline_trip_id')),
  'an editor can edit the trip'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000303","role":"authenticated"}',
  true
);

select ok(
  app_private.is_trip_member(current_setting('test.baseline_trip_id')),
  'a viewer can see their trip'
);

select isnt(
  app_private.can_edit_trip(current_setting('test.baseline_trip_id')),
  true,
  'a viewer cannot edit their trip'
);

reset role;

insert into public.weather_forecast (id, trip_id, forecast_date)
values (
  'baseline-forecast-1',
  current_setting('test.baseline_trip_id'),
  '2026-10-01'
);

select throws_ok(
  format(
    $sql$
      insert into public.weather_forecast (id, trip_id, forecast_date)
      values ('baseline-forecast-2', %L, '2026-10-01')
    $sql$,
    current_setting('test.baseline_trip_id')
  ),
  '23505',
  null,
  'duplicate forecasts for one trip/date are rejected'
);

select throws_ok(
  $$
    insert into public.trips (
      id, name, campsite_latitude, campsite_longitude, map_style
    )
    values ('invalid-coordinates', 'Invalid', 91, -78, 'openstreetmap')
  $$,
  '23514',
  null,
  'invalid campsite coordinates are rejected'
);

select throws_ok(
  $$
    insert into public.trips (id, name, map_style)
    values ('invalid-map-style', 'Invalid', 'satellite')
  $$,
  '23514',
  null,
  'invalid map styles are rejected'
);

select throws_ok(
  format(
    $sql$
      insert into public.prep_feed_items (
        trip_id, image_url, storage_path, caption
      )
      values (%L, null, 'another-trip/image.jpg', 'Invalid path')
    $sql$,
    current_setting('test.baseline_trip_id')
  ),
  '23514',
  null,
  'prep-feed paths must stay in their trip namespace'
);

select throws_ok(
  format(
    $sql$
      insert into public.prep_feed_storage_cleanup_jobs (
        trip_id, storage_path
      )
      values (%L, %L || '/../image.jpg')
    $sql$,
    current_setting('test.baseline_trip_id'),
    current_setting('test.baseline_trip_id')
  ),
  '23514',
  null,
  'cleanup queue paths reject traversal'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000301","role":"authenticated"}',
  true
);

select set_config(
  'test.baseline_deletion_token',
  public.begin_trip_deletion(current_setting('test.baseline_trip_id'))::text,
  true
);

select is(
  public.begin_trip_deletion(current_setting('test.baseline_trip_id'))::text,
  current_setting('test.baseline_deletion_token'),
  'duplicate deletion submission reuses the token'
);

select isnt(
  app_private.can_edit_trip(current_setting('test.baseline_trip_id')),
  true,
  'a pending trip is read-only'
);

select * from finish();
rollback;
