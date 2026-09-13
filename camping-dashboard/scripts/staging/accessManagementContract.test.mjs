import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {repairBundle} from './fixtures/repair.mjs';
import {ACCESS_REMOVAL_VERSIONS as VERSIONS} from './accessRemovalContract.mjs';
import {sourcePath} from './paths.mjs';
import {authorizeMigrationAction} from './postMigrationContract.mjs';
import {accessManagementInventory} from './accessManagementInventory.mjs';
import {MODE,FINAL_VERSIONS,REF,BRIDGE,PRIVATE,runAccessManagement,startHistory,schema,transactionSql} from './accessManagementContract.mjs';
import {runHostedAccessManagement} from './accessManagementTransport.mjs';
import {sourceFiles,requireCommittedSource} from './accessManagementSource.mjs';
if(!process.env.ACCESS_MANAGEMENT_LOCAL_FIXTURE)throw Error('RUN_VALIDATE_ACCESS_MANAGEMENT_FOR_FRESH_LOCAL_FIXTURE');
const {before,after,source}=JSON.parse(readFileSync(process.env.ACCESS_MANAGEMENT_LOCAL_FIXTURE,'utf8'));
const bytes=accessManagementInventory(sourcePath()).at(-1).bytes,session='synthetic-current-session',now=Date.now();
const bundle=s=>({...repairBundle(s,session,now),source});
function harness(change=()=>{}){let applied=0,captured=0;const io={types:async()=>({normalizedEquivalent:true,structuralEquivalent:true}),bytes:async()=>bytes,preserve:async()=>{},pending:async()=>[FINAL_VERSIONS.at(-1)],apply:async()=>{applied++;},capture:async()=>{const b=bundle(applied?after:before);change(b,++captured);return b;}};return {io,get applied(){return applied;}};}
const run=(h,options={})=>runAccessManagement({mode:MODE,ref:REF,session,source,io:h.io,action:'--apply',now:()=>now,...options});
const changeSnapshot=(b,fn)=>{fn(b.a);b.b=structuredClone(b.a);};
test('fresh replay produced exact start and final contracts',()=>{schema(before);schema(after,true);assert.deepEqual(before.row.migration_history,VERSIONS);assert.deepEqual(after.row.migration_history,FINAL_VERSIONS);});
test('dry-run has zero writes',async()=>{const h=harness();assert.equal((await run(h,{action:'--dry-run'})).result,'DRY_RUN_PASS');assert.equal(h.applied,0);});
test('apply performs exactly one write after fresh in-process dry-run',async()=>{const h=harness();assert.equal((await run(h)).state,'POST_ACCESS_MANAGEMENT_STAGING_34');assert.equal(h.applied,1);});
test('already complete is structured and never reapplies',async()=>{const h=harness(b=>{b.a=structuredClone(after);b.b=structuredClone(after);});assert.equal((await run(h)).result,'ACCESS_MANAGEMENT_ALREADY_COMPLETE');assert.equal(h.applied,0);});
test('final-only verifier cannot pass 32',async()=>{const h=harness();await assert.rejects(run(h,{action:'--verify'}),/POST_HISTORY_FAILED/);assert.equal(h.applied,0);});
for(const mode of [undefined,'plan','apply','STAGING_REPAIR_31_TO_32'])test('explicit mode required '+mode,async()=>{const h=harness();await assert.rejects(run(h,{mode}),/MODE_NOT_EXPLICIT/);assert.equal(h.applied,0);});
for(const ref of ['gdsmyxzqtmhwbcyobzou','rmfhueseulevyvetblnn','abcdefghijklmnopqrst'])test('protected or wrong target '+ref,async()=>{const h=harness();await assert.rejects(run(h,{ref}),/TARGET_MISMATCH/);assert.equal(h.applied,0);await assert.rejects(runHostedAccessManagement(MODE,'--apply',{STAGING_REF:ref}),/TARGET_MISMATCH/);});
const cases=[
 ['production28',b=>changeSnapshot(b,s=>s.row.migration_history=VERSIONS.slice(0,28)),'START_HISTORY_MISMATCH'],
 ['32',b=>changeSnapshot(b,s=>s.row.migration_history=VERSIONS.slice(0,32)),'START_HISTORY_MISMATCH'],
 ['wrong33',b=>changeSnapshot(b,s=>s.row.migration_history[31]='20990101000000'),'START_HISTORY_MISMATCH'],
 ['reordered',b=>changeSnapshot(b,s=>s.row.migration_history.reverse()),'START_HISTORY_MISMATCH'],
 ['extra',b=>changeSnapshot(b,s=>s.row.migration_history.push('20990101000000')),'START_HISTORY_MISMATCH'],
 ['sentinel',b=>changeSnapshot(b,s=>s.row.post_sentinels['public.trip_invitations']=false),'SCHEMA_PARTIAL'],
 ['predefinition',b=>changeSnapshot(b,s=>s.functions.find(f=>f.key===BRIDGE).definition+='changed'),'PRE_DEFINITION_MISMATCH'],
 ['private body',b=>changeSnapshot(b,s=>s.functions.find(f=>f.key===PRIVATE).definition+='changed'),'PRE_DEFINITION_MISMATCH'],
 ['catalog',b=>changeSnapshot(b,s=>s.row.post_schema_hash='0'.repeat(32)),'PRE_CATALOG_FAILED'],
 ['catalog component',b=>changeSnapshot(b,s=>s.row.catalog_diagnostic.catalog.find(e=>e[0]==='column')[2][1]=false),'PRE_CATALOG_FAILED'],
 ['PUBLIC grant',b=>changeSnapshot(b,s=>s.functions.find(f=>f.key===BRIDGE).publicExecute=true),'UNEXPECTED_GRANT'],
 ['inherited anon',b=>changeSnapshot(b,s=>s.functions.find(f=>f.key===BRIDGE).anon=true),'UNEXPECTED_GRANT'],
 ['owner',b=>changeSnapshot(b,s=>s.functions.find(f=>f.key===PRIVATE).owner='authenticated'),'UNEXPECTED_GRANT'],
 ['missing B',b=>delete b.b,'PROBES_DISAGREE'],
 ['disagree',b=>b.b.row.system_id='123','PROBES_DISAGREE'],
 ['stale',b=>b.timestampUtc=new Date(now-600001).toISOString(),'IDENTITY_STALE'],
 ['future',b=>b.timestampUtc=new Date(now+1).toISOString(),'IDENTITY_STALE'],
 ['old session',b=>b.session='historical','IDENTITY_REQUIRED'],
 ['source',b=>b.source='b'.repeat(40),'IDENTITY_REQUIRED'],
 ['paused',b=>b.project.status='INACTIVE','IDENTITY_REQUIRED'],
 ['management ref',b=>b.project.id='gdsmyxzqtmhwbcyobzou','IDENTITY_REQUIRED'],
 ['provenance age',b=>b.receipt.timestampUtc=new Date(now-600001).toISOString(),'IDENTITY_REQUIRED'],
 ['credential receipt',b=>b.receipt.apiStatus=403,'IDENTITY_REQUIRED'],
 ['pooler receipt',b=>b.receipt.user='postgres.wrong','IDENTITY_REQUIRED'],
 ['CA',b=>b.caHash='0'.repeat(64),'IDENTITY_REQUIRED'],
 ['TLS',b=>b.tlsVerified=false,'IDENTITY_REQUIRED'],
 ['cluster',b=>b.independentSystemId='123','IDENTITY_REQUIRED'],
 ['protected schema',b=>changeSnapshot(b,s=>s.row.schema_hash='258535a06b2488fe51a860f007401419'),'IDENTITY_REQUIRED'],
 ['SQL role',b=>changeSnapshot(b,s=>s.row.database_user='service_role'),'IDENTITY_REQUIRED'],
 ['SQL readwrite',b=>changeSnapshot(b,s=>s.row.read_only='off'),'IDENTITY_REQUIRED'],
];
for(const [name,fn,code] of cases)test('refuses '+name,async()=>{const h=harness(fn);await assert.rejects(run(h),new RegExp(code));assert.equal(h.applied,0);});
test('28 independently fails start history',()=>assert.throws(()=>startHistory(VERSIONS.slice(0,28)),/START_HISTORY_MISMATCH/));
for(const pending of [[],['20260912215252','20260913131931'],['20990101000000']])test('exact pending '+pending,async()=>{const h=harness();h.io.pending=async()=>pending;await assert.rejects(run(h),/PENDING_SET_MISMATCH/);assert.equal(h.applied,0);});
test('altered bytes never mutate',async()=>{const h=harness();h.io.bytes=async()=>Buffer.concat([bytes,Buffer.from('\n')]);await assert.rejects(run(h),/MIGRATION_FILE_MISMATCH/);assert.equal(h.applied,0);});
test('changed bytes immediately before apply denied',async()=>{const h=harness();let n=0;h.io.bytes=async()=>++n===1?bytes:Buffer.from('changed');await assert.rejects(run(h),/MIGRATION_FILE_MISMATCH/);assert.equal(h.applied,0);});
test('stale second capture cannot authorize',async()=>{const h=harness((b,n)=>{if(n===2)b.timestampUtc=new Date(now-600001).toISOString();});await assert.rejects(run(h),/IDENTITY_STALE/);assert.equal(h.applied,0);});
test('changed cluster between captures denied',async()=>{const h=harness((b,n)=>{if(n===2){b.a.row.system_id='999';b.b=structuredClone(b.a);b.independentSystemId='999';}});await assert.rejects(run(h),/STATE_CHANGED/);assert.equal(h.applied,0);});
for(const [name,fn,code] of [
 ['post history',s=>s.row.migration_history=VERSIONS,'POST_HISTORY_FAILED'],
 ['post definition',s=>s.functions.find(f=>f.key===BRIDGE).definition+='changed','POST_DEFINITION_FAILED'],
 ['post grant',s=>s.functions.find(f=>f.key===PRIVATE).authenticated=true,'UNEXPECTED_GRANT'],
 ['post catalog',s=>s.row.catalog_diagnostic.catalog.find(e=>e[0]==='column')[2][1]=false,'FINAL_CATALOG_FAILED'],
])test(name+' blocks handoff',async()=>{const h=harness((b,n)=>{if(n===3)changeSnapshot(b,fn);});await assert.rejects(run(h),new RegExp(code));assert.equal(h.applied,1);});
test('unknown apply outcome is sanitized and never retried',async()=>{const h=harness();let n=0;h.io.apply=async()=>{n++;throw Error('SECRET');};await assert.rejects(run(h),/^Error: ACCESS_MANAGEMENT_APPLY_FAILED$/);assert.equal(n,1);});
test('dry-run failure sanitized',async()=>{const h=harness();h.io.pending=async()=>{throw Error('SECRET');};await assert.rejects(run(h),/^Error: ACCESS_MANAGEMENT_DRY_RUN_FAILED$/);assert.equal(h.applied,0);});
test('transaction has one fixed migration, atomic history, lock and rollback guards',()=>{const s=transactionSql(bytes);assert.equal((s.match(/INSERT INTO supabase_migrations.schema_migrations/g)||[]).length,1);assert.ok(s.indexOf('pg_advisory_xact_lock')<s.indexOf(bytes.toString()));assert.ok(s.includes('ACCESS_MANAGEMENT_START_HISTORY_MISMATCH'));assert.ok(s.endsWith('COMMIT;'));assert.throws(()=>transactionSql(Buffer.from('arbitrary')),/MIGRATION_FILE_MISMATCH/);});
test('generic mutation remains disabled',()=>{for(const a of ['plan','apply'])assert.throws(()=>authorizeMigrationAction(a),/VERIFY_ONLY/);});
test('source closure includes migrations, types and SQL without ignored artifacts',()=>{const paths=sourceFiles();assert.ok(paths.includes('scripts/staging/schemaFingerprint.sql'));assert.ok(paths.includes('src/types/supabase.ts'));assert.equal(paths.filter(p=>p.startsWith('supabase/migrations/')).length,34);assert.ok(paths.every(p=>!p.startsWith('output/')));});
test('hosted source cannot run without explicit approved commit',()=>assert.throws(()=>requireCommittedSource(),/APPROVED_SOURCE_REQUIRED/));
function gitFixture(alter=(name,bytes)=>bytes){return args=>{
 if(args[0]==='rev-parse')return Buffer.from(args[1]==='HEAD'?source:'');
 const name=args[1].slice(source.length+1);return alter(name,readFileSync(sourcePath(name)));
};}
test('committed dependency closure is reproducible without a real Git fixture commit',()=>assert.equal(requireCommittedSource(source,sourcePath(),gitFixture()),source));
test('untracked dependency cannot authorize',()=>assert.throws(()=>requireCommittedSource(source,sourcePath(),gitFixture(()=>{throw Error('not committed');})),/SOURCE_NOT_COMMITTED/));
test('modified committed dependency cannot authorize',()=>assert.throws(()=>requireCommittedSource(source,sourcePath(),gitFixture((name,b)=>name.endsWith('accessManagementTransport.mjs')?Buffer.from('changed'):b)),/UNCOMMITTED_DEPENDENCY/));
test('migration blob must itself be the exact reviewed bytes',()=>assert.throws(()=>requireCommittedSource(source,sourcePath(),gitFixture((name,b)=>name.endsWith('trip_access_management_read.sql')?Buffer.concat([b,Buffer.from('\n')]):b)),/MIGRATION_FILE_MISMATCH/));
test('bare CLI and aliases reject without network',()=>{const cli=fileURLToPath(new URL('./access-management-33-to-34.mjs',import.meta.url));for(const args of [[],['plan'],['apply'],[MODE]])assert.throws(()=>execFileSync(process.execPath,[cli,...args],{stdio:'pipe'}),e=>String(e.stdout).includes('MODE_NOT_EXPLICIT'));});

