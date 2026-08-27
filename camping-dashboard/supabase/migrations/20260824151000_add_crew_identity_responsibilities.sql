-- Establish stable Crew identity links and domain-specific Gear/Meal
-- responsibility while preserving the existing trip-scoped authorization
-- model and legacy free-text assignment columns.

do $guard$
declare
  v_table text;
  v_null_count bigint;
begin
  foreach v_table in array array['crew_members', 'gear_items', 'meals']
  loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'Crew responsibility migration aborted: public.% is missing', v_table;
    end if;

    execute format(
      'select count(*) from public.%I where trip_id is null',
      v_table
    ) into v_null_count;

    if v_null_count > 0 then
      raise exception
        'Crew responsibility migration aborted: public.% has % null trip_id row(s)',
        v_table,
        v_null_count;
    end if;
  end loop;

  if to_regclass('public.trip_members') is null then
    raise exception 'Crew responsibility migration aborted: public.trip_members is missing';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'crew_members' and column_name = 'trip_member_id')
        or (table_name = 'gear_items' and column_name = 'responsible_crew_member_id')
        or (table_name = 'meals' and column_name = 'prep_crew_member_id')
      )
  ) then
    raise exception 'Crew responsibility migration aborted: a target relationship column already exists';
  end if;
end
$guard$;

alter table public.crew_members
  alter column trip_id set not null;

alter table public.gear_items
  alter column trip_id set not null;

alter table public.meals
  alter column trip_id set not null;

alter table public.trip_members
  add constraint trip_members_trip_id_id_key unique (trip_id, id);

alter table public.crew_members
  add constraint crew_members_trip_id_id_key unique (trip_id, id),
  add column trip_member_id uuid null;

alter table public.gear_items
  add column responsible_crew_member_id text null;

alter table public.meals
  add column prep_crew_member_id text null;

alter table public.crew_members
  add constraint crew_members_same_trip_member_fkey
    foreign key (trip_id, trip_member_id)
    references public.trip_members (trip_id, id)
    on delete set null (trip_member_id);

alter table public.gear_items
  add constraint gear_items_same_trip_responsible_crew_fkey
    foreign key (trip_id, responsible_crew_member_id)
    references public.crew_members (trip_id, id)
    on delete set null (responsible_crew_member_id);

alter table public.meals
  add constraint meals_same_trip_prep_crew_fkey
    foreign key (trip_id, prep_crew_member_id)
    references public.crew_members (trip_id, id)
    on delete set null (prep_crew_member_id);

create unique index crew_members_trip_member_id_key
  on public.crew_members (trip_member_id)
  where trip_member_id is not null;

create index gear_items_responsible_crew_member_id_idx
  on public.gear_items (responsible_crew_member_id)
  where responsible_crew_member_id is not null;

create index meals_prep_crew_member_id_idx
  on public.meals (prep_crew_member_id)
  where prep_crew_member_id is not null;

-- Backfill only a unique normalized Crew name within the same trip. Matching
-- trims outer whitespace, collapses internal whitespace, and ignores case.
-- Ambiguous and unmatched legacy strings remain untouched and unlinked.
with normalized_crew as (
  select
    crew.trip_id,
    crew.id,
    lower(regexp_replace(btrim(crew.name), '[[:space:]]+', ' ', 'g')) as normalized_name
  from public.crew_members crew
),
unique_crew as (
  select
    trip_id,
    normalized_name,
    min(id) as crew_member_id
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
  select
    crew.trip_id,
    crew.id,
    lower(regexp_replace(btrim(crew.name), '[[:space:]]+', ' ', 'g')) as normalized_name
  from public.crew_members crew
),
unique_crew as (
  select
    trip_id,
    normalized_name,
    min(id) as crew_member_id
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
