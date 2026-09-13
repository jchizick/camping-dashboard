-- Read-only catalog/effective privilege supplement to the existing identity query.
SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.key COLLATE "C"),'[]') FROM (
 SELECT n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS key,
 r.rolname AS owner, pg_get_functiondef(p.oid) AS definition,
 EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS "publicExecute",
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role,
 has_function_privilege('authenticated',p.oid,'EXECUTE WITH GRANT OPTION') AS "authenticatedGrantOption",
 has_function_privilege('service_role',p.oid,'EXECUTE WITH GRANT OPTION') AS "serviceGrantOption"
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
 WHERE n.nspname IN ('public','app_private') AND p.prokind IN ('f','p')
 AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
) f;
