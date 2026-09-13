// Explicit local replay only. No URL, project, credentials, or hosted action arguments.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {sourcePath} from './paths.mjs';
import {accessRemovalInventory,verifyAccessRemovalSchema,verifyAccessRemovalTypes} from './accessRemovalContract.mjs';
import {SCHEMA_SQL,SCHEMA_FINGERPRINT as PREVIOUS_FINGERPRINT} from './postMigrationContract.mjs';
import {captureLocalCatalog} from './catalogReplay.mjs';
if(process.argv.length!==3||process.argv[2]!=='--reset-disposable')throw Error('EXPLICIT_LOCAL_RESET_REQUIRED');
const inventory=accessRemovalInventory(sourcePath());
const cli=sourcePath('node_modules/supabase/dist/supabase.js');
const run=args=>execFileSync(process.execPath,[cli,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:300000,maxBuffer:16*1024*1024});
if(run(['--version']).trim()!=='2.109.1')throw Error('CLI_VERSION_MISMATCH');
const query=sql=>execFileSync('docker',['exec','-i','supabase_db_invitation-phase1-test','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',stdio:'pipe',timeout:30000,maxBuffer:8*1024*1024}).trim();
const dir=mkdtempSync(join(tmpdir(),'fp-removal-replay-'));
try {
 mkdirSync(join(dir,'supabase/migrations'),{recursive:true});
 for(const entry of inventory)writeFileSync(join(dir,'supabase/migrations',entry.name),entry.bytes);
 const config=readFileSync(sourcePath('supabase/config.toml'),'utf8');
 if(!/^project_id = "camping-dashboard"$/m.test(config))throw Error('LOCAL_CONFIG_REVIEW_REQUIRED');
 writeFileSync(join(dir,'supabase/config.toml'),config.replace(/^project_id = "camping-dashboard"$/m,'project_id = "invitation-phase1-test"'));
 // Only the already-running disposable container is accepted; never discover/link a hosted project.
 if(execFileSync('docker',['inspect','--format','{{.State.Running}}','supabase_db_invitation-phase1-test'],{encoding:'utf8',stdio:'pipe'}).trim()!=='true')throw Error('START_DISPOSABLE_LOCAL_DB_FIRST');
 run(['db','reset','--local','--no-seed','--yes','--workdir',dir]);
 const after=captureLocalCatalog(query);
 const schema=verifyAccessRemovalSchema(after);
 // Restore only the prior public function in a rolled-back local transaction to prove
 // the entire remaining schema/ACLs exactly equal the approved 32-migration catalog.
 const previous=inventory.find(e=>e.name==='20260911164431_trip_invitation_delivery_and_limits.sql').bytes.toString('utf8');
 const oldFunction=previous.slice(previous.indexOf('create function public.trip_invitation_bridge'),previous.indexOf('-- Shared across all server instances;')).replace('create function','create or replace function');
 const restored=JSON.parse(query('BEGIN; SET LOCAL search_path=public,extensions;'+oldFunction+'SELECT row_to_json(c) FROM ('+SCHEMA_SQL+') c; ROLLBACK;'));
 if(restored.fingerprint!==PREVIOUS_FINGERPRINT)throw Error('NON_BRIDGE_CATALOG_CHANGED');
 const generated=run(['gen','types','--local','--lang','typescript','--schema','public','--workdir',dir]);
 const types=verifyAccessRemovalTypes(readFileSync(sourcePath('src/types/supabase.ts'),'utf8'),generated);
 const output=sourcePath('output/access-removal-validation');mkdirSync(output,{recursive:true});
 writeFileSync(join(output,'generated33.ts'),generated);
 writeFileSync(join(output,'catalog33.json'),JSON.stringify(after));
 writeFileSync(join(output,'result.json'),JSON.stringify({schema,types,previousCatalogMatch:true},null,2));
 console.log(JSON.stringify({result:'LOCAL_ACCESS_REMOVAL_PASS',...schema,...types,previousCatalogMatch:true}));
} finally {
 const rel=relative(resolve(tmpdir()),resolve(dir));
 if(!rel.startsWith('..')&&!isAbsolute(rel)&&rel.startsWith('fp-removal-replay-'))rmSync(dir,{recursive:true,force:true});
}
