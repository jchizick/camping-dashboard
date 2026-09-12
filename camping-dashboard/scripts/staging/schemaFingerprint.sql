-- Catalog only. Stable named objects, no row data, timestamps or object IDs.
-- Includes application-owned public/app_private objects; excludes extension members.
WITH relations AS (
 SELECT c.*,n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','app_private') AND c.relkind IN ('r','p','v','m','S')
 AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
), functions AS (
 SELECT p.*,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','app_private') AND p.prokind IN ('f','p')
 AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
), entries AS (
 SELECT 'relation' kind, nspname||'.'||relname key,
 jsonb_build_array(relkind,relrowsecurity,relforcerowsecurity) value FROM relations
 UNION ALL
 SELECT 'column',r.nspname||'.'||r.relname||'.'||a.attname,
 jsonb_build_array(format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid))
 FROM relations r JOIN pg_attribute a ON a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped
 LEFT JOIN pg_attrdef d ON d.adrelid=r.oid AND d.adnum=a.attnum
 UNION ALL
 SELECT 'constraint',r.nspname||'.'||r.relname||'.'||c.conname,to_jsonb(pg_get_constraintdef(c.oid,false))
 FROM relations r JOIN pg_constraint c ON c.conrelid=r.oid
 UNION ALL
 SELECT 'index',r.nspname||'.'||r.relname||'.'||ic.relname,to_jsonb(pg_get_indexdef(i.indexrelid,0,false))
 FROM relations r JOIN pg_index i ON i.indrelid=r.oid JOIN pg_class ic ON ic.oid=i.indexrelid
 UNION ALL
 SELECT 'trigger',r.nspname||'.'||r.relname||'.'||t.tgname,jsonb_build_array(t.tgenabled,pg_get_triggerdef(t.oid,false))
 FROM relations r JOIN pg_trigger t ON t.tgrelid=r.oid WHERE NOT t.tgisinternal
 UNION ALL
 SELECT 'policy',schemaname||'.'||tablename||'.'||policyname,
 jsonb_build_array(permissive,(SELECT jsonb_agg(role ORDER BY role COLLATE "C") FROM unnest(roles::text[]) role),cmd,qual,with_check)
 FROM pg_policies WHERE schemaname IN ('public','app_private')
 UNION ALL
 SELECT 'function',nspname||'.'||proname||'('||pg_get_function_identity_arguments(oid)||')',to_jsonb(pg_get_functiondef(oid)) FROM functions
 UNION ALL
 SELECT 'relation-grant',r.nspname||'.'||r.relname||'.'||coalesce(g.rolname,'PUBLIC')||'.'||a.privilege_type,to_jsonb(a.is_grantable)
 FROM relations r CROSS JOIN LATERAL aclexplode(coalesce(r.relacl,acldefault(CASE WHEN r.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,r.relowner))) a LEFT JOIN pg_roles g ON g.oid=a.grantee
 UNION ALL
 SELECT 'function-grant',f.nspname||'.'||f.proname||'('||pg_get_function_identity_arguments(f.oid)||').' || coalesce(g.rolname,'PUBLIC')||'.'||a.privilege_type,to_jsonb(a.is_grantable)
 FROM functions f CROSS JOIN LATERAL aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a LEFT JOIN pg_roles g ON g.oid=a.grantee
)
SELECT md5(coalesce(jsonb_agg(jsonb_build_array(kind,key,value) ORDER BY kind COLLATE "C",key COLLATE "C",value::text COLLATE "C")::text,'[]')) AS fingerprint,
 coalesce(jsonb_agg(jsonb_build_array(kind,key,value) ORDER BY kind COLLATE "C",key COLLATE "C",value::text COLLATE "C"),'[]') AS catalog
FROM entries
