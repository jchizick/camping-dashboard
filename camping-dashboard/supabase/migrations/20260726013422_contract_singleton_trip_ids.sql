-- Contract phase: remove the redundant singleton IDs only after every
-- data-integrity and dependency check passes.

do $guard$
declare
  v_table text;
  v_trip_id text;
  v_count bigint;
  v_table_oid oid;
  v_id_attnum smallint;
  v_object text;
begin
  foreach v_table in array array[
    'settings',
    'park_intel',
    'offline_status',
    'astro_data',
    'weather_current'
  ]
  loop
    select c.oid, a.attnum
    into v_table_oid, v_id_attnum
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relname = v_table
      and a.attname = 'id'
      and not a.attisdropped;

    if v_table_oid is null or v_id_attnum is null then
      raise exception
        'Contract precondition failed: public.%.id is missing',
        v_table;
    end if;

    execute format(
      'select count(*) from public.%I where trip_id is null',
      v_table
    ) into v_count;
    if v_count > 0 then
      raise exception
        'Contract precondition failed: public.% has % null trip_id row(s)',
        v_table,
        v_count;
    end if;

    execute format(
      'select trip_id, count(*) from public.%I group by trip_id having count(*) > 1 limit 1',
      v_table
    ) into v_trip_id, v_count;
    if v_trip_id is not null then
      raise exception
        'Contract precondition failed: public.% has % rows for trip_id %',
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
        'Contract precondition failed: public.% has orphaned trip_id %',
        v_table,
        v_trip_id;
    end if;

    if not exists (
      select 1
      from pg_constraint con
      where con.conrelid = v_table_oid
        and con.contype = 'p'
        and con.conkey = array[v_id_attnum]::smallint[]
    ) then
      raise exception
        'Contract precondition failed: public.%.id is not the expected primary key',
        v_table;
    end if;

    if not exists (
      select 1
      from pg_constraint con
      join pg_attribute a
        on a.attrelid = con.conrelid
       and a.attnum = con.conkey[1]
      where con.conrelid = v_table_oid
        and con.contype = 'u'
        and cardinality(con.conkey) = 1
        and a.attname = 'trip_id'
    ) then
      raise exception
        'Contract precondition failed: public.% lacks singleton uniqueness on trip_id',
        v_table;
    end if;

    if not exists (
      select 1
      from pg_constraint con
      join pg_attribute a
        on a.attrelid = con.conrelid
       and a.attnum = con.conkey[1]
      where con.conrelid = v_table_oid
        and con.contype = 'f'
        and cardinality(con.conkey) = 1
        and a.attname = 'trip_id'
        and con.confrelid = 'public.trips'::regclass
    ) then
      raise exception
        'Contract precondition failed: public.% lacks its trip_id foreign key',
        v_table;
    end if;

    select con.conname
    into v_object
    from pg_constraint con
    where con.contype = 'f'
      and con.confrelid = v_table_oid
      and v_id_attnum = any(con.confkey)
    limit 1;
    if v_object is not null then
      raise exception
        'Contract precondition failed: foreign key % still references public.%.id',
        v_object,
        v_table;
    end if;

    select d.classid::regclass::text || ':' || d.objid::text
    into v_object
    from pg_depend d
    where d.refobjid = v_table_oid
      and d.refobjsubid = v_id_attnum
      and d.classid not in ('pg_attrdef'::regclass, 'pg_constraint'::regclass)
    limit 1;
    if v_object is not null then
      raise exception
        'Contract precondition failed: SQL object % still depends on public.%.id',
        v_object,
        v_table;
    end if;
  end loop;

  select count(*) into v_count
  from public.weather_forecast
  where trip_id is null or forecast_date is null;
  if v_count > 0 then
    raise exception
      'Contract precondition failed: public.weather_forecast has % null trip/date row(s)',
      v_count;
  end if;

  select trip_id, count(*) into v_trip_id, v_count
  from public.weather_forecast
  group by trip_id, forecast_date
  having count(*) > 1
  limit 1;
  if v_trip_id is not null then
    raise exception
      'Contract precondition failed: public.weather_forecast has duplicate trip/date rows for trip_id %',
      v_trip_id;
  end if;

  select wf.trip_id into v_trip_id
  from public.weather_forecast wf
  left join public.trips t on t.id = wf.trip_id
  where t.id is null
  limit 1;
  if v_trip_id is not null then
    raise exception
      'Contract precondition failed: public.weather_forecast has orphaned trip_id %',
      v_trip_id;
  end if;

  select n.nspname || '.' || p.proname
  into v_object
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname not in ('pg_catalog', 'information_schema')
    and p.prokind in ('f', 'p')
    and pg_get_functiondef(p.oid) ~* (
      '(settings|park_intel|offline_status|astro_data|weather_current)[.]id'
      || '|insert[[:space:]]+into[[:space:]]+(public[.])?'
      || '(settings|park_intel|offline_status|astro_data|weather_current)'
      || '[[:space:]]*[(][[:space:]]*id([[:space:]],|[[:space:]]*[)])'
    )
  limit 1;
  if v_object is not null then
    raise exception
      'Contract precondition failed: function % still references a legacy singleton id',
      v_object;
  end if;

  select n.nspname || '.' || c.relname || '.' || t.tgname
  into v_object
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal
    and n.nspname = 'public'
    and c.relname in (
      'settings',
      'park_intel',
      'offline_status',
      'astro_data',
      'weather_current'
    )
    and pg_get_functiondef(p.oid)
      ~* '(^|[^a-z0-9_])id([^a-z0-9_]|$)'
  limit 1;
  if v_object is not null then
    raise exception
      'Contract precondition failed: trigger % still references a legacy singleton id',
      v_object;
  end if;

  select schemaname || '.' || tablename || '.' || policyname
  into v_object
  from pg_policies
  where tablename in (
    'settings',
    'park_intel',
    'offline_status',
    'astro_data',
    'weather_current'
  )
    and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
      ~* '(^|[^a-z0-9_])id([^a-z0-9_]|$)'
  limit 1;
  if v_object is not null then
    raise exception
      'Contract precondition failed: policy % still references a legacy singleton id',
      v_object;
  end if;
end
$guard$;

do $contract$
declare
  v_table text;
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
      'alter table public.%I drop constraint %I',
      v_table,
      v_table || '_pkey'
    );
    execute format(
      'alter table public.%I drop constraint %I',
      v_table,
      v_table || '_trip_id_key'
    );
    execute format(
      'alter table public.%I drop column id',
      v_table
    );
    execute format(
      'alter table public.%I add constraint %I primary key (trip_id)',
      v_table,
      v_table || '_pkey'
    );
  end loop;
end
$contract$;
