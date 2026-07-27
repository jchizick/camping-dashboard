-- Multi-trip, provider-aware alert refresh contract.
--
-- The hosted Cron job is configured separately after staged QA. No endpoint,
-- scheduler secret, or Vault value is stored in this migration.

do $guard$
begin
  if to_regclass('public.alerts') is null
     or to_regclass('public.trips') is null
     or to_regclass('public.trip_members') is null then
    raise exception 'Alert scheduler migration aborted: expected tables are missing';
  end if;
  if to_regprocedure('app_private.is_trip_member(text)') is null
     or to_regprocedure('app_private.can_edit_trip(text)') is null then
    raise exception 'Alert scheduler migration aborted: hardened authorization helpers are missing';
  end if;
  if exists (
    select 1
    from public.alerts a
    where coalesce(a.source, 'manual') <> 'manual'
      and (
        a.trip_id <> 'trip-maple-lake-001'
        or a.source not in ('Ontario Parks', 'Environment Canada')
      )
  ) then
    raise exception
      'Alert scheduler migration aborted: legacy provider rows need explicit mapping';
  end if;
  if exists (
    select 1
    from public.alerts a
    where a.source in ('Ontario Parks', 'Environment Canada')
    group by a.trip_id, a.source
    having count(*) > 1
  ) then
    raise exception
      'Alert scheduler migration aborted: duplicate legacy provider rows are ambiguous';
  end if;
  if exists (
    select 1
    from public.alerts a
    where a.trip_id is null
      or a.title is null
      or a.body is null
      or a.severity is null
      or a.source is null
      or a.is_active is null
      or a.created_at is null
  ) then
    raise exception
      'Alert scheduler migration aborted: incomplete legacy alert rows need review';
  end if;
end
$guard$;

alter table public.trips
  add column country_code text,
  add column region_code text,
  add column park_alert_provider text,
  add column park_alert_external_id text,
  add column weather_alert_provider text,
  add column weather_alert_region_code text;

alter table public.trips
  add constraint trips_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  add constraint trips_region_code_check
    check (region_code is null or region_code ~ '^[A-Z0-9-]{1,12}$'),
  add constraint trips_park_alert_provider_check
    check (park_alert_provider is null or park_alert_provider = 'ontario-parks'),
  add constraint trips_park_alert_external_id_check
    check (
      (park_alert_provider is null and park_alert_external_id is null)
      or
      (
        park_alert_provider = 'ontario-parks'
        and park_alert_external_id ~ '^[a-z0-9-]+/[a-z0-9-]+$'
      )
    ),
  add constraint trips_weather_alert_provider_check
    check (
      weather_alert_provider is null
      or weather_alert_provider = 'environment-canada'
    ),
  add constraint trips_weather_alert_region_code_check
    check (
      (weather_alert_provider is null and weather_alert_region_code is null)
      or
      (
        weather_alert_provider = 'environment-canada'
        and weather_alert_region_code ~ '^[a-z]{2,8}[0-9]{1,5}$'
      )
    );

update public.trips
set country_code = 'CA',
    region_code = 'ON',
    park_alert_provider = 'ontario-parks',
    park_alert_external_id = 'algonquin/backcountry',
    weather_alert_provider = 'environment-canada',
    weather_alert_region_code = 'onrm31'
where id = 'trip-maple-lake-001';

comment on column public.trips.park_alert_external_id is
  'Canonical provider identifier, never inferred from a display name.';
comment on column public.trips.weather_alert_region_code is
  'Canonical Environment Canada feed region; coordinates and labels are not used as substitutes.';

alter table public.alerts
  add column provider text,
  add column external_id text,
  add column category text,
  add column status text,
  add column source_url text,
  add column issued_at timestamp with time zone,
  add column effective_at timestamp with time zone,
  add column expires_at timestamp with time zone,
  add column provider_updated_at timestamp with time zone,
  add column fingerprint text,
  add column dismissed_at timestamp with time zone,
  add column acknowledged_at timestamp with time zone,
  add column last_seen_at timestamp with time zone,
  add column resolved_at timestamp with time zone,
  add column updated_at timestamp with time zone not null default now();

