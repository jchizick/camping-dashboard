begin;
select plan(31);

select col_not_null('public', 'crew_members', 'trip_id', 'Crew rows are always trip scoped');
select col_not_null('public', 'gear_items', 'trip_id', 'Gear rows are always trip scoped');
select col_not_null('public', 'meals', 'trip_id', 'Meal rows are always trip scoped');
select has_column('public', 'crew_members', 'trip_member_id', 'Crew can optionally link to Trip Membership');
select has_column('public', 'gear_items', 'responsible_crew_member_id', 'Gear has stable Crew responsibility');
select has_column('public', 'meals', 'prep_crew_member_id', 'Meals have stable Crew prep responsibility');
select has_index('public', 'crew_members', 'crew_members_trip_member_id_key', 'Crew membership links are unique when present');
select has_index('public', 'gear_items', 'gear_items_responsible_crew_member_id_idx', 'Gear responsibility lookups are indexed');
select has_index('public', 'meals', 'meals_prep_crew_member_id_idx', 'Meal prep lookups are indexed');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'crew-owner-a@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'crew-editor-a@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'crew-viewer-a@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000604', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'crew-owner-b@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.trips (id, name, start_date, end_date)
values
  ('crew-contract-a', 'Crew Contract A', '2026-09-01', '2026-09-03'),
  ('crew-contract-b', 'Crew Contract B', '2026-09-04', '2026-09-06'),
  ('crew-contract-delete', 'Crew Contract Delete', '2026-09-07', '2026-09-08');

insert into public.trip_members (id, trip_id, user_id, role)
values
  ('10000000-0000-0000-0000-000000000601', 'crew-contract-a', '00000000-0000-0000-0000-000000000601', 'owner'),
  ('10000000-0000-0000-0000-000000000602', 'crew-contract-a', '00000000-0000-0000-0000-000000000602', 'editor'),
  ('10000000-0000-0000-0000-000000000603', 'crew-contract-a', '00000000-0000-0000-0000-000000000603', 'viewer'),
  ('10000000-0000-0000-0000-000000000604', 'crew-contract-b', '00000000-0000-0000-0000-000000000604', 'owner'),
  ('10000000-0000-0000-0000-000000000605', 'crew-contract-delete', '00000000-0000-0000-0000-000000000601', 'owner');

insert into public.crew_members (
  id, trip_id, name, role, load_item, load_weight_kg, canoe_number, notes, trip_member_id
)
values
  ('crew-a', 'crew-contract-a', 'Jordan', 'Lead', '', 12, 1, '', null),
  ('crew-a-linked', 'crew-contract-a', 'Liz', 'Navigator', '', 10, 1, '', '10000000-0000-0000-0000-000000000602'),
  ('crew-a-delete', 'crew-contract-a', 'Dad', 'Paddler', '', 15, 2, '', null),
  ('crew-b', 'crew-contract-b', 'Jordan', 'Lead', '', 11, 1, '', null),
  ('crew-trip-delete', 'crew-contract-delete', 'Camper', 'Paddler', '', 8, 1, '', null);

insert into public.gear_items (
  id, trip_id, name, category, packed, owner, priority, notes, weight_kg, acquired,
  responsible_crew_member_id
)
values
  ('gear-a', 'crew-contract-a', 'Tent', 'Shelter', false, null, 'critical', '', 2.4, true, null),
  ('gear-delete', 'crew-contract-a', 'Canoe', 'Camp', false, null, 'high', '', 20, true, 'crew-a-delete'),
  ('gear-member-delete', 'crew-contract-a', 'First aid', 'Safety', true, null, 'critical', '', 1, true, 'crew-a-linked'),
  ('gear-trip-delete', 'crew-contract-delete', 'Tarp', 'Shelter', false, null, 'high', '', 1, true, 'crew-trip-delete');

insert into public.meals (
  id, trip_id, day_number, meal_type, title, prep_type, calories, assigned_to, notes,
  prep_crew_member_id
)
values
  ('meal-a', 'crew-contract-a', 1, 'dinner', 'Chili', 'dehydrated', 700, null, '', null),
  ('meal-delete', 'crew-contract-a', 2, 'breakfast', 'Oatmeal', 'fresh', 500, null, '', 'crew-a-delete'),
  ('meal-member-delete', 'crew-contract-a', 2, 'dinner', 'Pasta', 'fresh', 750, null, '', 'crew-a-linked'),
  ('meal-trip-delete', 'crew-contract-delete', 1, 'dinner', 'Soup', 'fresh', 600, null, '', 'crew-trip-delete');

