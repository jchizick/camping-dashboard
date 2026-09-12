// Bootstrap-only identity contract. No network or credential access on import.
import {PRE,POST,CURRENT_STATE,POST_SENTINELS,SCHEMA_SQL,schemaState,assertContract,HISTORY_SHA256,SCHEMA_FINGERPRINT,SCHEMA_QUERY_SHA256} from './postMigrationContract.mjs';
export const IDENTITY_VERSION = 3;
export const STAGING_REF = 'mgnkvfohpqixgacszovv';
// Production migration 20260710135251_006_fix_trip_members_rls_recursion.sql.
export const SENTINELS = ['public.trips','public.trip_members','public.gear_items','public.timeline_events'];
// Same information_schema.columns query, captured with read-only catalog access.
export const PROTECTED_SCHEMAS = {
  production:'258535a06b2488fe51a860f007401419',
  our_adventures:'cdfb98ecb45f106052484c60bc86c1da',
};
export function identitySql(state) {
if(![PRE,POST].includes(state)) throw new Error('EXPLICIT_STAGING_STATE_REQUIRED');
assertContract();
return `BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL search_path = public,extensions;
DO $gate$ DECLARE history text; BEGIN
 IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN history := '[]';
 ELSE EXECUTE 'SELECT coalesce(json_agg(version ORDER BY version)::text,''[]'') FROM supabase_migrations.schema_migrations' INTO history;
 END IF;
 PERFORM set_config('staging_gate.history',history,true);
END $gate$;
SELECT json_build_object(
 'migration_history',current_setting('staging_gate.history')::json,
 'post_sentinels',json_build_object(${Object.entries(POST_SENTINELS).map(([s,type])=>`'${s}',to_reg${type}('${s}') IS NOT NULL`).join(',')}),
 'post_schema_hash',${state===POST?`(SELECT fingerprint FROM (${SCHEMA_SQL}) catalog_fingerprint)`:'NULL'},
 'catalog_diagnostic',${state===POST?`(SELECT row_to_json(diagnostic) FROM (${SCHEMA_SQL}) diagnostic)`:'NULL'},
 'database_name',current_database(),'database_user',current_user,'session_user',session_user,
 'system_id',system_identifier::text,'read_only',current_setting('transaction_read_only'),
 'sentinels',json_build_object(${SENTINELS.map(s=>`'${s}',to_regclass('${s}') IS NOT NULL`).join(',')}),
 'schema_hash',(SELECT md5(coalesce(string_agg(table_name||':'||column_name||':'||data_type||':'||is_nullable,E'\\n' ORDER BY table_name,ordinal_position),'')) FROM information_schema.columns WHERE table_schema='public')
) FROM pg_control_system();
COMMIT;`;
}
export const IDENTITY_SQL=identitySql(CURRENT_STATE);
export function backendRole(routingUser) {
  if(routingUser !== `postgres.${STAGING_REF}`) throw new Error('POOLER_TENANT_MISMATCH');
  return routingUser.slice(0,-STAGING_REF.length-1);
}
export function projectMatches(p) {
  return p?.id === STAGING_REF && p?.name === 'field-protocol-staging' &&
    p?.status === 'ACTIVE_HEALTHY' && p?.organization_id === 'qvhhhjlpntbtctqinayz' &&
    p?.database?.host === `db.${STAGING_REF}.supabase.co`;
}
export function provenance(receipt, host, now=Date.now()) {
  const age=now-Date.parse(receipt?.timestampUtc);
  const fresh=Number.isFinite(age)&&age>=0&&age<=600000;
  const common=receipt?.version===2 && receipt?.ready===true &&
    receipt?.ref===STAGING_REF && receipt?.state==='ACTIVE_HEALTHY' && fresh;
  return {
    pooler_tenant_match:common && receipt?.poolerEndpoint===`/projects/${STAGING_REF}/config/database/pooler` &&
      receipt?.poolerStatus===200 && receipt?.host===host && /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host) &&
      receipt?.user===`postgres.${STAGING_REF}` && receipt?.database==='postgres' && receipt?.port===5432,
    api_credentials_project_match:common && receipt?.apiEndpoint===`/projects/${STAGING_REF}/api-keys?reveal=true` &&
      receipt?.apiStatus===200 && ['legacy','modern'].includes(receipt?.generation),
  };
}
export function sqlEvidence(output,routingUser=`postgres.${STAGING_REF}`,state=CURRENT_STATE) {
  const role=backendRole(routingUser);
  let row;
  try {row=JSON.parse(output.trim());} catch {throw new Error('SQL_SESSION_FAILED');}
  if(!row || typeof row!=='object' || Array.isArray(row)) throw new Error('SQL_SESSION_FAILED');
  const schemaValid=typeof row.schema_hash==='string'&&/^[a-f0-9]{32}$/.test(row.schema_hash);
  const protectedMatch=!schemaValid?'unknown':Object.keys(PROTECTED_SCHEMAS).find(k=>PROTECTED_SCHEMAS[k]===row.schema_hash)??'none';
  const checks={
    database_match:row.database_name==='postgres',
    backend_role_match:row.database_user===role,
    session_role_match:row.session_user===role,
    read_only_match:row.read_only==='on',
    system_id_valid:typeof row.system_id==='string'&&/^\d+$/.test(row.system_id),
    ...(state===PRE?{field_protocol_sentinels_absent:SENTINELS.every(s=>row.sentinels?.[s]===false)}:{}),
    protected_schema_match:protectedMatch,
    schema_fingerprint_valid:schemaValid,
  };
  // Only bounded known values are retained. Unexpected values may contain secrets.
  const values={database:row.database_name==='postgres'?'postgres':'unexpected',
    backend_role:row.database_user===role?role:'unexpected',session_role:row.session_user===role?role:'unexpected',
    read_only:['on','off'].includes(row.read_only)?row.read_only:'unexpected'};
  const sentinels=Object.fromEntries(SENTINELS.map(s=>[s,typeof row.sentinels?.[s]==='boolean'?row.sentinels[s]:'unknown']));
  const schema=schemaState(row,state);
  const passed=Object.entries(checks).every(([k,v])=>k==='protected_schema_match'?v==='none':v===true)&&schema.schema_state_code==='OK';
  return {passed,systemId:checks.system_id_valid?row.system_id:null,schemaHash:schemaValid?row.schema_hash:null,
    evidence:{...checks,...schema,values,sentinels}};
}
export function identityVerdict(signals,sql,clusterMatch) {
  const checks={...signals,...sql.evidence,cluster_identity_match:clusterMatch===true};
  const passed=signals.management_project_match===true && signals.pooler_tenant_match===true &&
    signals.api_credentials_project_match===true && signals.tls_verified===true && sql.passed===true && clusterMatch===true;
  return {...checks,final_identity_verdict:passed?'PASS':'FAIL'};
}
export function probesAgree(a,b) {
  return a?.passed===true&&b?.passed===true&&a.systemId===b.systemId&&a.schemaHash===b.schemaHash&&JSON.stringify(a.evidence)===JSON.stringify(b.evidence);
}
export function validIdentityEvidence(e) {
  return e?.final_identity_verdict==='PASS' && e.protected_schema_match==='none' &&
    e.migration_history_sha256===HISTORY_SHA256 && e.post_schema_fingerprint===SCHEMA_FINGERPRINT && e.schema_query_sha256===SCHEMA_QUERY_SHA256 &&
    e.staging_state===POST && e.schema_state_code==='OK' && e.migration_history_match===true &&
    e.post_migration_sentinels_match===true && e.schema_fingerprint_match===true &&
    ['management_project_match','pooler_tenant_match','api_credentials_project_match','tls_verified','database_match',
     'backend_role_match','session_role_match','read_only_match','system_id_valid',
     'schema_fingerprint_valid','cluster_identity_match'].every(key=>e[key]===true);
}
