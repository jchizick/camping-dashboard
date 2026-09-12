-- Read-only compact hosted verification; exhaustive contracts stay local.
select 'invitation RLS' as check_name, coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.trip_invitations')),false) as passed
union all select 'limiter RLS', coalesce((select relrowsecurity from pg_class where oid=to_regclass('app_private.invitation_rate_limits')),false)
union all select 'no invitation policies', not exists(select 1 from pg_policies where schemaname='public' and tablename='trip_invitations')
union all select 'delivery fields', (select count(*)=3 from information_schema.columns where table_schema='public' and table_name='trip_invitations' and column_name in ('delivery_state','delivery_attempt_id','delivery_attempt_count'))
union all select 'membership direct writes blocked', not has_table_privilege('authenticated','public.trip_members','INSERT,UPDATE,DELETE,TRUNCATE')
union all select 'hash reads blocked', not has_table_privilege('authenticated','public.trip_invitations','SELECT') and not has_table_privilege('anon','public.trip_invitations','SELECT')
union all select 'bridge service only', has_function_privilege('service_role','public.trip_invitation_bridge(uuid,text,jsonb)','EXECUTE') and not has_function_privilege('authenticated','public.trip_invitation_bridge(uuid,text,jsonb)','EXECUTE') and not has_function_privilege('anon','public.trip_invitation_bridge(uuid,text,jsonb)','EXECUTE')
union all select 'limiter service only', has_function_privilege('service_role','public.consume_invitation_rate_limits(jsonb)','EXECUTE') and not has_function_privilege('authenticated','public.consume_invitation_rate_limits(jsonb)','EXECUTE') and not has_function_privilege('anon','public.consume_invitation_rate_limits(jsonb)','EXECUTE');