update public.alerts
set provider = case source
      when 'Ontario Parks' then 'ontario-parks'
      when 'Environment Canada' then 'environment-canada'
      else 'manual'
    end,
    external_id = case source
      when 'Ontario Parks' then 'legacy-ontario-parks'
      when 'Environment Canada' then 'legacy-environment-canada'
      else id
    end,
    category = case source
      when 'Environment Canada' then 'weather-alert'
      when 'Ontario Parks' then 'park-advisory'
      else 'manual'
    end,
    status = case when coalesce(is_active, true) then 'active' else 'resolved' end,
    last_seen_at = case
      when source in ('Ontario Parks', 'Environment Canada') then created_at
      else null
    end,
    resolved_at = case when coalesce(is_active, true) then null else created_at end;

alter table public.alerts
  alter column trip_id set not null,
  alter column title set not null,
  alter column body set not null,
  alter column severity set not null,
  alter column source set not null,
  alter column is_active set not null,
  alter column created_at set not null,
  alter column provider set not null,
  alter column external_id set not null,
  alter column category set not null,
  alter column status set not null,
  add constraint alerts_provider_check
    check (provider in ('manual', 'ontario-parks', 'environment-canada')),
  add constraint alerts_external_id_length_check
    check (length(external_id) between 1 and 200),
  add constraint alerts_category_length_check
    check (length(category) between 1 and 64),
  add constraint alerts_status_check
    check (status in ('active', 'updated', 'resolved', 'cancelled', 'expired')),
  add constraint alerts_severity_check
    check (severity in ('info', 'advisory', 'watch', 'warning', 'critical')),
  add constraint alerts_source_url_check
    check (
      source_url is null
      or source_url ~ '^https://(www[.])?(ontarioparks[.]ca|weather[.]gc[.]ca)/'
    ),
  add constraint alerts_fingerprint_check
    check (fingerprint is null or fingerprint ~ '^[0-9a-f]{64}$');

create unique index alerts_trip_provider_external_id_uidx
  on public.alerts (trip_id, provider, external_id);
create index alerts_active_provider_idx
  on public.alerts (trip_id, provider, status, last_seen_at desc)
  where is_active is true;
create index alerts_expiry_idx
  on public.alerts (expires_at, trip_id)
  where is_active is true and expires_at is not null;

create table public.alert_refresh_state (
  trip_id text not null references public.trips(id) on delete cascade,
  provider text not null,
  provider_external_id text not null,
  status text not null default 'idle',
  last_attempt_at timestamp with time zone,
  last_success_at timestamp with time zone,
  next_refresh_at timestamp with time zone not null default now(),
  locked_at timestamp with time zone,
  locked_by text,
  attempt_count integer not null default 0,
  last_error_code text,
  last_error_summary text,
  last_fingerprint text,
  unsupported_reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (trip_id, provider),
  constraint alert_refresh_state_provider_check
    check (provider in ('ontario-parks', 'environment-canada')),
  constraint alert_refresh_state_provider_external_id_check
    check (length(provider_external_id) between 1 and 200),
  constraint alert_refresh_state_status_check
    check (status in ('idle', 'processing', 'retry', 'failed', 'unsupported')),
  constraint alert_refresh_state_attempt_check check (attempt_count between 0 and 3),
  constraint alert_refresh_state_lock_check check (
    (status = 'processing' and locked_at is not null and locked_by is not null)
    or
    (status <> 'processing' and locked_at is null and locked_by is null)
  ),
  constraint alert_refresh_state_worker_check
    check (locked_by is null or length(locked_by) between 1 and 128),
  constraint alert_refresh_state_error_code_check
    check (last_error_code is null or length(last_error_code) between 1 and 64),
  constraint alert_refresh_state_error_summary_check
    check (last_error_summary is null or length(last_error_summary) between 1 and 300),
  constraint alert_refresh_state_fingerprint_check
    check (last_fingerprint is null or last_fingerprint ~ '^[0-9a-f]{64}$')
);

create index alert_refresh_state_due_idx
  on public.alert_refresh_state (next_refresh_at, last_attempt_at, trip_id, provider)
  where status in ('idle', 'retry');