test('final verifier succeeds only with final34 plus fresh type proof',async()=>{const h=harness(b=>{b.a=structuredClone(after);b.b=structuredClone(after);});assert.equal((await run(h,{action:'--verify'})).result,'FINAL_34_PASS');assert.equal(h.applied,0);});
test('type drift before mutation fails closed',async()=>{const h=harness();h.io.types=async()=>({normalizedEquivalent:false,structuralEquivalent:true});await assert.rejects(run(h),/TYPE_GATE_FAILED/);assert.equal(h.applied,0);});
test('type drift after mutation prevents final authorization',async()=>{const h=harness();let n=0;h.io.types=async()=>({normalizedEquivalent:++n===1,structuralEquivalent:true});await assert.rejects(run(h),/TYPE_GATE_FAILED/);assert.equal(h.applied,1);});
test('missing type transport fails closed',async()=>{const h=harness();delete h.io.types;await assert.rejects(run(h),/TYPE_GATE_FAILED/);assert.equal(h.applied,0);});
test('second pending read failure is sanitized',async()=>{const h=harness();let n=0;h.io.pending=async()=>{if(++n===2)throw Error('SECRET');return [FINAL_VERSIONS.at(-1)];};await assert.rejects(run(h),/^Error: ACCESS_MANAGEMENT_DRY_RUN_FAILED$/);assert.equal(h.applied,0);});
test('ordinary verify routes to final34 and generic mutation stays disabled',()=>{const text=readFileSync(sourcePath('scripts/staging/migrate.mjs'),'utf8');assert.ok(text.includes('runHostedAccessManagement'));assert.ok(text.includes("'--verify'"));for(const a of ['plan','apply'])assert.throws(()=>execFileSync(process.execPath,[sourcePath('scripts/staging/migrate.mjs'),a],{stdio:'pipe'}),e=>String(e.stdout).includes('VERIFY_ONLY'));});
