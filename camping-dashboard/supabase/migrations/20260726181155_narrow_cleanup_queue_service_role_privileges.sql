-- The historical schema baseline granted all table privileges to service_role.
-- Revoke those inherited privileges before granting only the DML operations
-- used by trusted cleanup and deletion routes.

do $guard$
begin
  if not (
    select c.relrowsecurity
    from pg_class c
    where c.oid = 'public.prep_feed_storage_cleanup_jobs'::regclass
  ) then
    raise exception
      'Cleanup queue privilege precondition failed: RLS is not enabled';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'prep_feed_storage_cleanup_jobs'
  ) then
    raise exception
      'Cleanup queue privilege precondition failed: unexpected user policy exists';
  end if;

  if has_table_privilege(
       'anon',
       'public.prep_feed_storage_cleanup_jobs',
       'select,insert,update,delete'
     )
     or has_table_privilege(
       'authenticated',
       'public.prep_feed_storage_cleanup_jobs',
       'select,insert,update,delete'
     ) then
    raise exception
      'Cleanup queue privilege precondition failed: an ordinary role has DML access';
  end if;

  if not has_table_privilege(
    'service_role',
    'public.prep_feed_storage_cleanup_jobs',
    'select,insert,update,delete'
  ) then
    raise exception
      'Cleanup queue privilege precondition failed: service_role lacks required DML';
  end if;
end
$guard$;

revoke all on table public.prep_feed_storage_cleanup_jobs
  from service_role;

grant select, insert, update, delete
  on table public.prep_feed_storage_cleanup_jobs
  to service_role;
