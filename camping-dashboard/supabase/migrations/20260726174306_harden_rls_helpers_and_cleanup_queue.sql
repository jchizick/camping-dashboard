-- Keep RLS-only helpers out of the exposed Data API schema, remove the unused
-- role-returning helper, and make the cleanup queue's service-only contract
-- explicit at the privilege layer.

do $guard$
declare
  v_public_policy_count integer;
begin
  if to_regprocedure('public.is_trip_member(text)') is null
     or to_regprocedure('public.is_trip_owner(text)') is null
     or to_regprocedure('public.can_edit_trip(text)') is null
     or to_regprocedure('public.user_trip_role(text)') is null then
    raise exception
      'Security hardening precondition failed: an expected public helper is missing';
  end if;

  if not (
    select bool_and(p.prosecdef)
    from pg_proc p
    where p.oid in (
      'public.is_trip_member(text)'::regprocedure,
      'public.is_trip_owner(text)'::regprocedure,
      'public.can_edit_trip(text)'::regprocedure,
      'public.user_trip_role(text)'::regprocedure
    )
  ) then
    raise exception
      'Security hardening precondition failed: an expected helper is not SECURITY DEFINER';
  end if;

  select count(*)
  into v_public_policy_count
  from pg_policies
  where schemaname = 'public'
    and roles = array['public']::name[];

  if v_public_policy_count <> 40 then
    raise exception
      'Security hardening precondition failed: expected 40 PUBLIC-targeted application policies, found %',
      v_public_policy_count;
  end if;
end
$guard$;

create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated, service_role;

alter function public.is_trip_member(text) set schema app_private;
alter function public.is_trip_owner(text) set schema app_private;
alter function public.can_edit_trip(text) set schema app_private;

alter function app_private.is_trip_member(text) set search_path = '';
alter function app_private.is_trip_owner(text) set search_path = '';
alter function app_private.can_edit_trip(text) set search_path = '';

revoke all on function app_private.is_trip_member(text)
  from public, anon, authenticated, service_role;
revoke all on function app_private.is_trip_owner(text)
  from public, anon, authenticated, service_role;
revoke all on function app_private.can_edit_trip(text)
  from public, anon, authenticated, service_role;

grant execute on function app_private.is_trip_member(text)
  to authenticated, service_role;
grant execute on function app_private.is_trip_owner(text)
  to authenticated, service_role;
grant execute on function app_private.can_edit_trip(text)
  to authenticated, service_role;

-- Every application table is private to signed-in trip members. Restricting
-- the policy targets prevents anonymous requests from evaluating helpers that
-- are intentionally unavailable to the anon role.
do $policies$
declare
  v_policy record;
begin
  for v_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and roles = array['public']::name[]
  loop
    execute format(
      'alter policy %I on %I.%I to authenticated',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  end loop;
end
$policies$;

revoke all on function public.user_trip_role(text)
  from public, anon, authenticated, service_role;
drop function public.user_trip_role(text);

revoke all on table public.prep_feed_storage_cleanup_jobs
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.prep_feed_storage_cleanup_jobs
  to service_role;
