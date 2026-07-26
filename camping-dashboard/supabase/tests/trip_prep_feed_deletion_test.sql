begin;
select plan(12);

select col_not_null(
  'public',
  'prep_feed_items',
  'trip_id',
  'prep-feed items require a trip'
);

select has_index(
  'public',
  'prep_feed_items',
  'prep_feed_items_trip_id_idx',
  'prep-feed trip lookup is indexed'
);

select results_eq(
  $$
    select con.confdeltype::text
    from pg_constraint con
    where con.conname = 'prep_feed_items_trip_id_fkey'
      and con.conrelid = 'public.prep_feed_items'::regclass
  $$,
  array['c'::text],
  'prep-feed foreign key cascades on trip deletion'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public'
      and tablename = 'trips'
      and policyname = 'owner_delete'
  $$,
  array[0::bigint],
  'direct trip deletion policy is removed'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'auth_delete_prep_feed_objects',
        'auth_upload_prep_feed_objects'
      )
  $$,
  array[0::bigint],
  'broad authenticated storage policies are removed'
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
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'deletion-owner@example.com',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000202',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'deletion-editor@example.com',
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
  '{"sub":"00000000-0000-0000-0000-000000000201","role":"authenticated"}',
  true
);

select set_config(
  'test.trip_id',
  public.create_trip(
    'Deletion Contract Trip',
    '2026-09-01'::date,
    '2026-09-03'::date,
    45.5,
    -78.2
  ),
  true
);

insert into public.trip_members (trip_id, user_id, role)
values (
  current_setting('test.trip_id'),
  '00000000-0000-0000-0000-000000000202',
  'editor'
);

insert into public.prep_feed_items (
  trip_id,
  image_url,
  storage_path,
  caption,
  category,
  uploaded_by
)
values (
  current_setting('test.trip_id'),
  'https://images.example.test/external.jpg',
  null,
  'External image',
  'Misc',
  'Owner'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000202","role":"authenticated"}',
  true
);

select throws_ok(
  format(
    'select public.begin_trip_deletion(%L)',
    current_setting('test.trip_id')
  ),
  '42501',
  'Only the trip owner can delete this trip',
  'an editor cannot begin trip deletion'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000201","role":"authenticated"}',
  true
);

select lives_ok(
  format(
    'select set_config(''test.deletion_token'', public.begin_trip_deletion(%L)::text, true)',
    current_setting('test.trip_id')
  ),
  'the owner can mark the trip pending deletion'
);

select lives_ok(
  format(
    'select public.complete_trip_deletion(%L, %L::uuid)',
    current_setting('test.trip_id'),
    current_setting('test.deletion_token')
  ),
  'the owner can complete deletion with the matching token'
);

select results_eq(
  $$ select count(*)::bigint from public.trips where name = 'Deletion Contract Trip' $$,
  array[0::bigint],
  'the trip is deleted'
);

select results_eq(
  $$ select count(*)::bigint from public.prep_feed_items where caption = 'External image' $$,
  array[0::bigint],
  'prep-feed rows cascade'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.trip_members tm
    join public.trips t on t.id = tm.trip_id
    where t.name = 'Deletion Contract Trip'
  $$,
  array[0::bigint],
  'trip memberships cascade'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.settings s
    join public.trips t on t.id = s.trip_id
    where t.name = 'Deletion Contract Trip'
  $$,
  array[0::bigint],
  'trip settings cascade'
);

select * from finish();
rollback;
