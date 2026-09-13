import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {MODE,REF,SOURCE,FILE,TARGETS,CA_HASH,runRepair,authorizeStart,verifyAfter,pendingSet,migrationBytes,FINAL_MANIFEST_HASH} from './repairContract.mjs';
import {parsePending,runHostedRepair} from './repairTransport.mjs';
import {repairBundle} from './fixtures/repair.mjs';
import {replayContext} from './replayContext.mjs';
import {POST,VERSIONS,SCHEMA_FINGERPRINT,authorizeMigrationAction} from './postMigrationContract.mjs';
import {describeCatalog} from './catalogComparison.mjs';
const fresh=replayContext();
const before=fresh.repair.before,after=fresh.repair.after;
const bytes=readFileSync(new URL('../../supabase/migrations/'+FILE,import.meta.url));
const session='unit-session',now=Date.now();
function bundle(){return repairBundle(before,session,now);}
function mutateSnapshot(b,fn){fn(b.a);b.b=structuredClone(b.a);}
function harness(change=b=>b){
 let applies=0,captures=0;
 const io={bytes:async()=>bytes,preserve:async()=>{},dryRun:async()=>[VERSIONS.at(-1)],
  capture:async()=>{captures++;return change(repairBundle(applies?after:before,session,now),captures);},
  apply:async()=>{applies++;}};
 return {io,get applies(){return applies;}};
}
test('fresh local repair used real migration list, dry-run and a single CLI apply',()=>{
 assert.equal(fresh.repair.dry.result,'DRY_RUN_PASS');assert.equal(fresh.repair.result.state,POST);
 assert.equal(fresh.repair.applyCount,1);assert.equal(fresh.repair.repeated,'REPAIR_ALREADY_COMPLETE');
 assert.deepEqual(before.row.migration_history,VERSIONS.slice(0,31));assert.deepEqual(after.row.migration_history,VERSIONS);
 assert.equal(after.row.post_schema_hash,SCHEMA_FINGERPRINT);
 assert.equal(describeCatalog(after.row.catalog_diagnostic.catalog).fullManifestSha256,FINAL_MANIFEST_HASH);
 assert.equal(fresh.verification.comparison.equivalent,true);assert.equal(fresh.verification.normalizedEquivalent,true);
});
test('valid synthetic control-plane plus real local catalog passes the explicit transition',async()=>{
 const h=harness();const r=await runRepair({mode:MODE,ref:REF,session,io:h.io,now:()=>now});
 assert.equal(r.result,'PASS');assert.equal(h.applies,1);assert.equal(r.deploymentAuthorized,false);
});
test('dry-only never applies',async()=>{const h=harness();assert.equal((await runRepair({mode:MODE,ref:REF,session,io:h.io,dryRunOnly:true,now:()=>now})).result,'DRY_RUN_PASS');assert.equal(h.applies,0);});
for(const mode of [undefined,'verify','plan','apply','repair-31-to-32'])test('implicit/generic mode rejected: '+mode,async()=>{
 const h=harness();await assert.rejects(runRepair({mode,ref:REF,session,io:h.io}),/REPAIR_MODE_NOT_EXPLICIT/);assert.equal(h.applies,0);
});
for(const ref of ['gdsmyxzqtmhwbcyobzou','rmfhueseulevyvetblnn','abcdefghijklmnopqrst'])test('protected/wrong ref '+ref,async()=>{
 const h=harness();await assert.rejects(runRepair({mode:MODE,ref,session,io:h.io}),/REPAIR_TARGET_MISMATCH/);assert.equal(h.applies,0);
});
const cases=[
 ['production28',b=>mutateSnapshot(b,s=>s.row.migration_history=VERSIONS.slice(0,28)),'REPAIR_START_HISTORY_MISMATCH'],
 ['partial30',b=>mutateSnapshot(b,s=>s.row.migration_history=VERSIONS.slice(0,30)),'REPAIR_START_HISTORY_MISMATCH'],
 ['wrong31st',b=>mutateSnapshot(b,s=>s.row.migration_history[30]='20260911164430'),'REPAIR_START_HISTORY_MISMATCH'],
 ['reordered',b=>mutateSnapshot(b,s=>s.row.migration_history.reverse()),'REPAIR_START_HISTORY_MISMATCH'],
 ['unknownextra',b=>mutateSnapshot(b,s=>s.row.migration_history.push('20990101000000')),'REPAIR_START_HISTORY_MISMATCH'],
 ['already32',b=>mutateSnapshot(b,s=>s.row.migration_history=VERSIONS),'REPAIR_ALREADY_COMPLETE'],
 ['sentinel',b=>mutateSnapshot(b,s=>s.row.post_sentinels['public.trip_invitations']=false),'REPAIR_SCHEMA_PARTIAL'],
 ['PUBLIC',b=>mutateSnapshot(b,s=>s.row.catalog_diagnostic.catalog.push(['function-grant',TARGETS[0]+'.PUBLIC.EXECUTE',false])),'REPAIR_UNEXPECTED_ACL'],
 ['anon',b=>mutateSnapshot(b,s=>s.row.catalog_diagnostic.catalog.push(['function-grant',TARGETS[0]+'.anon.EXECUTE',false])),'REPAIR_UNEXPECTED_ACL'],
 ['unknownrole',b=>mutateSnapshot(b,s=>s.row.catalog_diagnostic.catalog.push(['function-grant',TARGETS[0]+'.unknown.EXECUTE',false])),'REPAIR_UNEXPECTED_ACL'],
 ['grantoption',b=>mutateSnapshot(b,s=>s.row.catalog_diagnostic.catalog.find(e=>e[1]===TARGETS[0]+'.authenticated.EXECUTE')[2]=true),'REPAIR_UNEXPECTED_ACL'],
 ['effective inheritance',b=>mutateSnapshot(b,s=>s.functions.find(f=>f.key===TARGETS[0]).anon=true),'REPAIR_UNEXPECTED_ACL'],
 ['wrong catalog component',b=>mutateSnapshot(b,s=>s.row.catalog_diagnostic.catalog.find(e=>e[0]==='column')[2][1]=false),'REPAIR_CATALOG_PRECONDITION_FAILED'],
 ['missing A',b=>delete b.a,'REPAIR_START_HISTORY_MISMATCH'],
 ['missing B',b=>delete b.b,'REPAIR_PROBES_DISAGREE'],
 ['different B',b=>b.b.row.system_id='77','REPAIR_PROBES_DISAGREE'],
 ['expired evidence',b=>b.timestampUtc=new Date(now-600001).toISOString(),'REPAIR_IDENTITY_STALE'],
 ['future evidence',b=>b.timestampUtc=new Date(now+1).toISOString(),'REPAIR_IDENTITY_STALE'],
 ['expired provenance',b=>b.receipt.timestampUtc=new Date(now-600001).toISOString(),'REPAIR_IDENTITY_REQUIRED'],
 ['session mismatch',b=>b.session='old-session','REPAIR_IDENTITY_REQUIRED'],
 ['source mismatch',b=>b.source='old-source','REPAIR_IDENTITY_REQUIRED'],
 ['project mismatch',b=>b.project.id='gdsmyxzqtmhwbcyobzou','REPAIR_IDENTITY_REQUIRED'],
 ['paused metadata',b=>b.project.status='INACTIVE','REPAIR_IDENTITY_REQUIRED'],
 ['CA mismatch',b=>b.caHash='0'.repeat(64),'REPAIR_IDENTITY_REQUIRED'],
 ['TLS missing',b=>b.tlsVerified=false,'REPAIR_IDENTITY_REQUIRED'],
 ['independent identity mismatch',b=>b.independentSystemId='123','REPAIR_IDENTITY_REQUIRED'],
 ['pooler provenance mismatch',b=>b.receipt.user='postgres.wrong','REPAIR_IDENTITY_REQUIRED'],
 ['key provenance missing',b=>b.receipt.apiStatus=403,'REPAIR_IDENTITY_REQUIRED'],
 ['protected schema',b=>mutateSnapshot(b,s=>s.row.schema_hash='258535a06b2488fe51a860f007401419'),'REPAIR_IDENTITY_REQUIRED'],
 ['wrong role',b=>mutateSnapshot(b,s=>s.row.database_user='service_role'),'REPAIR_IDENTITY_REQUIRED'],
 ['read write session',b=>mutateSnapshot(b,s=>s.row.read_only='off'),'REPAIR_IDENTITY_REQUIRED'],
];
for(const [name,change,code] of cases)test('refuses '+name+' before mutation',async()=>{
 const h=harness(b=>{change(b);return b;});
 await assert.rejects(runRepair({mode:MODE,ref:REF,session,io:h.io,now:()=>now}),new RegExp(code));assert.equal(h.applies,0);
});
test('production28 fails history independently of target guard',()=>{const b=bundle();mutateSnapshot(b,s=>s.row.migration_history=VERSIONS.slice(0,28));assert.throws(()=>authorizeStart(MODE,'gdsmyxzqtmhwbcyobzou',b,session,now),/REPAIR_START_HISTORY_MISMATCH/);});
test('safer partially normalized service grants accepted',()=>{
 const b=bundle();mutateSnapshot(b,s=>{s.row.catalog_diagnostic.catalog=s.row.catalog_diagnostic.catalog.filter(e=>e[1]!==TARGETS[0]+'.service_role.EXECUTE');s.functions.find(f=>f.key===TARGETS[0]).service_role=false;});
 assert.equal(authorizeStart(MODE,REF,b,session,now).acl[0].service_role,false);
});
test('already normalized ACL at 31 is safe',()=>{const b=bundle();b.a=structuredClone(after);b.a.row.migration_history=VERSIONS.slice(0,31);b.b=structuredClone(b.a);assert.ok(authorizeStart(MODE,REF,b,session,now));});
for(const pending of [[],['20260911164431',VERSIONS.at(-1)],['20990101000000']])test('pending set '+JSON.stringify(pending),async()=>{
 const h=harness();h.io.dryRun=async()=>pending;await assert.rejects(runRepair({mode:MODE,ref:REF,session,io:h.io,now:()=>now}),/REPAIR_PENDING_SET_MISMATCH/);assert.equal(h.applies,0);
});
test('modified migration bytes refused',async()=>{const h=harness();h.io.bytes=async()=>Buffer.concat([bytes,Buffer.from('\n')]);await assert.rejects(runRepair({mode:MODE,ref:REF,session,io:h.io}),/REPAIR_MIGRATION_FILE_MISMATCH/);assert.equal(h.applies,0);});
test('file rechecked immediately before apply',async()=>{const h=harness();let calls=0;h.io.bytes=async()=>++calls===1?bytes:Buffer.from('changed');await assert.rejects(runRepair({mode:MODE,ref:REF,session,io:h.io,now:()=>now}),/REPAIR_MIGRATION_FILE_MISMATCH/);assert.equal(h.applies,0);});
test('fresh evidence mandatory again after dry-run',async()=>{const h=harness((b,n)=>{if(n===2)b.timestampUtc=new Date(now-600001).toISOString();return b;});await assert.rejects(runRepair({mode:MODE,ref:REF,session,io:h.io,now:()=>now}),/REPAIR_IDENTITY_STALE/);assert.equal(h.applies,0);});
test('state change after dry-run refuses mutation',async()=>{const h=harness((b,n)=>{if(n===2){mutateSnapshot(b,s=>{s.row.catalog_diagnostic.catalog=s.row.catalog_diagnostic.catalog.filter(e=>e[1]!==TARGETS[0]+'.service_role.EXECUTE');s.functions.find(f=>f.key===TARGETS[0]).service_role=false;});}return b;});await assert.rejects(runRepair({mode:MODE,ref:REF,session,io:h.io,now:()=>now}),/REPAIR_STATE_CHANGED/);assert.equal(h.applies,0);});
test('dry-run errors sanitized',async()=>{const h=harness();h.io.dryRun=async()=>{throw Error('SECRET');};await assert.rejects(runRepair({mode:MODE,ref:REF,session,io:h.io}),/^Error: REPAIR_DRY_RUN_FAILED$/);assert.equal(h.applies,0);});
test('known CLI causes survive without permitting apply',async()=>{for(const code of ['REPAIR_TIMEOUT','REPAIR_MIGRATION_LIST_PARSE_FAILED','REPAIR_TLS_FAILED']){const h=harness();h.io.dryRun=async()=>{throw Error(code);};await assert.rejects(runRepair({mode:MODE,ref:REF,session,io:h.io}),new RegExp('^Error: '+code+'$'));assert.equal(h.applies,0);}});
test('apply errors never retry',async()=>{const h=harness();let attempts=0;h.io.apply=async()=>{attempts++;throw Error('SECRET');};await assert.rejects(runRepair({mode:MODE,ref:REF,session,io:h.io}),/^Error: REPAIR_APPLY_FAILED$/);assert.equal(attempts,1);});
test('post history mismatch blocks final handoff',()=>{const s=structuredClone(after);s.row.migration_history=VERSIONS.slice(0,31);assert.throws(()=>verifyAfter(before,s),/REPAIR_POST_HISTORY_FAILED/);});
test('post owner/body change blocks handoff',()=>{for(const key of ['owner','definition']){const s=structuredClone(after);s.functions[0][key]='changed';assert.throws(()=>verifyAfter(before,s),/REPAIR_POST_ACL_FAILED/);}});
test('post catalog hash must satisfy unchanged final verifier',()=>{const s=structuredClone(after);s.row.post_schema_hash='0'.repeat(32);s.row.catalog_diagnostic.fingerprint=s.row.post_schema_hash;assert.throws(()=>verifyAfter(before,s),/REPAIR_FINAL_CATALOG_FAILED/);});
test('normal plan/apply remain rejected',()=>{for(const action of ['plan','apply'])assert.throws(()=>authorizeMigrationAction(action),/POST_MIGRATION_VERIFY_ONLY/);});
test('hosted adapter cannot be invoked as a bare apply/plan',async()=>{for(const [mode,action] of [[undefined,undefined],['apply','--apply'],['plan','--dry-run'],[MODE,undefined]])await assert.rejects(runHostedRepair(mode,action,{}),/REPAIR_MODE_NOT_EXPLICIT/);});
test('hosted entry rejects protected targets before credentials or network',async()=>{for(const ref of ['gdsmyxzqtmhwbcyobzou','rmfhueseulevyvetblnn','wrong'])await assert.rejects(runHostedRepair(MODE,'--apply',{STAGING_REF:ref}),/REPAIR_TARGET_MISMATCH/);});
test('new CLI default and generic actions fail before credentials/network',()=>{for(const args of [[],['plan'],['apply'],[MODE]]){assert.throws(()=>execFileSync(process.execPath,[fileURLToPath(new URL('./repair-31-to-32.mjs',import.meta.url)),...args],{encoding:'utf8',stdio:'pipe'}),e=>e.stdout.includes('REPAIR_MODE_NOT_EXPLICIT'));}});
test('strict list and dry-run parser',()=>{const list=VERSIONS.map((v,i)=>` ${v} | ${i<31?v:''} | date`).join('\n');assert.deepEqual(parsePending(list,'Would push these migrations:\n • '+FILE),[VERSIONS.at(-1)]);assert.throws(()=>parsePending(list,'No pending'),/REPAIR_DRY_RUN_PARSE_FAILED/);assert.throws(()=>parsePending(list,FILE+'\n20270101000000_unexpected.sql'),/REPAIR_PENDING_SET_MISMATCH/);});
test('CLI JSON list mode has the same exact-set guard',()=>{const list=JSON.stringify({migrations:VERSIONS.map((v,i)=>({local:v,remote:i<31?v:''}))});assert.deepEqual(parsePending(list+'\nConnecting to local database...',FILE),[VERSIONS.at(-1)]);assert.throws(()=>parsePending('{"migrations":[]}',FILE),/REPAIR_PENDING_SET_MISMATCH/);});
test('reviewed bytes and fixed source pin',()=>{migrationBytes(bytes);pendingSet([VERSIONS.at(-1)]);assert.equal(SOURCE,'0c967d5150b8823932725918fcc94d8a6519936a');assert.equal(CA_HASH.length,64);});
