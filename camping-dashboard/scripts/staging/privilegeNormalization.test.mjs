// Requires the fresh disposable local 32-migration replay. No hosted target accepted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {SCHEMA_SQL,VERSIONS,SCHEMA_FINGERPRINT,schemaState,POST} from './postMigrationContract.mjs';
import {compareCatalogs} from './catalogComparison.mjs';
const migration=readFileSync(new URL('../../supabase/migrations/20260912215252_normalize_public_function_execute_privileges.sql',import.meta.url),'utf8');
const signatures=['public.claim_trip_alerts_manual(text,text,integer,integer)','public.claim_trip_weather_manual(text,text,integer,integer)','public.create_trip(text,date,date,double precision,double precision,text,text,text,text,text,text)'];
const query=sql=>execFileSync('docker',['exec','-i','supabase_db_invitation-phase1-test','psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:sql,encoding:'utf8',timeout:30000}).trim();
import {replayContext} from './replayContext.mjs';
const fresh=replayContext();
test('fresh 32 history, unchanged full catalog and semantic types',()=>{
 assert.deepEqual(fresh.after.history,VERSIONS);assert.equal(fresh.after.history.length,32);
 assert.equal(fresh.after.catalog.fingerprint,SCHEMA_FINGERPRINT);
 assert.equal(fresh.verification.comparison.equivalent,true);assert.equal(fresh.verification.normalizedEquivalent,true);
 assert.equal(fresh.typesBefore,fresh.typesAfter);
 assert.equal(compareCatalogs(fresh.before.catalog.catalog,fresh.after.catalog.catalog).equivalent,true);
});
test('31 migrations cannot pass the new POST history gate',()=>assert.equal(schemaState({migration_history:VERSIONS.slice(0,31)},POST).migration_history_match,false));
for(const profile of ['already-normalized','hosted-three-grants','broad-provider-acl'])test(profile+' normalizes idempotently with all other function metadata/ACLs unchanged',()=>{
  const list=signatures.join(',');
  const simulate=profile==='already-normalized'?'':`GRANT EXECUTE ON FUNCTION ${list} TO service_role;`;
  const broad=profile==='broad-provider-acl'?`GRANT EXECUTE ON FUNCTION ${list} TO PUBLIC,anon; REVOKE EXECUTE ON FUNCTION ${list} FROM authenticated;`:'';
  const sql=`BEGIN;
    CREATE TEMP TABLE normalization_before AS SELECT p.oid,p.proowner,p.proacl,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','app_private') AND p.prokind IN ('f','p');
    ${simulate}${broad}
    DO $$ DECLARE definition text; old_acl aclitem[]; BEGIN
      SELECT pg_get_functiondef(oid),proacl INTO definition,old_acl FROM pg_proc WHERE oid='${signatures[2]}'::regprocedure;
      EXECUTE definition;
      IF (SELECT proacl FROM pg_proc WHERE oid='${signatures[2]}'::regprocedure) IS DISTINCT FROM old_acl THEN RAISE EXCEPTION 'replacement lost ACL'; END IF;
    END $$;
    ${migration}
    ${migration}
    DO $$ DECLARE f regprocedure; BEGIN
      FOREACH f IN ARRAY ARRAY[${signatures.map(s=>`'${s}'::regprocedure`).join(',')}] LOOP
        IF has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('service_role',f,'EXECUTE') OR NOT has_function_privilege('authenticated',f,'EXECUTE') THEN RAISE EXCEPTION 'effective privilege mismatch'; END IF;
        IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=f AND a.grantee IN (0,(SELECT oid FROM pg_roles WHERE rolname='anon'),(SELECT oid FROM pg_roles WHERE rolname='service_role'))) THEN RAISE EXCEPTION 'forbidden explicit ACL'; END IF;
        IF NOT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a JOIN pg_roles r ON r.oid=a.grantee WHERE p.oid=f AND r.rolname='authenticated' AND a.privilege_type='EXECUTE' AND NOT a.is_grantable) THEN RAISE EXCEPTION 'authenticated ACL absent'; END IF;
      END LOOP;
      IF EXISTS(SELECT 1 FROM normalization_before b JOIN pg_proc p ON p.oid=b.oid WHERE p.proowner<>b.proowner OR pg_get_functiondef(p.oid)<>b.definition OR (SELECT array_agg(x::text ORDER BY x::text) FROM unnest(p.proacl) x) IS DISTINCT FROM (SELECT array_agg(x::text ORDER BY x::text) FROM unnest(b.proacl) x)) THEN RAISE EXCEPTION 'definition/owner/ACL changed beyond intended baseline'; END IF;
    END $$;
    SELECT row_to_json(f) FROM (${SCHEMA_SQL}) f;
    ROLLBACK;`;
  const result=JSON.parse(query(sql));assert.equal(result.fingerprint,SCHEMA_FINGERPRINT);assert.equal(compareCatalogs(fresh.before.catalog.catalog,result.catalog).equivalent,true);
});
