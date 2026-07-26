-- Multi-trip weather refresh state and atomic persistence contract.
--
-- Scheduling is configured separately after hosted QA. This migration contains
-- no Cron job, endpoint URL, or secret.

do $guard$
begin
  if to_regclass('public.weather_current') is null
     or to_regclass('public.weather_forecast') is null
     or to_regclass('public.trips') is null
     or to_regclass('public.trip_members') is null then
    raise exception
      'Weather scheduler migration aborted: expected weather or trip tables are missing';
  end if;

  if to_regprocedure('app_private.is_trip_member(text)') is null
     or to_regprocedure('app_private.can_edit_trip(text)') is null then
    raise exception
      'Weather scheduler migration aborted: hardened trip authorization helpers are missing';
  end if;
end
$guard$;

create table public.weather_refresh_state (
  trip_id text primary key
    references public.trips(id) on delete cascade,
  status text not null default 'idle',
  last_attempt_at timestamp with time zone,
  last_success_at timestamp with time zone,
  next_refresh_at timestamp with time zone not null default now(),
  locked_at timestamp with time zone,
  locked_by text,
  attempt_count integer not null default 0,
  last_error_code text,
  last_error_summary text,
  provider text,
  provider_timezone text,
  utc_offset_seconds integer,
  source_observed_at timestamp with time zone,
  provider_generated_at timestamp with time zone,
  request_fingerprint text,
  payload_fingerprint text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint weather_refresh_state_status_check
    check (status in ('idle', 'refreshing', 'retry', 'failed')),
  constraint weather_refresh_state_attempt_count_check
    check (attempt_count between 0 and 3),
  constraint weather_refresh_state_lock_check
    check (
      (status = 'refreshing' and locked_at is not null and locked_by is not null)
      or
      (status <> 'refreshing' and locked_at is null and locked_by is null)
    ),
  constraint weather_refresh_state_worker_length_check
    check (locked_by is null or length(locked_by) between 1 and 128),
  constraint weather_refresh_state_error_code_length_check
    check (last_error_code is null or length(last_error_code) between 1 and 64),
  constraint weather_refresh_state_error_summary_length_check
    check (last_error_summary is null or length(last_error_summary) between 1 and 300),
  constraint weather_refresh_state_provider_length_check
    check (provider is null or length(provider) between 1 and 64),
  constraint weather_refresh_state_timezone_length_check
    check (provider_timezone is null or length(provider_timezone) between 1 and 128),
  constraint weather_refresh_state_utc_offset_check
    check (utc_offset_seconds is null or utc_offset_seconds between -50400 and 50400),
  constraint weather_refresh_state_request_fingerprint_check
    check (request_fingerprint is null or request_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint weather_refresh_state_payload_fingerprint_check
    check (payload_fingerprint is null or payload_fingerprint ~ '^[0-9a-f]{64}$')
);

comment on table public.weather_refresh_state is
  'Per-trip operational state for scheduled and manual weather refreshes. Content remains in weather_current and weather_forecast.';

create index weather_refresh_state_due_idx
  on public.weather_refresh_state (next_refresh_at, last_attempt_at, trip_id)
  where status in ('idle', 'retry');

create index weather_refresh_state_stale_lock_idx
  on public.weather_refresh_state (locked_at, trip_id)
  where status = 'refreshing';

create index weather_refresh_state_failed_idx
  on public.weather_refresh_state (updated_at, trip_id)
  where status = 'failed';

insert into public.weather_refresh_state (
  trip_id,
  status,
  last_success_at,
  next_refresh_at,
  provider,
  source_observed_at
)
select
  t.id,
  'idle',
  wc.updated_at,
  coalesce(wc.updated_at + interval '6 hours', now()),
  case when wc.trip_id is null then null else 'open-meteo' end,
  wc.updated_at
from public.trips t
left join public.weather_current wc on wc.trip_id = t.id
on conflict (trip_id) do nothing;

alter table public.weather_refresh_state enable row level security;

create policy weather_refresh_state_member_select
  on public.weather_refresh_state
  for select
  to authenticated
  using (app_private.is_trip_member(trip_id));

revoke all on table public.weather_refresh_state
  from public, anon, authenticated, service_role;
grant select on table public.weather_refresh_state to authenticated;
grant select, insert, update, delete
  on table public.weather_refresh_state to service_role;

create or replace function app_private.weather_local_date(
  p_timezone text,
  p_now timestamp with time zone
)
returns date
language sql
stable
set search_path = ''
as $function$
  select (p_now at time zone coalesce(p_timezone, 'UTC'))::date
$function$;

revoke all on function app_private.weather_local_date(text, timestamp with time zone)
  from public, anon, authenticated, service_role;
grant execute on function app_private.weather_local_date(text, timestamp with time zone)
  to service_role;

create or replace function app_private.weather_refresh_interval(
  p_start_date date,
  p_end_date date,
  p_local_date date
)
returns interval
language sql
immutable
set search_path = ''
as $function$
  select case
    when p_start_date is null or p_end_date is null or p_end_date < p_start_date
      then interval '6 hours'
    when p_local_date between p_start_date and p_end_date
      then interval '2 hours'
    when p_start_date between p_local_date and p_local_date + 2
      then interval '3 hours'
    else interval '6 hours'
  end
$function$;

revoke all on function app_private.weather_refresh_interval(date, date, date)
  from public, anon, authenticated, service_role;
grant execute on function app_private.weather_refresh_interval(date, date, date)
  to service_role;

create or replace function public.claim_due_trip_weather(
  p_worker_id text,
  p_batch_size integer default 10,
  p_stale_after_seconds integer default 900
)
returns table (
  trip_id text,
  latitude double precision,
  longitude double precision,
  timezone text,
  attempt_count integer
)
language plpgsql
set search_path = ''
as $function$
begin
  if p_worker_id is null
     or length(p_worker_id) not between 1 and 128
     or p_batch_size not between 1 and 25
     or p_stale_after_seconds not between 60 and 3600 then
    raise exception using
      errcode = '22023',
      message = 'Invalid weather claim arguments';
  end if;

  insert into public.weather_refresh_state (trip_id)
  select t.id from public.trips t
  on conflict on constraint weather_refresh_state_pkey do nothing;

  update public.weather_refresh_state s
  set status = 'failed',
      locked_at = null,
      locked_by = null,
      last_error_code = 'worker_interrupted',
      last_error_summary = 'Worker lock expired after the automatic retry limit.',
      next_refresh_at = now() + interval '6 hours',
      updated_at = now()
  where s.status = 'refreshing'
    and s.attempt_count >= 3
    and s.locked_at <= now() - make_interval(secs => p_stale_after_seconds);

  return query
  with due as (
    select s.trip_id
    from public.weather_refresh_state s
    join public.trips t on t.id = s.trip_id
    cross join lateral (
      select app_private.weather_local_date(s.provider_timezone, now()) as local_date
    ) d
    where t.campsite_latitude between -90 and 90
      and t.campsite_longitude between -180 and 180
      and t.start_date is not null
      and t.end_date is not null
      and t.end_date >= t.start_date
      and t.deletion_pending_at is null
      and d.local_date between (t.start_date - 4) and t.end_date
      and s.attempt_count < 3
      and (
        (s.status in ('idle', 'retry') and s.next_refresh_at <= now())
        or
        (
          s.status = 'refreshing'
          and s.locked_at <= now() - make_interval(secs => p_stale_after_seconds)
        )
      )
    order by
      case when s.status = 'refreshing' then s.locked_at else s.next_refresh_at end,
      s.last_attempt_at nulls first,
      s.trip_id
    for update of s skip locked
    limit p_batch_size
  )
  update public.weather_refresh_state s
  set status = 'refreshing',
      locked_at = now(),
      locked_by = p_worker_id,
      last_attempt_at = now(),
      attempt_count = s.attempt_count + 1,
      updated_at = now()
  from due
  join public.trips t on t.id = due.trip_id
  where s.trip_id = due.trip_id
  returning
    s.trip_id,
    t.campsite_latitude,
    t.campsite_longitude,
    s.provider_timezone,
    s.attempt_count;
end
$function$;

create or replace function public.claim_trip_weather_manual(
  p_trip_id text,
  p_worker_id text,
  p_cooldown_seconds integer default 600,
  p_stale_after_seconds integer default 900
)
returns table (
  trip_id text,
  latitude double precision,
  longitude double precision,
  timezone text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_trip_id is null
     or p_worker_id is null
     or length(p_worker_id) not between 1 and 128
     or p_cooldown_seconds not between 60 and 3600
     or p_stale_after_seconds not between 60 and 3600 then
    raise exception using errcode = '22023', message = 'Invalid manual weather claim arguments';
  end if;
  if not app_private.can_edit_trip(p_trip_id) then
    raise exception using errcode = '42501', message = 'Trip editor access required';
  end if;

  insert into public.weather_refresh_state (trip_id)
  values (p_trip_id)
  on conflict on constraint weather_refresh_state_pkey do nothing;

  return query
  update public.weather_refresh_state s
  set status = 'refreshing',
      locked_at = now(),
      locked_by = p_worker_id,
      last_attempt_at = now(),
      attempt_count = 1,
      updated_at = now()
  from public.trips t
  where s.trip_id = p_trip_id
    and t.id = s.trip_id
    and t.campsite_latitude between -90 and 90
    and t.campsite_longitude between -180 and 180
    and t.deletion_pending_at is null
    and (
      s.status <> 'refreshing'
      or s.locked_at <= now() - make_interval(secs => p_stale_after_seconds)
    )
    and (
      s.last_attempt_at is null
      or s.last_attempt_at <= now() - make_interval(secs => p_cooldown_seconds)
    )
  returning
    s.trip_id,
    t.campsite_latitude,
    t.campsite_longitude,
    s.provider_timezone,
    s.attempt_count;
end
$function$;

create or replace function public.persist_trip_weather(
  p_trip_id text,
  p_worker_id text,
  p_payload jsonb
)
returns text
language plpgsql
set search_path = ''
as $function$
declare
  v_state public.weather_refresh_state%rowtype;
  v_trip public.trips%rowtype;
  v_current jsonb;
  v_requested_at timestamp with time zone;
  v_source_observed_at timestamp with time zone;
  v_provider_generated_at timestamp with time zone;
  v_timezone text;
  v_local_date date;
  v_interval interval;
  v_result text := 'updated';
begin
  select * into v_state
  from public.weather_refresh_state s
  where s.trip_id = p_trip_id
  for update;

  if not found
     or v_state.status <> 'refreshing'
     or v_state.locked_by <> p_worker_id then
    raise exception using errcode = '55000', message = 'Weather refresh lock is not held';
  end if;

  select * into v_trip
  from public.trips t
  where t.id = p_trip_id
  for share;

  if not found
     or v_trip.campsite_latitude not between -90 and 90
     or v_trip.campsite_longitude not between -180 and 180
     or v_trip.deletion_pending_at is not null then
    raise exception using errcode = '23514', message = 'Trip is not weather refreshable';
  end if;

  if jsonb_typeof(p_payload) <> 'object'
     or jsonb_typeof(p_payload->'current') <> 'object'
     or jsonb_typeof(p_payload->'daily') <> 'array'
     or jsonb_array_length(p_payload->'daily') <> 5
     or coalesce(p_payload->>'provider', '') !~ '^[a-z0-9-]{1,64}$'
     or coalesce(p_payload->>'requestFingerprint', '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_payload->>'fingerprint', '') !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid normalized weather payload';
  end if;

  begin
    v_requested_at := (p_payload->>'requestedAt')::timestamp with time zone;
    v_source_observed_at := (p_payload->>'sourceObservedAt')::timestamp with time zone;
    v_provider_generated_at := nullif(p_payload->>'providerGeneratedAt', '')::timestamp with time zone;
  exception when others then
    raise exception using errcode = '22023', message = 'Invalid weather payload timestamps';
  end;

  v_timezone := p_payload->>'timezone';
  if not exists (
    select 1 from pg_catalog.pg_timezone_names z where z.name = v_timezone
  ) then
    raise exception using errcode = '22023', message = 'Invalid weather provider timezone';
  end if;

  if v_state.last_success_at is not null
     and v_requested_at < v_state.last_success_at then
    raise exception using errcode = '22000', message = 'Stale weather payload rejected';
  end if;

  v_current := p_payload->'current';
  if nullif(v_current->>'temperatureC', '') is null
     or nullif(v_current->>'weatherCode', '') is null
     or nullif(v_current->>'conditionLabel', '') is null
     or nullif(v_current->>'icon', '') is null then
    raise exception using errcode = '22023', message = 'Current weather is incomplete';
  end if;

  if v_requested_at > now() + interval '5 minutes'
     or v_requested_at < now() - interval '30 minutes'
     or v_source_observed_at > now() + interval '1 hour'
     or v_source_observed_at < now() - interval '2 days'
     or (v_current->>'temperatureC')::numeric not between -100 and 70
     or (v_current->>'weatherCode')::integer not between 0 and 99
     or nullif(v_current->>'windKph', '')::numeric < 0
     or nullif(v_current->>'humidity', '')::integer not between 0 and 100
     or nullif(v_current->>'rainChance', '')::integer not between 0 and 100
     or nullif(v_current->>'visibilityMeters', '')::integer < 0 then
    raise exception using errcode = '22023', message = 'Current weather values are invalid';
  end if;

  v_local_date := app_private.weather_local_date(v_timezone, v_source_observed_at);
  begin
    if exists (
      select 1
      from jsonb_to_recordset(p_payload->'daily') as d(
        forecast_date date,
        high_c numeric,
        low_c numeric,
        condition_label text,
        rain_chance integer,
        wind_kph numeric,
        icon text
      )
      where d.forecast_date is null
        or d.condition_label is null
        or length(d.condition_label) = 0
        or d.icon is null
        or length(d.icon) = 0
        or d.high_c not between -100 and 70
        or d.low_c not between -100 and 70
        or d.rain_chance not between 0 and 100
        or d.wind_kph < 0
    )
    or (
      select count(distinct d.forecast_date)
      from jsonb_to_recordset(p_payload->'daily') as d(forecast_date date)
    ) <> 5
    or (
      select min(d.forecast_date)
      from jsonb_to_recordset(p_payload->'daily') as d(forecast_date date)
    ) <> v_local_date
    or (
      select max(d.forecast_date)
      from jsonb_to_recordset(p_payload->'daily') as d(forecast_date date)
    ) <> v_local_date + 4 then
      raise exception using errcode = '22023', message = 'Daily weather payload is invalid';
    end if;
  exception
    when sqlstate '22023' then raise;
    when others then
      raise exception using errcode = '22023', message = 'Daily weather payload is invalid';
  end;

  if v_state.payload_fingerprint = p_payload->>'fingerprint' then
    v_result := 'unchanged';
  else
    insert into public.weather_current (
      trip_id,
      temperature_c,
      wind_kph,
      humidity,
      rain_chance,
      sunset_time,
      sunrise_time,
      moonset_time,
      condition_label,
      icon,
      visibility,
      updated_at
    )
    values (
      p_trip_id,
      (v_current->>'temperatureC')::numeric,
      nullif(v_current->>'windKph', '')::numeric,
      nullif(v_current->>'humidity', '')::integer,
      nullif(v_current->>'rainChance', '')::integer,
      nullif(v_current->>'sunsetTime', ''),
      nullif(v_current->>'sunriseTime', ''),
      null,
      v_current->>'conditionLabel',
      v_current->>'icon',
      nullif(v_current->>'visibilityMeters', '')::integer,
      v_source_observed_at
    )
    on conflict (trip_id) do update set
      temperature_c = excluded.temperature_c,
      wind_kph = excluded.wind_kph,
      humidity = excluded.humidity,
      rain_chance = excluded.rain_chance,
      sunset_time = excluded.sunset_time,
      sunrise_time = excluded.sunrise_time,
      moonset_time = excluded.moonset_time,
      condition_label = excluded.condition_label,
      icon = excluded.icon,
      visibility = excluded.visibility,
      updated_at = excluded.updated_at;

    delete from public.weather_forecast f where f.trip_id = p_trip_id;

    insert into public.weather_forecast (
      id,
      trip_id,
      forecast_date,
      high_c,
      low_c,
      condition_label,
      rain_chance,
      wind_kph,
      icon
    )
    select
      p_trip_id || '-' || d.forecast_date,
      p_trip_id,
      d.forecast_date,
      d.high_c,
      d.low_c,
      d.condition_label,
      d.rain_chance,
      d.wind_kph,
      d.icon
    from jsonb_to_recordset(p_payload->'daily') as d(
      forecast_date date,
      high_c numeric,
      low_c numeric,
      condition_label text,
      rain_chance integer,
      wind_kph numeric,
      icon text
    );

    if (select count(*) from public.weather_forecast f where f.trip_id = p_trip_id)
       <> jsonb_array_length(p_payload->'daily') then
      raise exception using errcode = '22023', message = 'Daily weather payload is incomplete';
    end if;
  end if;

  v_local_date := app_private.weather_local_date(v_timezone, now());
  v_interval := app_private.weather_refresh_interval(
    v_trip.start_date,
    v_trip.end_date,
    v_local_date
  );

  update public.weather_refresh_state s
  set status = 'idle',
      last_success_at = now(),
      next_refresh_at = now() + v_interval,
      locked_at = null,
      locked_by = null,
      attempt_count = 0,
      last_error_code = null,
      last_error_summary = null,
      provider = p_payload->>'provider',
      provider_timezone = v_timezone,
      utc_offset_seconds = nullif(p_payload->>'utcOffsetSeconds', '')::integer,
      source_observed_at = v_source_observed_at,
      provider_generated_at = v_provider_generated_at,
      request_fingerprint = p_payload->>'requestFingerprint',
      payload_fingerprint = p_payload->>'fingerprint',
      updated_at = now()
  where s.trip_id = p_trip_id;

  return v_result;
end
$function$;

create or replace function public.retry_trip_weather(
  p_trip_id text,
  p_worker_id text,
  p_error_code text,
  p_error_summary text
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_updated boolean;
  v_delay interval;
begin
  if p_error_code is null
     or length(p_error_code) not between 1 and 64
     or p_error_summary is null
     or length(p_error_summary) not between 1 and 300 then
    raise exception using errcode = '22023', message = 'Invalid weather retry arguments';
  end if;

  select case s.attempt_count
    when 1 then interval '15 minutes'
    when 2 then interval '1 hour'
    else interval '6 hours'
  end
  into v_delay
  from public.weather_refresh_state s
  where s.trip_id = p_trip_id
    and s.status = 'refreshing'
    and s.locked_by = p_worker_id;

  update public.weather_refresh_state s
  set status = case when s.attempt_count >= 3 then 'failed' else 'retry' end,
      next_refresh_at = now() + v_delay
        + make_interval(secs => floor(random() * 61)::integer),
      locked_at = null,
      locked_by = null,
      last_error_code = p_error_code,
      last_error_summary = p_error_summary,
      updated_at = now()
  where s.trip_id = p_trip_id
    and s.status = 'refreshing'
    and s.locked_by = p_worker_id
  returning true into v_updated;

  return coalesce(v_updated, false);
end
$function$;

create or replace function public.fail_trip_weather(
  p_trip_id text,
  p_worker_id text,
  p_error_code text,
  p_error_summary text
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_updated boolean;
begin
  if p_error_code is null
     or length(p_error_code) not between 1 and 64
     or p_error_summary is null
     or length(p_error_summary) not between 1 and 300 then
    raise exception using errcode = '22023', message = 'Invalid weather failure arguments';
  end if;

  update public.weather_refresh_state s
  set status = 'failed',
      next_refresh_at = now() + interval '6 hours',
      locked_at = null,
      locked_by = null,
      last_error_code = p_error_code,
      last_error_summary = p_error_summary,
      updated_at = now()
  where s.trip_id = p_trip_id
    and s.status = 'refreshing'
    and s.locked_by = p_worker_id
  returning true into v_updated;

  return coalesce(v_updated, false);
end
$function$;

revoke all on function public.claim_due_trip_weather(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.persist_trip_weather(text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.retry_trip_weather(text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.fail_trip_weather(text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.claim_trip_weather_manual(text, text, integer, integer)
  from public, anon, authenticated;

grant execute on function public.claim_due_trip_weather(text, integer, integer)
  to service_role;
grant execute on function public.persist_trip_weather(text, text, jsonb)
  to service_role;
grant execute on function public.retry_trip_weather(text, text, text, text)
  to service_role;
grant execute on function public.fail_trip_weather(text, text, text, text)
  to service_role;
grant execute on function public.claim_trip_weather_manual(text, text, integer, integer)
  to authenticated;