select lives_ok(
  $$ update public.gear_items set responsible_crew_member_id = 'crew-a' where id = 'gear-a' $$,
  'same-trip Gear responsibility is valid'
);
select lives_ok(
  $$ update public.meals set prep_crew_member_id = 'crew-a' where id = 'meal-a' $$,
  'same-trip Meal prep responsibility is valid'
);
select lives_ok(
  $$ update public.crew_members set trip_member_id = '10000000-0000-0000-0000-000000000601' where id = 'crew-a' $$,
  'same-trip Crew membership link is valid'
);

select throws_ok(
  $$ update public.gear_items set responsible_crew_member_id = 'crew-b' where id = 'gear-a' $$,
  '23503', null, 'Gear cannot reference Crew from another trip'
);
select throws_ok(
  $$ update public.meals set prep_crew_member_id = 'crew-b' where id = 'meal-a' $$,
  '23503', null, 'Meals cannot reference Crew from another trip'
);
select throws_ok(
  $$ update public.crew_members set trip_member_id = '10000000-0000-0000-0000-000000000604' where id = 'crew-a' $$,
  '23503', null, 'Crew cannot link to Trip Membership from another trip'
);

delete from public.crew_members where id = 'crew-a-delete';
select is((select count(*)::integer from public.gear_items where id = 'gear-delete'), 1, 'Crew deletion preserves Gear');
select is((select count(*)::integer from public.meals where id = 'meal-delete'), 1, 'Crew deletion preserves Meals');
select is((select responsible_crew_member_id from public.gear_items where id = 'gear-delete'), null, 'Crew deletion clears Gear responsibility only');
select is((select prep_crew_member_id from public.meals where id = 'meal-delete'), null, 'Crew deletion clears Meal responsibility only');
select is((select trip_id from public.gear_items where id = 'gear-delete'), 'crew-contract-a', 'Crew deletion preserves Gear trip ID');
select is((select trip_id from public.meals where id = 'meal-delete'), 'crew-contract-a', 'Crew deletion preserves Meal trip ID');

delete from public.trip_members where id = '10000000-0000-0000-0000-000000000602';
select is((select count(*)::integer from public.crew_members where id = 'crew-a-linked'), 1, 'Trip Member deletion preserves Crew');
select is((select trip_member_id from public.crew_members where id = 'crew-a-linked'), null, 'Trip Member deletion clears only the account link');
select is((select responsible_crew_member_id from public.gear_items where id = 'gear-member-delete'), 'crew-a-linked', 'Trip Member deletion preserves Gear responsibility');
select is((select prep_crew_member_id from public.meals where id = 'meal-member-delete'), 'crew-a-linked', 'Trip Member deletion preserves Meal responsibility');

insert into public.trip_members (id, trip_id, user_id, role)
values ('10000000-0000-0000-0000-000000000602', 'crew-contract-a', '00000000-0000-0000-0000-000000000602', 'editor');

delete from public.trips where id = 'crew-contract-delete';
select is((select count(*)::integer from public.crew_members where trip_id = 'crew-contract-delete'), 0, 'Trip deletion cascades Crew');
select is((select count(*)::integer from public.gear_items where trip_id = 'crew-contract-delete'), 0, 'Trip deletion cascades Gear');
select is((select count(*)::integer from public.meals where trip_id = 'crew-contract-delete'), 0, 'Trip deletion cascades Meals');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601","role":"authenticated"}', true);
select lives_ok(
  $$ update public.gear_items set responsible_crew_member_id = null where id = 'gear-a' $$,
  'owner can update Crew responsibility'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000602","role":"authenticated"}', true);
select lives_ok(
  $$ update public.meals set prep_crew_member_id = 'crew-a' where id = 'meal-a' $$,
  'editor can update Crew responsibility'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000603","role":"authenticated"}', true);
update public.gear_items set responsible_crew_member_id = 'crew-a' where id = 'gear-a';
select is((select responsible_crew_member_id from public.gear_items where id = 'gear-a'), null, 'viewer cannot update Crew responsibility');

select * from finish();
rollback;
