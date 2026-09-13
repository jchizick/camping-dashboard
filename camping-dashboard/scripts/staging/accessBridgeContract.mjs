// Explicit staging transition only. Importing this module performs no hosted I/O.
import {createHash} from 'node:crypto';
import {VERSIONS,POST,SCHEMA_FINGERPRINT,SCHEMA_SQL,POST_SENTINELS} from './postMigrationContract.mjs';
import {sqlEvidence,projectMatches,provenance,PROTECTED_SCHEMAS} from './sqlIdentity.mjs';
import {describeCatalog,compareCatalogs} from './catalogComparison.mjs';
import {ACCESS_REMOVAL_VERSIONS,ACCESS_REMOVAL_FINGERPRINT,verifyAccessRemovalSchema} from './accessRemovalContract.mjs';
import {CA_HASH,TARGETS} from './repairContract.mjs';
export {CA_HASH};
export const MODE='STAGING_ACCESS_BRIDGE_32_TO_33',REF='mgnkvfohpqixgacszovv';
export const PRE='POST_MIGRATION_32_PRE_ACCESS_BRIDGE',FINAL='POST_ACCESS_REMOVAL_STAGING_33';
export const VERSION='20260913131931',FILE=VERSION+'_trip_access_removal_bridge.sql';
export const FILE_HASH='635291e2b6b560c3f499d4aa828c28f531eb9e0b10b1069459f10508032e6590';
export const BRIDGE='public.trip_invitation_bridge(p_actor uuid, p_operation text, p_input jsonb)';
export const PRIVATE='app_private.remove_trip_access(p_trip_id text, p_member_id uuid)';
export const PRE_DEFINITION='35cce243c137e92500f48a113350786a12f49fc3241d128841f390c469afe560';
export const FINAL_DEFINITION='cce6bb5918b36a87d4c9ec4a8567ebb3370f35c95a144366be69df23d2e5201c';
export const PRIVATE_DEFINITION='3c1057ec851fa1367eeee25053038877c5085d3511706aa62fe0515f078b1de1';
const MANIFESTS=['0f355350ab46bd37233c40eb5597d03637925bbeab524c89d502fbecce62e59b','da7e8fae024607933de690d833940948d0b141d5ccacd7e7837fd14c6c7fda74'];
export const hash=s=>createHash('sha256').update(s).digest('hex');
export const fail=code=>{throw Error('ACCESS_BRIDGE_'+code);};
export const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function migrationBytes(bytes){if(hash(bytes)!==FILE_HASH)fail('MIGRATION_FILE_MISMATCH');}
export function startHistory(h){if(same(h,ACCESS_REMOVAL_VERSIONS))fail('ALREADY_COMPLETE');if(!same(h,VERSIONS))fail('START_HISTORY_MISMATCH');}
export function pendingSet(p){if(!same(p,[VERSION]))fail('PENDING_SET_MISMATCH');}
export function schema(snapshot,final=false){
 const r=snapshot?.row;
 if(!same(r?.migration_history,final?ACCESS_REMOVAL_VERSIONS:VERSIONS))fail(final?'POST_HISTORY_FAILED':'START_HISTORY_MISMATCH');
 if(!Object.keys(POST_SENTINELS).every(k=>r.post_sentinels?.[k]===true))fail('SCHEMA_PARTIAL');
 let desc;try{desc=describeCatalog(r.catalog_diagnostic?.catalog);}catch{fail('SCHEMA_PARTIAL');}
 for(const [key,pin] of [[BRIDGE,final?FINAL_DEFINITION:PRE_DEFINITION],[PRIVATE,PRIVATE_DEFINITION]]){
  const f=snapshot.functions?.find(x=>x.key===key),row=desc.normalized.find(x=>x[0]==='function'&&x[1]===key);
  if(!f||typeof f.definition!=='string'||hash(f.definition)!==pin||row?.[2]!==f.definition)
   fail(final?'POST_DEFINITION_FAILED':'PRE_DEFINITION_MISMATCH');
  if(f.owner!=='postgres'||f.publicExecute!==false||f.anon!==false||f.authenticated!==false||f.service_role!==true||
   f.authenticatedGrantOption!==false||f.serviceGrantOption!==false||!f.definition.includes("SECURITY DEFINER\n SET search_path TO ''"))fail('UNEXPECTED_GRANT');
 }
 for(const key of TARGETS){const f=snapshot.functions?.find(x=>x.key===key);
  if(!f||f.owner!=='postgres'||f.publicExecute!==false||f.anon!==false||f.authenticated!==true||f.service_role!==false||f.authenticatedGrantOption!==false||f.serviceGrantOption!==false)fail('UNEXPECTED_GRANT');}
 const fingerprint=final?ACCESS_REMOVAL_FINGERPRINT:SCHEMA_FINGERPRINT;
 if(r.post_schema_hash!==fingerprint||r.catalog_diagnostic.fingerprint!==fingerprint||desc.fullManifestSha256!==MANIFESTS[final?1:0])fail(final?'FINAL_CATALOG_FAILED':'PRE_CATALOG_FAILED');
 if(final)verifyAccessRemovalSchema({history:r.migration_history,catalog:r.catalog_diagnostic});
 else if(!sqlEvidence(JSON.stringify(r),undefined,POST).passed)fail('PRE_IDENTITY_FAILED');
 return desc;
}
export function identity(bundle,session,source,now=Date.now()){
 if(bundle?.ref!==REF)fail('TARGET_MISMATCH');
 const age=now-Date.parse(bundle.timestampUtc);
 if(!session||bundle.session!==session||!/^[a-f0-9]{40}$/.test(source??'')||bundle.source!==source)fail('IDENTITY_REQUIRED');
 if(!Number.isFinite(age)||age<0||age>600000)fail('IDENTITY_STALE');
 if(!projectMatches(bundle.project)||bundle.caHash!==CA_HASH||bundle.tlsVerified!==true||!Object.values(provenance(bundle.receipt,bundle.host,now)).every(Boolean))fail('IDENTITY_REQUIRED');
 if(!bundle.a||!bundle.b||!same(bundle.a,bundle.b))fail('PROBES_DISAGREE');
 const r=bundle.a.row;
 if(r.database_name!=='postgres'||r.database_user!=='postgres'||r.session_user!=='postgres'||r.read_only!=='on'||
  !/^\d+$/.test(r.system_id??'')||r.system_id!==bundle.independentSystemId||!/^[a-f0-9]{32}$/.test(r.schema_hash??'')||Object.values(PROTECTED_SCHEMAS).includes(r.schema_hash))fail('IDENTITY_REQUIRED');
}
export function verifyFinal(before,after){
 const final=schema(after,true);schema(before);
 const differences=compareCatalogs(before.row.catalog_diagnostic.catalog,after.row.catalog_diagnostic.catalog).differences;
 if(differences.length!==1||differences[0].kind!=='function'||differences[0].key!==BRIDGE)fail('FINAL_CATALOG_FAILED');
 const rest=s=>s.functions.filter(f=>f.key!==BRIDGE);
 if(!same(rest(before),rest(after)))fail('PRIVATE_OR_OTHER_FUNCTION_CHANGED');
 return final;
}
export async function runAccessBridge({mode,ref,session,source,io,now=Date.now,action='--dry-run'}){
 if(mode!==MODE||!['--dry-run','--apply','--verify'].includes(action))fail('MODE_NOT_EXPLICIT');
 if(ref!==REF)fail('TARGET_MISMATCH');
 migrationBytes(await io.bytes());
 const first=await io.capture(session);identity(first,session,source,now());
 if(action==='--verify'){schema(first.a,true);return {result:'FINAL_33_PASS',state:FINAL,mutation:false,deploymentAuthorized:false};}
 if(same(first.a.row.migration_history,ACCESS_REMOVAL_VERSIONS)){schema(first.a,true);return {result:'ACCESS_BRIDGE_ALREADY_COMPLETE',mutation:false,deploymentAuthorized:false};}
 startHistory(first.a.row.migration_history);schema(first.a);
 let pending;try{pending=await io.pending(first.a);}catch{fail('DRY_RUN_FAILED');}pendingSet(pending);
 const receipt={result:'DRY_RUN_PASS',state:PRE,pending,source,session,timestampUtc:new Date(now()).toISOString(),migrationHash:FILE_HASH,mutation:false,deploymentAuthorized:false};
 await io.preserve(receipt);
 if(action==='--dry-run')return receipt;
 // Apply NEVER reads a saved dry-run receipt; it repeats dry-run in this invocation.
 const latest=await io.capture(session);identity(latest,session,source,now());startHistory(latest.a.row.migration_history);schema(latest.a);
 if(!same(first.a,latest.a)||first.independentSystemId!==latest.independentSystemId)fail('STATE_CHANGED');
 migrationBytes(await io.bytes());pendingSet(await io.pending(latest.a));
 try{await io.apply();}catch{fail('APPLY_FAILED');} // Unknown outcome is never retried.
 const after=await io.capture(session);identity(after,session,source,now());
 if(after.independentSystemId!==latest.independentSystemId)fail('IDENTITY_REQUIRED');
 verifyFinal(latest.a,after.a);
 const result={result:'PASS',state:FINAL,history:after.a.row.migration_history,fingerprint:ACCESS_REMOVAL_FINGERPRINT,mutation:true,types:'HOSTED_DOWNSTREAM_GATE_REQUIRED',deploymentAuthorized:false};
 await io.preserve(result);return result;
}
// Same single transaction for DDL and history. Repeat start guards UNDER a lock,
// closing the gap between read-only probes and actual mutation (including concurrent runs).
export function transactionSql(bytes){
 migrationBytes(bytes);
 const check=`DO $access_gate$ DECLARE target regprocedure; BEGIN
 IF (SELECT coalesce(json_agg(version ORDER BY version)::jsonb,'[]') FROM supabase_migrations.schema_migrations) <> '${JSON.stringify(VERSIONS)}'::jsonb THEN RAISE EXCEPTION 'ACCESS_BRIDGE_START_HISTORY_MISMATCH'; END IF;
 IF (SELECT fingerprint FROM (${SCHEMA_SQL}) c) <> '${SCHEMA_FINGERPRINT}' THEN RAISE EXCEPTION 'ACCESS_BRIDGE_PRE_CATALOG_FAILED'; END IF;
 IF (SELECT proowner FROM pg_proc WHERE oid='public.trip_invitation_bridge(uuid,text,jsonb)'::regprocedure) <> 'postgres'::regrole THEN RAISE EXCEPTION 'ACCESS_BRIDGE_UNEXPECTED_GRANT'; END IF;
 FOREACH target IN ARRAY ARRAY['public.trip_invitation_bridge(uuid,text,jsonb)'::regprocedure,'app_private.remove_trip_access(text,uuid)'::regprocedure] LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND proowner='postgres'::regrole AND prosecdef AND proconfig @> ARRAY['search_path=""'])
 OR has_function_privilege('anon',target,'EXECUTE') OR has_function_privilege('authenticated',target,'EXECUTE')
 OR NOT has_function_privilege('service_role',target,'EXECUTE') OR has_function_privilege('service_role',target,'EXECUTE WITH GRANT OPTION')
 THEN RAISE EXCEPTION 'ACCESS_BRIDGE_UNEXPECTED_GRANT'; END IF;
 END LOOP;
 END $access_gate$;`;
 const body=bytes.toString('utf8');
 if(body.includes('$access_migration$'))fail('MIGRATION_FILE_MISMATCH');
 return `BEGIN; SET LOCAL statement_timeout='30s'; SET LOCAL lock_timeout='10s'; SET LOCAL search_path=public,extensions;
 SELECT pg_advisory_xact_lock(320033); LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;
 ${check}
 ${body}
 INSERT INTO supabase_migrations.schema_migrations(version,statements,name) VALUES ('${VERSION}',ARRAY[$access_migration$${body}$access_migration$],'trip_access_removal_bridge');
 DO $access_final$ BEGIN IF (SELECT fingerprint FROM (${SCHEMA_SQL}) c) <> '${ACCESS_REMOVAL_FINGERPRINT}' THEN RAISE EXCEPTION 'ACCESS_BRIDGE_FINAL_CATALOG_FAILED'; END IF; END $access_final$;
 COMMIT;`;
}
