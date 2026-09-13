import {CLI_CODES} from './repairCli.mjs';
// One transition, not a general migration authorization API. No I/O on import.
import {createHash} from 'node:crypto';
import {VERSIONS,POST,POST_SENTINELS,SCHEMA_FINGERPRINT} from './postMigrationContract.mjs';
import {sqlEvidence,projectMatches,provenance,PROTECTED_SCHEMAS} from './sqlIdentity.mjs';
import {describeCatalog,compareCatalogs} from './catalogComparison.mjs';
export const MODE='STAGING_REPAIR_31_TO_32';
export const PRE_REPAIR='POST_MIGRATION_31_PRE_REPAIR';
export const REF='mgnkvfohpqixgacszovv';
export const SOURCE='0c967d5150b8823932725918fcc94d8a6519936a';
export const VERSION='20260912215252';
export const FILE=VERSION+'_normalize_public_function_execute_privileges.sql';
export const FILE_HASH='89ecf52874ef94e893e8377d9a38508096a00eb9208d08f7b9c20e6c28eb4d26';
// Reproduced from fresh repository migrations; every catalog entry remains mandatory.
export const FINAL_MANIFEST_HASH='0f355350ab46bd37233c40eb5597d03637925bbeab524c89d502fbecce62e59b';
export const CA_HASH='700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7';
export const TARGETS=[
 'public.claim_trip_alerts_manual(p_trip_id text, p_worker_id text, p_cooldown_seconds integer, p_stale_after_seconds integer)',
 'public.claim_trip_weather_manual(p_trip_id text, p_worker_id text, p_cooldown_seconds integer, p_stale_after_seconds integer)',
 'public.create_trip(p_name text, p_start_date date, p_end_date date, p_campsite_latitude double precision, p_campsite_longitude double precision, p_park_name text, p_lake_name text, p_site_name text, p_campsite_label text, p_campsite_source text, p_campsite_osm_id text)',
];
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const fail=code=>{throw new Error(code);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function startHistory(history) {
 if(same(history,VERSIONS))fail('REPAIR_ALREADY_COMPLETE');
 if(!same(history,VERSIONS.slice(0,31)))fail('REPAIR_START_HISTORY_MISMATCH');
}
export function migrationBytes(bytes) {if(digest(bytes)!==FILE_HASH)fail('REPAIR_MIGRATION_FILE_MISMATCH');}
export function pendingSet(pending) {if(!same(pending,[VERSION]))fail('REPAIR_PENDING_SET_MISMATCH');}
export function classifyCatalog(snapshot,final=false) {
 const catalog=snapshot.row?.catalog_diagnostic?.catalog;
 let description;
 try {description=describeCatalog(catalog);} catch {fail('REPAIR_CATALOG_PRECONDITION_FAILED');}
 const acl=[];
 for(const key of TARGETS) {
  const grants=description.normalized.filter(e=>e[0]==='function-grant'&&e[1].startsWith(key+'.'));
  const allowed=['postgres','authenticated',...(final?[]:['service_role'])].map(r=>key+'.'+r+'.EXECUTE');
  if(grants.some(e=>!allowed.includes(e[1])||e[2]!==false)||
    !['postgres','authenticated'].every(r=>grants.some(e=>e[1]===key+'.'+r+'.EXECUTE')))fail('REPAIR_UNEXPECTED_ACL');
  const f=snapshot.functions?.find(f=>f.key===key);
  const service=grants.some(e=>e[1]===key+'.service_role.EXECUTE');
  if(!f||f.owner!=='postgres'||f.publicExecute!==false||f.anon!==false||f.authenticated!==true||
    f.service_role!==service||f.authenticatedGrantOption!==false||f.serviceGrantOption!==false)fail('REPAIR_UNEXPECTED_ACL');
  acl.push({key,PUBLIC:false,anon:false,authenticated:true,service_role:service});
 }
 const intended=description.normalized.filter(e=>!(e[0]==='function-grant'&&TARGETS.some(k=>e[1]===k+'.service_role.EXECUTE')));
 if(describeCatalog(intended).fullManifestSha256!==FINAL_MANIFEST_HASH)fail('REPAIR_CATALOG_PRECONDITION_FAILED');
 if(!/^[a-f0-9]{32}$/.test(snapshot.row.post_schema_hash)||snapshot.row.catalog_diagnostic.fingerprint!==snapshot.row.post_schema_hash)
  fail('REPAIR_CATALOG_PRECONDITION_FAILED');
 return {acl,intended,description};
}
export function authorizeStart(mode,ref,bundle,session,now=Date.now()) {
 if(mode!==MODE)fail('REPAIR_MODE_NOT_EXPLICIT');
 // A production-like history fails independently even with a forged staging ref.
 startHistory(bundle?.a?.row?.migration_history);
 if(ref!==REF)fail('REPAIR_TARGET_MISMATCH');
 if(!session||bundle?.session!==session||bundle.source!==SOURCE||bundle.ref!==REF)fail('REPAIR_IDENTITY_REQUIRED');
 const age=now-Date.parse(bundle.timestampUtc);
 if(!Number.isFinite(age)||age<0||age>600000)fail('REPAIR_IDENTITY_STALE');
 if(!projectMatches(bundle.project)||bundle.caHash!==CA_HASH||bundle.tlsVerified!==true)fail('REPAIR_IDENTITY_REQUIRED');
 const p=provenance(bundle.receipt,bundle.host,now);
 if(!p.pooler_tenant_match||!p.api_credentials_project_match)fail('REPAIR_IDENTITY_REQUIRED');
 if(!bundle.b||!same(bundle.a,bundle.b))fail('REPAIR_PROBES_DISAGREE');
 const r=bundle.a.row;
 if(r.database_name!=='postgres'||r.database_user!=='postgres'||r.session_user!=='postgres'||r.read_only!=='on'||
   !/^\d+$/.test(r.system_id??'')||r.system_id!==bundle.independentSystemId||
   !/^[a-f0-9]{32}$/.test(r.schema_hash??'')||Object.values(PROTECTED_SCHEMAS).includes(r.schema_hash))fail('REPAIR_IDENTITY_REQUIRED');
 if(!Object.keys(POST_SENTINELS).every(k=>r.post_sentinels?.[k]===true))fail('REPAIR_SCHEMA_PARTIAL');
 return classifyCatalog(bundle.a);
}
export function verifyAfter(before,after) {
 if(!same(after.row?.migration_history,VERSIONS))fail('REPAIR_POST_HISTORY_FAILED');
 let final;
 try {final=classifyCatalog(after,true);}catch{fail('REPAIR_POST_ACL_FAILED');}
 const metadata=functions=>functions.map(({key,owner,definition})=>({key,owner,definition}));
 if(!same(metadata(before.functions),metadata(after.functions)))fail('REPAIR_POST_ACL_FAILED');
 const intended=classifyCatalog(before).intended;
 if(!compareCatalogs(intended,after.row.catalog_diagnostic.catalog).equivalent)fail('REPAIR_FINAL_CATALOG_FAILED');
 // Existing, unchanged strict final verifier. No second relaxed final state.
 if(after.row.post_schema_hash!==SCHEMA_FINGERPRINT||!sqlEvidence(JSON.stringify(after.row),undefined,POST).passed)
  fail('REPAIR_FINAL_CATALOG_FAILED');
 return final;
}
// All evidence is collected inside this invocation. No on-disk gate can authorize.
export async function runRepair({mode,ref,session,io,now=Date.now,dryRunOnly=false}) {
 if(mode!==MODE)fail('REPAIR_MODE_NOT_EXPLICIT');
 if(ref!==REF)fail('REPAIR_TARGET_MISMATCH');
 migrationBytes(await io.bytes());
 const first=await io.capture(session);
 await io.preserve('before',first.a);
 authorizeStart(mode,ref,first,session,now());
 let pending;
 try {pending=await io.dryRun();}catch(e){fail(CLI_CODES.has(e.message)?e.message:'REPAIR_DRY_RUN_FAILED');}
 pendingSet(pending);
 if(dryRunOnly)return {result:'DRY_RUN_PASS',pending,mutation:false};
 // Fresh A/B, provider and independent cluster checks immediately before mutation.
 const latest=await io.capture(session);
 authorizeStart(mode,ref,latest,session,now());
 if(!same(first.a,latest.a)||first.independentSystemId!==latest.independentSystemId)fail('REPAIR_STATE_CHANGED');
 migrationBytes(await io.bytes());
 try {await io.apply();}catch{fail('REPAIR_APPLY_FAILED');}
 const after=await io.capture(session);
 await io.preserve('after',after.a);
 if(!same(after.a,after.b))fail('REPAIR_PROBES_DISAGREE');
 // Same provenance/freshness and database checks on the post snapshot, without relaxing
 // the repair start gate: validate identity using the unchanged final verifier below.
 const postAge=now()-Date.parse(after.timestampUtc);
 if(after.session!==session||after.source!==SOURCE||after.ref!==REF||!projectMatches(after.project)||
   after.caHash!==CA_HASH||after.tlsVerified!==true||!Number.isFinite(postAge)||postAge<0||postAge>600000||
   !Object.values(provenance(after.receipt,after.host,now())).every(Boolean)||
   after.independentSystemId!==latest.independentSystemId||after.a.row.system_id!==after.independentSystemId)
  fail('REPAIR_IDENTITY_REQUIRED');
 const final=verifyAfter(latest.a,after.a);
 return {result:'PASS',state:POST,history:after.a.row.migration_history,fingerprint:after.a.row.post_schema_hash,acl:final.acl,types:'DOWNSTREAM_GATE_REQUIRED',deploymentAuthorized:false};
}
