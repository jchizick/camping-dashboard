-- Schema-only historical baseline.
--
-- This reconstructs the hosted application schema immediately after migration
-- 20260710135251 and before the retained trip-creation/deletion migrations.
-- It intentionally contains no hosted trips, auth users, memberships, feed
-- rows, Storage objects, email allowlists, URLs, or credentials.

create extension if not exists pgcrypto with schema extensions;

create table public.trips (
  id text primary key,
  name text not null,
  park_name text,
  lake_name text,
  site_name text,
  start_date date,
  end_date date,
  launch_point_name text,
  launch_lat double precision,
  launch_lng double precision,
  site_lat double precision,
  site_lng double precision,
  distance_km double precision,
  notes text,
  theme_mode text default 'auto',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.weather_current (
  id text primary key,
  trip_id text references public.trips(id) on delete cascade,
  temperature_c double precision,
  wind_kph double precision,
  humidity integer,
  rain_chance integer,
  sunset_time text,
  sunrise_time text,
  moonset_time text,
  moonrise_time text,
  condition_label text,
  icon text,
  updated_at timestamp with time zone default now()
);

-- Preserve the hosted physical column history so schema introspection and
-- generated types have the same ordinal positions as the canonical database.
alter table public.weather_current drop column moonrise_time;
alter table public.weather_current add column visibility integer;

create table public.weather_forecast (
  id text primary key,
  trip_id text references public.trips(id) on delete cascade,
  forecast_date date,
  high_c double precision,
  low_c double precision,
  condition_label text,
  rain_chance integer,
  wind_kph double precision,
  icon text
);

create table public.gear_items (
  id text primary key default gen_random_uuid()::text,
  trip_id text references public.trips(id) on delete cascade,
  name text not null,
  category text,
  packed boolean default false,
  owner text,
  priority text default 'high',
  notes text,
  weight_kg double precision,
  acquired boolean not null default false
);

create table public.timeline_events (
  id text primary key default gen_random_uuid()::text,
  trip_id text references public.trips(id) on delete cascade,
  day_number integer,
  event_time text,
  title text,
  details text,
  sort_order integer default 0,
  phase text check (
    phase in ('Transit', 'Setup', 'Sustain', 'Leisure', 'None')
  )
);

create table public.meals (
  id text primary key default gen_random_uuid()::text,
  trip_id text references public.trips(id) on delete cascade,
  day_number integer,
  meal_type text,
  title text,
  prep_type text,
  calories integer,
  assigned_to text,
  notes text
);

create table public.crew_members (
  id text primary key default gen_random_uuid()::text,
  trip_id text references public.trips(id) on delete cascade,
  name text not null,
  role text,
  load_item text,
  load_weight_kg double precision,
  canoe_number integer,
  notes text
);

create table public.park_intel (
  id text primary key,
  trip_id text references public.trips(id) on delete cascade,
  fire_restriction text,
  wildlife_notes text,
  ranger_station text,
  firewood_percent integer,
  water_notes text,
  custom_notes text,
  updated_at timestamp with time zone default now()
);

create table public.offline_status (
  id text primary key,
  trip_id text references public.trips(id) on delete cascade,
  maps_cached boolean default false,
  permit_saved boolean default false,
  route_downloaded boolean default false,
  satellite_device_connected boolean default false,
  satellite_device_name text,
  emergency_contact_ready boolean default false,
  updated_at timestamp with time zone default now(),
  daily_vehicle_permit_saved boolean default false
);

create table public.astro_data (
  id text primary key,
  trip_id text references public.trips(id) on delete cascade,
  golden_hour_start text,
  golden_hour_end text,
  blue_hour_end text,
  moon_phase text,
  moon_illumination integer,
  milky_way_visibility text,
  stargazing_notes text,
  updated_at timestamp with time zone default now()
);

create table public.alerts (
  id text primary key default gen_random_uuid()::text,
  trip_id text references public.trips(id) on delete cascade,
  title text,
  body text,
  severity text default 'info',
  source text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table public.settings (
  id text primary key,
  trip_id text references public.trips(id) on delete cascade,
  manual_theme_override text default 'auto',
  preferred_units text default 'metric',
  show_astro boolean default true,
  show_meals boolean default true,
  show_offline boolean default true,
  show_crew boolean default true,
  theme_variant text not null default 'expedition'
    check (theme_variant in ('expedition', 'clean'))
);

create table public.prep_feed_items (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references public.trips(id),
  image_url text not null,
  caption text default '',
  category text not null default 'Misc'
    check (
      category in (
        'Gear', 'Food', 'Shelter', 'Cook Kit', 'Route', 'Campsite', 'Misc'
      )
    ),
  uploaded_by text not null default 'Jordan',
  created_at timestamp with time zone not null default now()
);

create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('owner', 'editor', 'viewer')),
  created_at timestamp with time zone default now(),
  unique (trip_id, user_id)
);

create or replace function public.is_trip_member(p_trip_id text)
returns boolean
language sql
security definer
stable
set search_path = public
as $function$
  select exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = p_trip_id
      and tm.user_id = auth.uid()
  );
$function$;

create or replace function public.is_trip_owner(p_trip_id text)
returns boolean
language sql
security definer
stable
set search_path = public
as $function$
  select exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = p_trip_id
      and tm.user_id = auth.uid()
      and tm.role = 'owner'
  );
$function$;

create or replace function public.can_edit_trip(p_trip_id text)
returns boolean
language sql
security definer
stable
set search_path = public
as $function$
  select exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = p_trip_id
      and tm.user_id = auth.uid()
      and tm.role in ('owner', 'editor')
  );
$function$;

create or replace function public.user_trip_role(p_trip_id text)
returns text
language sql
security definer
stable
set search_path = public
as $function$
  select role
  from public.trip_members
  where trip_id = p_trip_id
    and user_id = auth.uid()
  limit 1;
