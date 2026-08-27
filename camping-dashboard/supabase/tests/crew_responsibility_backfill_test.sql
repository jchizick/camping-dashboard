begin;
select plan(8);

insert into public.trips (id, name)
values
  ('crew-backfill-a', 'Crew Backfill A'),
  ('crew-backfill-b', 'Crew Backfill B');

insert into public.crew_members (
  id, trip_id, name, role, load_item, load_weight_kg, canoe_number, notes
)
values
  ('crew-backfill-jordan', 'crew-backfill-a', 'Jordan', '', '', 0, 1, ''),
  ('crew-backfill-liz', 'crew-backfill-a', 'Liz  Camper', '', '', 0, 1, ''),
  ('crew-backfill-alex-1', 'crew-backfill-a', 'Alex', '', '', 0, 1, ''),
  ('crew-backfill-alex-2', 'crew-backfill-a', ' alex ', '', '', 0, 2, ''),
  ('crew-backfill-remote', 'crew-backfill-b', 'Remote', '', '', 0, 1, '');

insert into public.gear_items (
  id, trip_id, name, owner, acquired
)
values
  ('backfill-case', 'crew-backfill-a', 'Tent', 'JORDAN', false),
  ('backfill-space', 'crew-backfill-a', 'Stove', '  Liz    Camper  ', false),
  ('backfill-duplicate', 'crew-backfill-a', 'Tarp', 'Alex', false),
  ('backfill-unmatched', 'crew-backfill-a', 'Canoe', 'Dad', false),
  ('backfill-cross-trip', 'crew-backfill-a', 'Map', 'Remote', false),
  ('backfill-blank', 'crew-backfill-a', 'Mug', '   ', false),
  ('backfill-null', 'crew-backfill-a', 'Spoon', null, false);

insert into public.meals (
  id, trip_id, day_number, meal_type, title, prep_type, calories, assigned_to, notes
)
values
  ('backfill-meal', 'crew-backfill-a', 1, 'dinner', 'Chili', 'fresh', 600, ' jordan ', '');

with normalized_crew as (
  select trip_id, id,
    lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) as normalized_name
  from public.crew_members
),
unique_crew as (
  select trip_id, normalized_name, min(id) as crew_member_id
  from normalized_crew
  where nullif(normalized_name, '') is not null
  group by trip_id, normalized_name
  having count(*) = 1
)
update public.gear_items gear
set responsible_crew_member_id = unique_crew.crew_member_id
from unique_crew
where gear.trip_id = unique_crew.trip_id
  and nullif(btrim(gear.owner), '') is not null
  and lower(regexp_replace(btrim(gear.owner), '[[:space:]]+', ' ', 'g')) = unique_crew.normalized_name
  and gear.responsible_crew_member_id is null;

with normalized_crew as (
  select trip_id, id,
    lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) as normalized_name
  from public.crew_members
),
unique_crew as (
  select trip_id, normalized_name, min(id) as crew_member_id
  from normalized_crew
  where nullif(normalized_name, '') is not null
  group by trip_id, normalized_name
  having count(*) = 1
)
update public.meals meal
set prep_crew_member_id = unique_crew.crew_member_id
from unique_crew
where meal.trip_id = unique_crew.trip_id
  and nullif(btrim(meal.assigned_to), '') is not null
  and lower(regexp_replace(btrim(meal.assigned_to), '[[:space:]]+', ' ', 'g')) = unique_crew.normalized_name
  and meal.prep_crew_member_id is null;

select is((select responsible_crew_member_id from public.gear_items where id = 'backfill-case'), 'crew-backfill-jordan', 'case differences backfill');
select is((select responsible_crew_member_id from public.gear_items where id = 'backfill-space'), 'crew-backfill-liz', 'outer and repeated whitespace backfill');
select is((select responsible_crew_member_id from public.gear_items where id = 'backfill-duplicate'), null, 'duplicate Crew names remain unresolved');
select is((select responsible_crew_member_id from public.gear_items where id = 'backfill-unmatched'), null, 'unmatched legacy names remain unresolved');
select is((select responsible_crew_member_id from public.gear_items where id = 'backfill-cross-trip'), null, 'matching never crosses trip boundaries');
select is((select responsible_crew_member_id from public.gear_items where id = 'backfill-blank'), null, 'blank legacy values remain unassigned');
select is((select responsible_crew_member_id from public.gear_items where id = 'backfill-null'), null, 'null legacy values remain unassigned');
select is((select prep_crew_member_id from public.meals where id = 'backfill-meal'), 'crew-backfill-jordan', 'Meal prep backfill uses the same safe normalization');

select * from finish();
rollback;