create index alert_refresh_state_stale_lock_idx
  on public.alert_refresh_state (locked_at, trip_id, provider)
  where status = 'processing';
create index alert_refresh_state_failed_idx
  on public.alert_refresh_state (updated_at, trip_id, provider)
  where status = 'failed';

insert into public.alert_refresh_state (trip_id, provider, provider_external_id)
select id, park_alert_provider, park_alert_external_id
from public.trips
where park_alert_provider is not null
  and park_alert_external_id is not null
union all
select id, weather_alert_provider, weather_alert_region_code
from public.trips
where weather_alert_provider is not null
  and weather_alert_region_code is not null;

alter table public.alert_refresh_state enable row level security;
create policy alert_refresh_state_member_select
  on public.alert_refresh_state
  for select to authenticated
  using (app_private.is_trip_member(trip_id));

revoke all on table public.alert_refresh_state
  from public, anon, authenticated, service_role;
grant select on table public.alert_refresh_state to authenticated;
grant select, insert, update, delete on table public.alert_refresh_state to service_role;

create or replace function app_private.sync_trip_alert_states(p_trip_id text)
returns void
language plpgsql
set search_path = ''
as $function$
begin
  insert into public.alert_refresh_state (trip_id, provider, provider_external_id)
  select t.id, v.provider, v.external_id
  from public.trips t
  cross join lateral (
    values
      (t.park_alert_provider, t.park_alert_external_id),
      (t.weather_alert_provider, t.weather_alert_region_code)
  ) v(provider, external_id)
  where t.id = p_trip_id
    and v.provider is not null
    and v.external_id is not null
  on conflict on constraint alert_refresh_state_pkey do update
  set provider_external_id = excluded.provider_external_id,
      status = case
        when public.alert_refresh_state.provider_external_id <> excluded.provider_external_id
          then 'idle'
        else public.alert_refresh_state.status
      end,
      next_refresh_at = case
        when public.alert_refresh_state.provider_external_id <> excluded.provider_external_id
          then now()
        else public.alert_refresh_state.next_refresh_at
      end,
      updated_at = now();

  delete from public.alert_refresh_state s
  where s.trip_id = p_trip_id
    and not exists (
      select 1
      from public.trips t
      cross join lateral (
        values
          (t.park_alert_provider, t.park_alert_external_id),
          (t.weather_alert_provider, t.weather_alert_region_code)
      ) v(provider, external_id)
      where t.id = p_trip_id
        and v.provider = s.provider
        and v.external_id = s.provider_external_id
    );
end
$function$;

revoke all on function app_private.sync_trip_alert_states(text)
  from public, anon, authenticated;
grant execute on function app_private.sync_trip_alert_states(text) to service_role;

