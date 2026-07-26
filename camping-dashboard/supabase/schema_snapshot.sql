-- Deterministic application-owned schema fingerprints.
--
-- Run against local and hosted databases and compare every row. This excludes
-- Supabase-managed internals, owners, OIDs, statistics, and data.
with
columns_snapshot as (
  select jsonb_agg(
    jsonb_build_array(
      c.table_name,
      c.ordinal_position,
      c.column_name,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.column_default
    )
    order by c.table_name, c.ordinal_position
  ) as value
  from information_schema.columns c
  where c.table_schema = 'public'
),
constraints_snapshot as (
  select jsonb_agg(
    jsonb_build_array(
      con.conrelid::regclass::text,
      con.conname,
      con.contype,
      pg_get_constraintdef(con.oid)
    )
    order by con.conrelid::regclass::text, con.conname
  ) as value
  from pg_constraint con
  where con.connamespace = 'public'::regnamespace
),
indexes_snapshot as (
  select jsonb_agg(
    regexp_replace(pg_get_indexdef(i.indexrelid), '\s+', ' ', 'g')
    order by c.relname
  ) as value
  from pg_index i
  join pg_class c on c.oid = i.indexrelid
  join pg_class t on t.oid = i.indrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
),
functions_snapshot as (
  select jsonb_agg(
    jsonb_build_array(
      p.proname,
      pg_get_function_identity_arguments(p.oid),
      pg_get_function_result(p.oid),
      l.lanname,
      p.prosecdef,
      p.provolatile,
      p.proconfig,
      lower(regexp_replace(p.prosrc, '\s+', '', 'g'))
    )
    order by p.proname, pg_get_function_identity_arguments(p.oid)
  ) as value
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname = 'public'
    and p.prokind in ('f', 'p')
),
rls_snapshot as (
  select jsonb_agg(
    jsonb_build_array(c.relname, c.relrowsecurity, c.relforcerowsecurity)
    order by c.relname
  ) as value
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
),
policies_snapshot as (
  select jsonb_agg(
    jsonb_build_array(
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    )
    order by schemaname, tablename, policyname
  ) as value
  from pg_policies
  where schemaname = 'public'
     or (
       schemaname = 'storage'
       and tablename = 'objects'
       and policyname in (
         'member_upload_prep_feed',
         'member_delete_prep_feed'
       )
     )
),
table_grants_snapshot as (
  select jsonb_agg(
    jsonb_build_array(table_name, grantee, privilege_type)
    order by table_name, grantee, privilege_type
  ) as value
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated', 'service_role')
),
function_grants_snapshot as (
  select jsonb_agg(
    jsonb_build_array(
      routine_name,
      grantee,
      privilege_type
    )
    order by routine_name, grantee, privilege_type
  ) as value
  from information_schema.role_routine_grants
  where routine_schema = 'public'
    and grantee in ('anon', 'authenticated', 'service_role')
),
storage_snapshot as (
  select jsonb_agg(
    jsonb_build_array(
      id,
      name,
      public,
      file_size_limit,
      allowed_mime_types
    )
    order by id
  ) as value
  from storage.buckets
  where id = 'prep-feed'
),
extensions_snapshot as (
  select jsonb_agg(extname order by extname) as value
  from pg_extension
  where extname = 'pgcrypto'
),
other_objects_snapshot as (
  select jsonb_build_object(
    'views',
    (
      select coalesce(jsonb_agg(table_name order by table_name), '[]'::jsonb)
      from information_schema.views
      where table_schema = 'public'
    ),
    'sequences',
    (
      select coalesce(jsonb_agg(sequence_name order by sequence_name), '[]'::jsonb)
      from information_schema.sequences
      where sequence_schema = 'public'
    ),
    'triggers',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_array(event_object_table, trigger_name)
          order by event_object_table, trigger_name
        ),
        '[]'::jsonb
      )
      from information_schema.triggers
      where trigger_schema = 'public'
    ),
    'enums',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_array(t.typname, e.enumlabel)
          order by t.typname, e.enumsortorder
        ),
        '[]'::jsonb
      )
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      join pg_enum e on e.enumtypid = t.oid
      where n.nspname = 'public'
    ),
    'realtime_tables',
    (
      select coalesce(
        jsonb_agg(c.relname order by c.relname),
        '[]'::jsonb
      )
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
    )
  ) as value
),
snapshots(category, value) as (
  values
    ('columns', (select value from columns_snapshot)),
    ('constraints', (select value from constraints_snapshot)),
    ('indexes', (select value from indexes_snapshot)),
    ('functions', (select value from functions_snapshot)),
    ('rls', (select value from rls_snapshot)),
    ('policies', (select value from policies_snapshot)),
    ('table_grants', (select value from table_grants_snapshot)),
    ('function_grants', (select value from function_grants_snapshot)),
    ('storage', (select value from storage_snapshot)),
    ('required_extensions', (select value from extensions_snapshot)),
    ('other_objects', (select value from other_objects_snapshot))
)
select
  category,
  case
    when jsonb_typeof(value) = 'array' then jsonb_array_length(value)
    else null
  end as object_count,
  md5(coalesce(value, 'null'::jsonb)::text) as fingerprint
from snapshots
order by category;
