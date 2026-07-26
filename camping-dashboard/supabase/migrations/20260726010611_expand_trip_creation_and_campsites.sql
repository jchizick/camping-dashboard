-- Expand phase: add trip-owned campsite data and an atomic creation RPC while
-- retaining legacy singleton IDs for compatibility with the deployed app.

do $guard$
declare
  v_table text;
  v_trip_id text;
  v_count bigint;
begin
  foreach v_table in array array[
    'settings',
    'park_intel',
    'offline_status',
    'astro_data',
    'weather_current'
  ]
  loop
    execute format(
      'select count(*) from public.%I where trip_id is null',
      v_table
    ) into v_count;
    if v_count > 0 then
      raise exception
        'Migration precondition failed: public.% has % null trip_id row(s)',
        v_table,
        v_count;
    end if;

    execute format(
      'select trip_id, count(*) from public.%I group by trip_id having count(*) > 1 limit 1',
      v_table
    ) into v_trip_id, v_count;
    if v_trip_id is not null then
      raise exception
        'Migration precondition failed: public.% has % rows for trip_id %',
        v_table,
        v_count,
        v_trip_id;
    end if;

    execute format(
      'select s.trip_id from public.%I s left join public.trips t on t.id = s.trip_id where t.id is null limit 1',
      v_table
    ) into v_trip_id;
    if v_trip_id is not null then
      raise exception
        'Migration precondition failed: public.% has orphaned trip_id %',
        v_table,
        v_trip_id;
    end if;
  end loop;

  select count(*) into v_count
  from public.weather_forecast
  where trip_id is null;
  if v_count > 0 then
    raise exception
      'Migration precondition failed: public.weather_forecast has % null trip_id row(s)',
      v_count;
  end if;

  select count(*) into v_count
  from public.weather_forecast
  where forecast_date is null;
  if v_count > 0 then
    raise exception
      'Migration precondition failed: public.weather_forecast has % null forecast_date row(s)',
      v_count;
  end if;

  select trip_id, count(*) into v_trip_id, v_count
  from public.weather_forecast
  group by trip_id, forecast_date
  having count(*) > 1
  limit 1;
  if v_trip_id is not null then
    raise exception
      'Migration precondition failed: public.weather_forecast has duplicate trip/date rows for trip_id %',
      v_trip_id;
  end if;

  select wf.trip_id into v_trip_id
  from public.weather_forecast wf
  left join public.trips t on t.id = wf.trip_id
  where t.id is null
  limit 1;
  if v_trip_id is not null then
    raise exception
      'Migration precondition failed: public.weather_forecast has orphaned trip_id %',
      v_trip_id;
  end if;

  if exists (
    select 1
    from public.trips
    where id = 'trip-maple-lake-001'
      and (
        site_lat is null
        or site_lng is null
        or site_lat not between -90 and 90
        or site_lng not between -180 and 180
      )
  ) then
    raise exception
      'Migration precondition failed: Algonquin legacy coordinates are missing or invalid';
  end if;
end
$guard$;

alter table public.trips
  add column if not exists campsite_latitude double precision,
  add column if not exists campsite_longitude double precision,
  add column if not exists campsite_label text,
  add column if not exists campsite_source text,
  add column if not exists campsite_osm_id text,
  add column if not exists map_style text default 'openstreetmap';

alter table public.trips
  add constraint trips_campsite_coordinates_pair_check
    check (
      (campsite_latitude is null and campsite_longitude is null)
      or
      (
        campsite_latitude between -90 and 90
        and campsite_longitude between -180 and 180
      )
    ),
  add constraint trips_map_style_check
    check (map_style is null or map_style in ('openstreetmap', 'expedition'));

update public.trips
set map_style = 'openstreetmap'
where map_style is null;

update public.trips
set campsite_latitude = site_lat,
    campsite_longitude = site_lng,
    campsite_label = coalesce(nullif(site_name, ''), nullif(lake_name, '')),
    campsite_source = 'legacy_site_coordinates_unverified',
    campsite_osm_id = null,
    map_style = 'expedition'
where id = 'trip-maple-lake-001';

alter table public.settings
  alter column trip_id set not null,
  add constraint settings_trip_id_key unique (trip_id);

alter table public.park_intel
  alter column trip_id set not null,
  add constraint park_intel_trip_id_key unique (trip_id);

alter table public.offline_status
  alter column trip_id set not null,
  add constraint offline_status_trip_id_key unique (trip_id);

alter table public.astro_data
  alter column trip_id set not null,
  add constraint astro_data_trip_id_key unique (trip_id);

alter table public.weather_current
  alter column trip_id set not null,
  add constraint weather_current_trip_id_key unique (trip_id);

alter table public.weather_forecast
  alter column trip_id set not null,
  alter column forecast_date set not null,
  add constraint weather_forecast_trip_date_key unique (trip_id, forecast_date);

create or replace function public.create_trip(
  p_name text,
  p_start_date date,
  p_end_date date,
  p_campsite_latitude double precision,
  p_campsite_longitude double precision,
  p_park_name text default '',
  p_lake_name text default '',
  p_site_name text default '',
  p_campsite_label text default null,
  p_campsite_source text default 'manual_map_selection',
  p_campsite_osm_id text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_trip_id text := 'trip-' || substr(gen_random_uuid()::text, 1, 12);
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Trip name is required';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception using
      errcode = '22023',
      message = 'Start and end dates are required';
  end if;

  if p_end_date < p_start_date then
    raise exception using
      errcode = '22023',
      message = 'End date cannot be before start date';
  end if;

  if p_campsite_latitude is null
     or p_campsite_longitude is null
     or p_campsite_latitude not between -90 and 90
     or p_campsite_longitude not between -180 and 180 then
    raise exception using
      errcode = '22023',
      message = 'Valid campsite coordinates are required';
  end if;

  insert into public.trips (
    id,
    name,
    park_name,
    lake_name,
    site_name,
    start_date,
    end_date,
    site_lat,
    site_lng,
    campsite_latitude,
    campsite_longitude,
    campsite_label,
    campsite_source,
    campsite_osm_id,
    map_style,
    theme_mode
  )
  values (
    v_trip_id,
    btrim(p_name),
    coalesce(btrim(p_park_name), ''),
    coalesce(btrim(p_lake_name), ''),
    coalesce(btrim(p_site_name), ''),
    p_start_date,
    p_end_date,
    p_campsite_latitude,
    p_campsite_longitude,
    p_campsite_latitude,
    p_campsite_longitude,
    nullif(btrim(p_campsite_label), ''),
    coalesce(nullif(btrim(p_campsite_source), ''), 'manual_map_selection'),
    nullif(btrim(p_campsite_osm_id), ''),
    'openstreetmap',
    'auto'
  );

  insert into public.trip_members (trip_id, user_id, role)
  values (v_trip_id, v_user_id, 'owner');

  -- Legacy ID remains during the expand phase. The contract migration removes it.
  insert into public.settings (
    id,
    trip_id,
    manual_theme_override,
    preferred_units,
    show_astro,
    show_meals,
    show_offline,
    show_crew,
    theme_variant
  )
  values (
    'settings-' || gen_random_uuid()::text,
    v_trip_id,
    'auto',
    'metric',
    true,
    true,
    true,
    true,
    'expedition'
  );

  return v_trip_id;
end
$function$;

revoke all on function public.create_trip(
  text,
  date,
  date,
  double precision,
  double precision,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon;

grant execute on function public.create_trip(
  text,
  date,
  date,
  double precision,
  double precision,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

drop policy if exists auth_insert_trip on public.trips;
revoke insert on table public.trips from anon, authenticated;