create or replace function public.claim_due_trip_alerts(
  p_worker_id text,
  p_batch_size integer default 10,
  p_stale_after_seconds integer default 900
)
returns table (
  trip_id text,
  provider text,
  provider_external_id text,
  country_code text,
  region_code text,
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
    raise exception using errcode = '22023', message = 'Invalid alert claim arguments';
  end if;

  insert into public.alert_refresh_state (trip_id, provider, provider_external_id)
  select t.id, v.provider, v.external_id
  from public.trips t
  cross join lateral (
    values
      (t.park_alert_provider, t.park_alert_external_id),
      (t.weather_alert_provider, t.weather_alert_region_code)
  ) v(provider, external_id)
  where v.provider is not null and v.external_id is not null
  on conflict on constraint alert_refresh_state_pkey do update
  set provider_external_id = excluded.provider_external_id,
      updated_at = now()
  where public.alert_refresh_state.status <> 'processing';

  update public.alert_refresh_state s
  set status = 'failed',
      locked_at = null,
      locked_by = null,
      last_error_code = 'worker_interrupted',
      last_error_summary = 'Worker lock expired after the automatic retry limit.',
      next_refresh_at = now() + interval '8 hours',
      updated_at = now()
  where s.status = 'processing'
    and s.attempt_count >= 3
    and s.locked_at <= now() - make_interval(secs => p_stale_after_seconds);

  return query
  with due as (
    select s.trip_id, s.provider
    from public.alert_refresh_state s
    join public.trips t on t.id = s.trip_id
    where t.start_date is not null
      and t.end_date is not null
      and t.end_date >= t.start_date
      and t.deletion_pending_at is null
      and current_date between t.start_date - 7 and t.end_date + 1
      and s.status <> 'unsupported'
      and s.attempt_count < 3
      and (
        (s.status in ('idle', 'retry') and s.next_refresh_at <= now())
        or (
          s.status = 'processing'
          and s.locked_at <= now() - make_interval(secs => p_stale_after_seconds)
        )
      )
    order by
      case when s.status = 'processing' then s.locked_at else s.next_refresh_at end,
      s.last_attempt_at nulls first,
      s.trip_id,
      s.provider
    for update of s skip locked
    limit p_batch_size
  )
  update public.alert_refresh_state s
  set status = 'processing',
      locked_at = now(),
      locked_by = p_worker_id,
      last_attempt_at = now(),
      attempt_count = s.attempt_count + 1,
      updated_at = now()
  from due
  join public.trips t on t.id = due.trip_id
  where s.trip_id = due.trip_id and s.provider = due.provider
  returning
    s.trip_id,
    s.provider,
    s.provider_external_id,
    t.country_code,
    t.region_code,
    s.attempt_count;
end
$function$;

create or replace function public.claim_trip_alerts_manual(
  p_trip_id text,
  p_worker_id text,
  p_cooldown_seconds integer default 600,
  p_stale_after_seconds integer default 900
)
returns table (
  trip_id text,
  provider text,
  provider_external_id text,
  country_code text,
  region_code text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_trip_id is null
     or p_worker_id is null
     or length(p_worker_id) not between 1 and 128
     or p_cooldown_seconds not between 60 and 3600
     or p_stale_after_seconds not between 60 and 3600 then
    raise exception using errcode = '22023', message = 'Invalid manual alert claim arguments';
  end if;
  if not app_private.can_edit_trip(p_trip_id) then
    raise exception using errcode = '42501', message = 'Trip editor access required';
  end if;

  perform app_private.sync_trip_alert_states(p_trip_id);
  return query
  with claimable as (
    select s.trip_id, s.provider
    from public.alert_refresh_state s
    join public.trips t on t.id = s.trip_id
    where s.trip_id = p_trip_id
      and t.deletion_pending_at is null
      and s.status <> 'unsupported'
      and (
        s.status <> 'processing'
        or s.locked_at <= now() - make_interval(secs => p_stale_after_seconds)
      )
      and (
        s.last_attempt_at is null
        or s.last_attempt_at <= now() - make_interval(secs => p_cooldown_seconds)
      )
    order by s.provider
    for update of s skip locked
  )
  update public.alert_refresh_state s
  set status = 'processing',
      locked_at = now(),
      locked_by = p_worker_id,
      last_attempt_at = now(),
      attempt_count = 1,
      updated_at = now()
  from claimable c
  join public.trips t on t.id = c.trip_id
  where s.trip_id = c.trip_id and s.provider = c.provider
  returning
    s.trip_id,
    s.provider,
    s.provider_external_id,
    t.country_code,
    t.region_code,
    s.attempt_count;
end
$function$;

create or replace function public.persist_trip_alerts(
  p_trip_id text,
  p_provider text,
  p_worker_id text,
  p_payload jsonb
)
returns text
language plpgsql
set search_path = ''
as $function$
declare
  v_state public.alert_refresh_state%rowtype;
  v_fetched_at timestamp with time zone;
  v_result text := 'updated';
begin
  select * into v_state
  from public.alert_refresh_state s
  where s.trip_id = p_trip_id and s.provider = p_provider
  for update;
  if not found or v_state.status <> 'processing' or v_state.locked_by <> p_worker_id then
    raise exception using errcode = '55000', message = 'Alert refresh lock is not held';
  end if;
  if jsonb_typeof(p_payload) <> 'object'
     or p_payload->>'provider' <> p_provider
     or p_payload->>'complete' <> 'true'
     or jsonb_typeof(p_payload->'alerts') <> 'array'
     or coalesce(p_payload->>'fingerprint', '') !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid normalized alert payload';
  end if;
  begin
    v_fetched_at := (p_payload->>'fetchedAt')::timestamp with time zone;
  exception when others then
    raise exception using errcode = '22023', message = 'Invalid alert payload timestamp';
  end;
  if v_fetched_at > now() + interval '5 minutes'
     or v_fetched_at < now() - interval '30 minutes'
     or (v_state.last_success_at is not null and v_fetched_at < v_state.last_success_at) then
    raise exception using errcode = '22000', message = 'Stale alert payload rejected';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_payload->'alerts') as a(
      provider text,
      "externalId" text,
      category text,
      severity text,
      title text,
      summary text,
      details text,
      "sourceUrl" text,
      "issuedAt" text,
      "effectiveAt" text,
      "expiresAt" text,
      "updatedAt" text,
      status text,
      fingerprint text
    )
    where a.provider <> p_provider
      or a."externalId" is null or length(a."externalId") not between 1 and 200
      or a.category is null or length(a.category) not between 1 and 64
      or a.severity not in ('info', 'advisory', 'watch', 'warning', 'critical')
      or a.title is null or length(a.title) not between 1 and 300
      or length(coalesce(a.summary, '')) > 1000
      or a.status not in ('active', 'updated', 'cancelled')
      or a.fingerprint !~ '^[0-9a-f]{64}$'
      or (
        a."sourceUrl" is not null
        and a."sourceUrl" !~ '^https://(www[.])?(ontarioparks[.]ca|weather[.]gc[.]ca)/'
      )
  ) then
    raise exception using errcode = '22023', message = 'Normalized alert item is invalid';
  end if;
  if (
    select count(distinct a."externalId")
    from jsonb_to_recordset(p_payload->'alerts') as a("externalId" text)
  ) <> jsonb_array_length(p_payload->'alerts') then
    raise exception using errcode = '22023', message = 'Duplicate alert identity in payload';
  end if;

  if v_state.last_fingerprint = p_payload->>'fingerprint' then
    v_result := 'unchanged';
  else
    insert into public.alerts (
      trip_id, title, body, severity, source, is_active, provider, external_id,
      category, status, source_url, issued_at, effective_at, expires_at,
      provider_updated_at, fingerprint, last_seen_at, resolved_at, updated_at
    )
    select
      p_trip_id,
      a.title,
      coalesce(a.summary, a.details, ''),
      a.severity,
      case p_provider
        when 'ontario-parks' then 'Ontario Parks'
        when 'environment-canada' then 'Environment Canada'
      end,
      a.status <> 'cancelled',
      p_provider,
      a."externalId",
      a.category,
      case when a.status = 'cancelled' then 'cancelled' else 'active' end,
      a."sourceUrl",
      nullif(a."issuedAt", '')::timestamp with time zone,
      nullif(a."effectiveAt", '')::timestamp with time zone,
      nullif(a."expiresAt", '')::timestamp with time zone,
      nullif(a."updatedAt", '')::timestamp with time zone,
      a.fingerprint,
      v_fetched_at,
      case when a.status = 'cancelled' then v_fetched_at else null end,
      now()
    from jsonb_to_recordset(p_payload->'alerts') as a(
      provider text,
      "externalId" text,
      category text,
      severity text,
      title text,
      summary text,
      details text,
      "sourceUrl" text,
      "issuedAt" text,
      "effectiveAt" text,
      "expiresAt" text,
      "updatedAt" text,
      status text,
      fingerprint text
    )
    on conflict (trip_id, provider, external_id) do update set
      title = excluded.title,
      body = excluded.body,
      severity = excluded.severity,
      source = excluded.source,
      is_active = excluded.is_active,
      category = excluded.category,
      status = excluded.status,
      source_url = excluded.source_url,
      issued_at = excluded.issued_at,
      effective_at = excluded.effective_at,
      expires_at = excluded.expires_at,
      provider_updated_at = excluded.provider_updated_at,
      fingerprint = excluded.fingerprint,
      last_seen_at = excluded.last_seen_at,
      resolved_at = excluded.resolved_at,
      updated_at = excluded.updated_at;

    update public.alerts a
    set is_active = false,
        status = case
          when a.expires_at is not null and a.expires_at <= v_fetched_at then 'expired'
          else 'resolved'
        end,
        resolved_at = v_fetched_at,
        updated_at = now()
    where a.trip_id = p_trip_id
      and a.provider = p_provider
      and a.status in ('active', 'updated')
      and not exists (
        select 1
        from jsonb_to_recordset(p_payload->'alerts') as incoming("externalId" text)
        where incoming."externalId" = a.external_id
      );
  end if;

  update public.alert_refresh_state s
  set status = 'idle',
      last_success_at = v_fetched_at,
      next_refresh_at = now() + interval '6 hours',
      locked_at = null,
      locked_by = null,
      attempt_count = 0,
      last_error_code = null,
      last_error_summary = null,
      last_fingerprint = p_payload->>'fingerprint',
      updated_at = now()
  where s.trip_id = p_trip_id and s.provider = p_provider;
  return v_result;
