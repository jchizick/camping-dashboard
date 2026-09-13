// Local-only fresh simulation. Fixed disposable Docker target, no hosted/env credentials.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join,relative,resolve,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {sourcePath} from './paths.mjs';
import {verifyAccessRemovalTypes} from './accessRemovalContract.mjs';
import {accessManagementInventory} from './accessManagementInventory.mjs';
import {SNAPSHOT_SQL} from './accessManagementTransport.mjs';
import {parseSnapshot} from './repairTransport.mjs';
import {repairBundle} from './fixtures/repair.mjs';
import {MODE,REF,FILE,VERSION,runAccessManagement,transactionSql,schema} from './accessManagementContract.mjs';
if(process.argv.length!==3||process.argv[2]!=='--reset-disposable')throw Error('EXPLICIT_LOCAL_RESET_REQUIRED');
const inventory=accessManagementInventory(sourcePath()),bytes=inventory.at(-1).bytes;
const cli=sourcePath('node_modules/supabase/dist/supabase.js');
const run=args=>execFileSync(process.execPath,[cli,...args],{encoding:'utf8',stdio:'pipe',timeout:300000,maxBuffer:16*1024*1024});
if(run(['--version']).trim()!=='2.109.1')throw Error('CLI_VERSION_MISMATCH');
const sql=query=>execFileSync('docker',['exec','-i','supabase_db_invitation-phase1-test','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:'pipe',timeout:60000,maxBuffer:16*1024*1024}).trim();
const dir=mkdtempSync(join(tmpdir(),'fp-access-management-local-'));
const session=randomUUID(),source='a'.repeat(40);let applies=0;
try{
 mkdirSync(join(dir,'supabase/migrations'),{recursive:true});
 for(const e of inventory.slice(0,33))writeFileSync(join(dir,'supabase/migrations',e.name),e.bytes);
 const config=readFileSync(sourcePath('supabase/config.toml'),'utf8');
 if(!/^project_id = "camping-dashboard"$/m.test(config))throw Error('LOCAL_CONFIG_MISMATCH');
 writeFileSync(join(dir,'supabase/config.toml'),config.replace(/^project_id = "camping-dashboard"$/m,'project_id = "invitation-phase1-test"'));
 if(execFileSync('docker',['inspect','--format','{{.State.Running}}','supabase_db_invitation-phase1-test'],{encoding:'utf8',stdio:'pipe'}).trim()!=='true')throw Error('LOCAL_CONTAINER_REQUIRED');
 run(['db','reset','--local','--no-seed','--yes','--workdir',dir]);
 const capture=()=>parseSnapshot(sql(SNAPSHOT_SQL));
 const before=capture();schema(before);
 const preGenerated=run(['gen','types','--local','--lang','typescript','--schema','public','--workdir',dir]);
 verifyAccessRemovalTypes(readFileSync(sourcePath('src/types/supabase.ts'),'utf8'),preGenerated);
 // Synthetic control plane is injected ONLY here, never in the hosted adapter.
 const io={types:async()=>verifyAccessRemovalTypes(readFileSync(sourcePath('src/types/supabase.ts'),'utf8'),run(['gen','types','--local','--lang','typescript','--schema','public','--workdir',dir])),bytes:async()=>bytes,preserve:async()=>{},capture:async()=>({...repairBundle(capture(),session),source}),
  pending:async snapshot=>inventory.map(e=>e.name.slice(0,14)).filter(v=>!snapshot.row.migration_history.includes(v)),
  apply:async()=>{applies++;sql(transactionSql(bytes));}};
 const args={mode:MODE,ref:REF,session,source,io};
 const dry=await runAccessManagement({...args,action:'--dry-run'});assert.deepEqual(dry.pending,[VERSION]);assert.equal(applies,0);
 const result=await runAccessManagement({...args,action:'--apply'});assert.equal(applies,1);
 const after=capture();schema(after,true);
 const repeated=await runAccessManagement({...args,action:'--apply'});assert.equal(repeated.result,'ACCESS_MANAGEMENT_ALREADY_COMPLETE');assert.equal(applies,1);
 // The same guarded transaction must also refuse a duplicate direct local attempt.
 assert.throws(()=>sql(transactionSql(bytes)));
 writeFileSync(join(dir,'supabase/migrations',FILE),bytes);
 const generated=run(['gen','types','--local','--lang','typescript','--schema','public','--workdir',dir]);
 const types=verifyAccessRemovalTypes(readFileSync(sourcePath('src/types/supabase.ts'),'utf8'),generated);
 const fixture=join(dir,'fresh-transition.json');writeFileSync(fixture,JSON.stringify({before,after,source}));
 // Tests receive only this invocation's fresh local fixture. No saved hosted checkpoint.
 const tests=execFileSync(process.execPath,['--test',sourcePath('scripts/staging/accessManagementContract.test.mjs')],{cwd:sourcePath(),env:{...process.env,ACCESS_MANAGEMENT_LOCAL_FIXTURE:fixture},encoding:'utf8',stdio:'pipe',timeout:120000});
 console.log(tests);
 const out=sourcePath('output/access-management-validation');mkdirSync(out,{recursive:true});
 writeFileSync(join(out,'generated34.ts'),generated);writeFileSync(join(out,'result.json'),JSON.stringify({result,types,dry,applyCount:applies,repeated,controlPlane:'SYNTHETIC_LOCAL_ONLY'},null,2));
 console.log(JSON.stringify({result:'LOCAL_33_TO_34_PASS',applyCount:applies,history:after.row.migration_history.length,types,repeated:repeated.result}));
}finally{const rel=relative(resolve(tmpdir()),resolve(dir));if(!rel.startsWith('..')&&!isAbsolute(rel)&&rel.startsWith('fp-access-management-local-'))rmSync(dir,{recursive:true,force:true});}
