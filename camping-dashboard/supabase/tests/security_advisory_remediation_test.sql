begin;
select plan(36);

select has_schema(
  'app_private',
  'the unexposed RLS-helper schema exists'
);

select hasnt_function(
  'public',
  'is_trip_member',
  array['text'],
  'membership helper is not exposed as a public RPC'
);

select hasnt_function(
  'public',
  'is_trip_owner',
  array['text'],
  'ownership helper is not exposed as a public RPC'
);

select hasnt_function(
  'public',
  'can_edit_trip',
  array['text'],
  'edit helper is not exposed as a public RPC'
);

select hasnt_function(
  'public',
  'user_trip_role',
  array['text'],
  'unused role-returning RPC was removed'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_proc p
    where p.oid in (
      'app_private.is_trip_member(text)'::regprocedure,
      'app_private.is_trip_owner(text)'::regprocedure,
      'app_private.can_edit_trip(text)'::regprocedure
    )
      and p.prosecdef
      and p.proconfig = array['search_path=""']
  $$,
  array[3::bigint],
  'all private RLS helpers retain definer rights with an empty search_path'
);

select isnt(
  has_schema_privilege('anon', 'app_private', 'usage'),
  true,
  'anonymous clients cannot resolve the private helper schema'
);

select isnt(
  has_function_privilege(
    'anon',
    'app_private.is_trip_member(text)',
    'execute'
  ),
  true,
  'anonymous clients cannot execute membership helpers'
);

select ok(
  has_function_privilege(
    'authenticated',
    'app_private.is_trip_member(text)',
    'execute'
  ),
  'authenticated RLS evaluation can execute membership helpers'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public'
      and roles @> array['public']::name[]
  $$,
  array[0::bigint],
  'application-table policies no longer target anonymous callers through PUBLIC'
);

select isnt(
  has_function_privilege('anon', 'public.create_trip(
    text,date,date,double precision,double precision,text,text,text,text,text,text
  )', 'execute'),
  true,
  'anonymous clients cannot execute create_trip'
);

select ok(
  has_function_privilege('authenticated', 'public.create_trip(
    text,date,date,double precision,double precision,text,text,text,text,text,text
  )', 'execute'),
  'authenticated clients retain create_trip access'
);

select isnt(
  has_function_privilege(
    'anon',
    'public.begin_trip_deletion(text)',
    'execute'
  ),
  true,
  'anonymous clients cannot begin trip deletion'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.begin_trip_deletion(text)',
    'execute'
  ),
  'authenticated clients retain begin-trip-deletion access'
);

select isnt(
  has_function_privilege(
    'authenticated',
    'public.replace_prep_feed_image(uuid,uuid,text,text)',
    'execute'
  ),
  true,
  'browser-authenticated clients cannot execute the service-only image RPC'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.replace_prep_feed_image(uuid,uuid,text,text)',
    'execute'
  ),
  'service role retains image-replacement access'
);

select isnt(
  has_table_privilege(
    'anon',
    'public.prep_feed_storage_cleanup_jobs',
    'select'
  ),
  true,
  'anonymous clients cannot read the cleanup queue'
);

select isnt(
  has_table_privilege(
    'authenticated',
    'public.prep_feed_storage_cleanup_jobs',
    'select'
  ),
  true,
  'authenticated clients cannot read the cleanup queue'
);

select isnt(
  has_table_privilege(
    'authenticated',
    'public.prep_feed_storage_cleanup_jobs',
    'insert'
  ),
  true,
  'authenticated clients cannot enqueue cleanup work'
);

select ok(
  has_table_privilege(
    'service_role',
    'public.prep_feed_storage_cleanup_jobs',
    'select,insert,update,delete'
  ),
  'service role retains only the required cleanup-queue DML access'
);

select isnt(
  has_table_privilege(
    'service_role',
    'public.prep_feed_storage_cleanup_jobs',
    'truncate'
  ),
  true,
  'service role cannot truncate the cleanup queue'
);

select isnt(
  has_table_privilege(
    'service_role',
    'public.prep_feed_storage_cleanup_jobs',
    'references'
  ),
  true,
  'service role cannot alter cleanup-queue referential contracts'
);

select isnt(
  has_table_privilege(
    'service_role',
    'public.prep_feed_storage_cleanup_jobs',
    'trigger'
  ),
  true,
  'service role cannot create cleanup-queue triggers'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public'
      and tablename = 'prep_feed_storage_cleanup_jobs'
  $$,
  array[0::bigint],
  'the service-only cleanup queue intentionally has no user policies'
);

select has_index(
  'public',
  'alerts',
  'alerts_trip_id_idx',
  'alerts trip foreign key is indexed'
);

select has_index(
  'public',
  'crew_members',
  'crew_members_trip_id_idx',
  'crew-members trip foreign key is indexed'
);

select has_index(
  'public',
  'gear_items',
  'gear_items_trip_id_idx',
  'gear-items trip foreign key is indexed'
);

select has_index(
  'public',
  'meals',
  'meals_trip_id_idx',
  'meals trip foreign key is indexed'
);

select has_index(
  'public',
  'timeline_events',
  'timeline_events_trip_id_idx',
  'timeline-events trip foreign key is indexed'
);

select has_index(
  'public',
  'trip_members',
  'trip_members_user_id_idx',
  'membership user foreign key is indexed'
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
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'advisor-owner@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000402',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'advisor-viewer@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000403',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'advisor-nonmember@example.test',
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
  '{"sub":"00000000-0000-0000-0000-000000000401","role":"authenticated"}',
  true
);

select set_config(
  'test.advisor_trip_id',
  public.create_trip(
    'Advisor Security Test',
    '2026-11-01'::date,
    '2026-11-03'::date,
    45.5,
    -78.2
  ),
  true
);

insert into public.trip_members (trip_id, user_id, role)
values (
  current_setting('test.advisor_trip_id'),
  '00000000-0000-0000-0000-000000000402',
  'viewer'
);

select ok(
  app_private.is_trip_owner(current_setting('test.advisor_trip_id')),
  'owner behavior is preserved'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000402","role":"authenticated"}',
  true
);

select ok(
  app_private.is_trip_member(current_setting('test.advisor_trip_id')),
  'viewer membership behavior is preserved'
);

select isnt(
  app_private.can_edit_trip(current_setting('test.advisor_trip_id')),
  true,
  'viewer edit denial is preserved'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000403","role":"authenticated"}',
  true
);

select isnt(
  app_private.is_trip_member(current_setting('test.advisor_trip_id')),
  true,
  'non-members cannot infer membership through a positive helper result'
);

select is(
  (
    select count(*)::integer
    from public.trips
    where id = current_setting('test.advisor_trip_id')
  ),
  0,
  'non-members cannot read the trip through RLS'
);

select throws_ok(
  $$
    select count(*) from public.prep_feed_storage_cleanup_jobs
  $$,
  '42501',
  null,
  'authenticated SQL access to the cleanup queue is denied'
);

select * from finish();
rollback;