end
$function$;

create or replace function public.retry_trip_alerts(
  p_trip_id text,
  p_provider text,
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
  if p_error_code is null or length(p_error_code) not between 1 and 64
     or p_error_summary is null or length(p_error_summary) not between 1 and 300 then
    raise exception using errcode = '22023', message = 'Invalid alert retry arguments';
  end if;
  select case s.attempt_count
    when 1 then interval '30 minutes'
    when 2 then interval '2 hours'
    else interval '8 hours'
  end into v_delay
  from public.alert_refresh_state s
  where s.trip_id = p_trip_id and s.provider = p_provider
    and s.status = 'processing' and s.locked_by = p_worker_id;

  update public.alert_refresh_state s
  set status = case when s.attempt_count >= 3 then 'failed' else 'retry' end,
      next_refresh_at = now() + v_delay + make_interval(secs => floor(random() * 301)::integer),
      locked_at = null,
      locked_by = null,
      last_error_code = p_error_code,
      last_error_summary = p_error_summary,
      updated_at = now()
  where s.trip_id = p_trip_id and s.provider = p_provider
    and s.status = 'processing' and s.locked_by = p_worker_id
  returning true into v_updated;
  return coalesce(v_updated, false);
end
$function$;

create or replace function public.fail_trip_alerts(
  p_trip_id text,
  p_provider text,
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
  if p_error_code is null or length(p_error_code) not between 1 and 64
     or p_error_summary is null or length(p_error_summary) not between 1 and 300 then
    raise exception using errcode = '22023', message = 'Invalid alert failure arguments';
  end if;
  update public.alert_refresh_state s
  set status = case
        when p_error_code in ('invalid_provider_configuration', 'provider_rejected')
          then 'unsupported'
        else 'failed'
      end,
      next_refresh_at = now() + interval '8 hours',
      locked_at = null,
      locked_by = null,
      last_error_code = p_error_code,
      last_error_summary = p_error_summary,
      unsupported_reason = case
        when p_error_code in ('invalid_provider_configuration', 'provider_rejected')
          then p_error_code
        else null
      end,
      updated_at = now()
  where s.trip_id = p_trip_id and s.provider = p_provider
    and s.status = 'processing' and s.locked_by = p_worker_id
  returning true into v_updated;
  return coalesce(v_updated, false);
end
$function$;

revoke all on function public.claim_due_trip_alerts(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.claim_trip_alerts_manual(text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.persist_trip_alerts(text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.retry_trip_alerts(text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.fail_trip_alerts(text, text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.claim_due_trip_alerts(text, integer, integer)
  to service_role;
grant execute on function public.persist_trip_alerts(text, text, text, jsonb)
  to service_role;
grant execute on function public.retry_trip_alerts(text, text, text, text, text)
  to service_role;
grant execute on function public.fail_trip_alerts(text, text, text, text, text)
  to service_role;
grant execute on function public.claim_trip_alerts_manual(text, text, integer, integer)
  to authenticated;
