-- Application/SQL-object refactor phase. The expand migration supplied a
-- temporary default for settings.id, so the RPC can stop referencing that
-- legacy singleton key before the contract migration removes it.

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

  insert into public.settings (
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