$function$;

alter table public.trips enable row level security;
alter table public.weather_current enable row level security;
alter table public.weather_forecast enable row level security;
alter table public.gear_items enable row level security;
alter table public.timeline_events enable row level security;
alter table public.meals enable row level security;
alter table public.crew_members enable row level security;
alter table public.park_intel enable row level security;
alter table public.offline_status enable row level security;
alter table public.astro_data enable row level security;
alter table public.alerts enable row level security;
alter table public.settings enable row level security;
alter table public.prep_feed_items enable row level security;
alter table public.trip_members enable row level security;

create policy tm_select on public.trip_members
  for select using (public.is_trip_member(trip_id));
create policy tm_owner_insert on public.trip_members
  for insert with check (public.is_trip_owner(trip_id));
create policy tm_owner_update on public.trip_members
  for update using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));
create policy tm_owner_delete on public.trip_members
  for delete using (public.is_trip_owner(trip_id));

create policy member_select on public.trips
  for select using (public.is_trip_member(id));
create policy auth_insert_trip on public.trips
  for insert with check (auth.role() = 'authenticated');
create policy editor_update on public.trips
  for update using (public.can_edit_trip(id))
  with check (public.can_edit_trip(id));
create policy owner_delete on public.trips
  for delete using (public.is_trip_owner(id));

create policy member_select on public.alerts
  for select using (public.is_trip_member(trip_id));
create policy editor_insert on public.alerts
  for insert with check (public.can_edit_trip(trip_id));
create policy editor_update on public.alerts
  for update using (public.can_edit_trip(trip_id));
create policy editor_delete on public.alerts
  for delete using (public.can_edit_trip(trip_id));

create policy member_select on public.astro_data
  for select using (public.is_trip_member(trip_id));
create policy editor_insert on public.astro_data
  for insert with check (public.can_edit_trip(trip_id));
create policy editor_update on public.astro_data
  for update using (public.can_edit_trip(trip_id));

create policy member_select on public.crew_members
  for select using (public.is_trip_member(trip_id));
create policy editor_insert on public.crew_members
  for insert with check (public.can_edit_trip(trip_id));
create policy editor_update on public.crew_members
  for update using (public.can_edit_trip(trip_id));
create policy editor_delete on public.crew_members
  for delete using (public.can_edit_trip(trip_id));

create policy member_select on public.gear_items
  for select using (public.is_trip_member(trip_id));
create policy editor_insert on public.gear_items
  for insert with check (public.can_edit_trip(trip_id));
create policy editor_update on public.gear_items
  for update using (public.can_edit_trip(trip_id));
create policy editor_delete on public.gear_items
  for delete using (public.can_edit_trip(trip_id));

create policy member_select on public.meals
  for select using (public.is_trip_member(trip_id));
create policy editor_insert on public.meals
  for insert with check (public.can_edit_trip(trip_id));
create policy editor_update on public.meals
  for update using (public.can_edit_trip(trip_id));
create policy editor_delete on public.meals
  for delete using (public.can_edit_trip(trip_id));

create policy member_select on public.offline_status
  for select using (public.is_trip_member(trip_id));
create policy editor_insert on public.offline_status
  for insert with check (public.can_edit_trip(trip_id));
create policy editor_update on public.offline_status
  for update using (public.can_edit_trip(trip_id));

create policy member_select on public.park_intel
  for select using (public.is_trip_member(trip_id));
create policy editor_insert on public.park_intel
  for insert with check (public.can_edit_trip(trip_id));
create policy editor_update on public.park_intel
  for update using (public.can_edit_trip(trip_id));

create policy member_select on public.prep_feed_items
  for select using (public.is_trip_member(trip_id));
create policy editor_insert on public.prep_feed_items
  for insert with check (public.can_edit_trip(trip_id));
create policy editor_update on public.prep_feed_items
  for update using (public.can_edit_trip(trip_id));
create policy editor_delete on public.prep_feed_items
  for delete using (public.can_edit_trip(trip_id));

create policy member_select on public.settings
  for select using (public.is_trip_member(trip_id));
create policy editor_insert on public.settings
  for insert with check (public.can_edit_trip(trip_id));
create policy editor_update on public.settings
  for update using (public.can_edit_trip(trip_id));

create policy member_select on public.timeline_events
  for select using (public.is_trip_member(trip_id));
create policy editor_insert on public.timeline_events
  for insert with check (public.can_edit_trip(trip_id));
create policy editor_update on public.timeline_events
  for update using (public.can_edit_trip(trip_id));
create policy editor_delete on public.timeline_events
  for delete using (public.can_edit_trip(trip_id));

create policy member_select on public.weather_current
  for select using (public.is_trip_member(trip_id));
create policy member_select on public.weather_forecast
  for select using (public.is_trip_member(trip_id));

insert into storage.buckets (id, name, public)
values ('prep-feed', 'prep-feed', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

create policy member_upload_prep_feed on storage.objects
  for insert with check (
    bucket_id = 'prep-feed'
    and auth.role() = 'authenticated'
    and exists (
      select 1
      from public.trip_members
      where trip_members.trip_id = (storage.foldername(name))[1]
        and trip_members.user_id = auth.uid()
        and trip_members.role in ('owner', 'editor')
    )
  );

create policy member_delete_prep_feed on storage.objects
  for delete using (
    bucket_id = 'prep-feed'
    and exists (
      select 1
      from public.trip_members
      where trip_members.trip_id = (storage.foldername(name))[1]
        and trip_members.user_id = auth.uid()
        and trip_members.role in ('owner', 'editor')
    )
  );

grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant execute on all functions in schema public
  to anon, authenticated, service_role;
