-- Cover the remaining application-owned foreign keys used by trip cascades,
-- membership lookups, joins, and RLS-heavy access paths.

do $guard$
declare
  v_expected record;
begin
  for v_expected in
    select *
    from (
      values
        ('public.alerts'::regclass, 'alerts_trip_id_fkey', 'trip_id'),
        ('public.crew_members'::regclass, 'crew_members_trip_id_fkey', 'trip_id'),
        ('public.gear_items'::regclass, 'gear_items_trip_id_fkey', 'trip_id'),
        ('public.meals'::regclass, 'meals_trip_id_fkey', 'trip_id'),
        ('public.timeline_events'::regclass, 'timeline_events_trip_id_fkey', 'trip_id'),
        ('public.trip_members'::regclass, 'trip_members_user_id_fkey', 'user_id')
    ) expected(table_oid, constraint_name, column_name)
  loop
    if not exists (
      select 1
      from pg_constraint con
      join pg_attribute att
        on att.attrelid = con.conrelid
       and att.attnum = con.conkey[1]
      where con.conrelid = v_expected.table_oid
        and con.conname = v_expected.constraint_name
        and con.contype = 'f'
        and cardinality(con.conkey) = 1
        and att.attname = v_expected.column_name
    ) then
      raise exception
        'Index migration precondition failed: %.% is not the expected single-column foreign key',
        v_expected.table_oid::regclass,
        v_expected.constraint_name;
    end if;
  end loop;
end
$guard$;

create index alerts_trip_id_idx
  on public.alerts (trip_id);

create index crew_members_trip_id_idx
  on public.crew_members (trip_id);

create index gear_items_trip_id_idx
  on public.gear_items (trip_id);

create index meals_trip_id_idx
  on public.meals (trip_id);

create index timeline_events_trip_id_idx
  on public.timeline_events (trip_id);

create index trip_members_user_id_idx
  on public.trip_members (user_id);
