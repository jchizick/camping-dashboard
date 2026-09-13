// LOCAL ONLY. Accepts no hosted URL, credential or project override.
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,cpSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {SOURCE_ROOT,sourcePath} from './paths.mjs';
import {verifyManifest} from './guard.mjs';
import {captureLocalCatalog} from './catalogReplay.mjs';
import {verifyLocalReplay} from './localReplayEvidence.mjs';
import {simulateLocalRepair} from './repairLocal.mjs';
if(process.argv.length!==3||process.argv[2]!=='--reset-disposable')throw new Error('REQUIRES_EXPLICIT_--reset-disposable');
const manifest=JSON.parse(readFileSync(new URL('./migrations.json',import.meta.url),'utf8'));
verifyManifest(SOURCE_ROOT,manifest);
const cli=resolve(process.env.SUPABASE_CLI_PATH??sourcePath('node_modules/supabase/dist/supabase.js'));
if(execFileSync(process.execPath,[cli,'--version'],{encoding:'utf8'}).trim()!=='2.109.1')throw new Error('CLI_VERSION_MISMATCH');
const container='supabase_db_invitation-phase1-test';
const run=promisify(execFile);
const temp=mkdtempSync(join(tmpdir(),'fp-privilege-validation-'));
const project=join(temp,'project');
const query=sql=>execFileSync('docker',['exec','-i',container,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:sql,encoding:'utf8',timeout:30000});
async function command(binary,argv,extra={}) {
 const r=await run(binary,argv,{cwd:SOURCE_ROOT,timeout:300000,maxBuffer:16*1024*1024,...extra});
 if(r.stdout)process.stdout.write(r.stdout);
 return r;
}
async function reset(version) {
 console.log('Fresh disposable replay '+(version??'32'));
 await command(process.execPath,[cli,'db','reset','--local','--no-seed','--yes','--workdir',project,...(version?['--version',version]:[])]);
 return captureLocalCatalog(query);
}
const types=async()=>(await run(process.execPath,[cli,'gen','types','--local','--lang','typescript','--schema','public','--workdir',project],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024})).stdout;
try {
 mkdirSync(join(project,'supabase'),{recursive:true});
 cpSync(sourcePath('supabase/migrations'),join(project,'supabase/migrations'),{recursive:true});
 const config=readFileSync(sourcePath('supabase/config.toml'),'utf8');
 if(!/^project_id = "camping-dashboard"$/m.test(config))throw new Error('SOURCE_PROJECT_CONFIG_REVIEW_REQUIRED');
 writeFileSync(join(project,'supabase/config.toml'),config.replace(/^project_id = "camping-dashboard"$/m,'project_id = "invitation-phase1-test"'));
 let running=false;
 try {running=execFileSync('docker',['inspect','--format','{{.State.Running}}',container],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()==='true';}catch{}
 if(!running)await command(process.execPath,[cli,'start','--workdir',project,'--exclude','analytics,edge-runtime,functions,imgproxy,inbucket,kong,realtime,rest,storage,studio,vector']);
 const before=await reset('20260911164431');
 const typesBefore=await types();
 const repeat=await reset('20260911164431');
 const repair=await simulateLocalRepair({query,cli,project,root:SOURCE_ROOT});
 console.log('Repair simulation PASS: exact 31 -> 32; one apply; repeated apply refused');
 const after=captureLocalCatalog(query);
 const typesAfter=await types();
 const verification=verifyLocalReplay(SOURCE_ROOT,query,typesAfter);
 const evidence=join(temp,'fresh-replay.json');
 writeFileSync(evidence,JSON.stringify({version:1,before,repeat,after,typesBefore,typesAfter,verification,repair}));
 const tests=readdirSync(sourcePath('scripts/staging')).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>sourcePath('scripts/staging',n));
 await command(process.execPath,['--test','--test-concurrency=1',...tests],{env:{...process.env,STAGING_TEST_REPLAY:evidence}});
 await command(process.execPath,[sourcePath('scripts/test-trip-invitations.mjs')]);
 await command(process.env.PWSH_PATH??'pwsh',['-NoProfile','-File',sourcePath('scripts/staging/credentialDiscovery.test.ps1')]);
 console.log(JSON.stringify({result:'PASS',migrations:after.history.length,final:after.history.at(-1),fingerprint:after.catalog.fingerprint,normalizedTypes:verification.normalizedEquivalent,structuralTypes:verification.comparison.equivalent,schemaChecks:verification.checks.length}));
} finally {
 const rel=relative(resolve(tmpdir()),resolve(temp));
 if(!rel.startsWith('..')&&!isAbsolute(rel)&&rel.startsWith('fp-privilege-validation-'))rmSync(temp,{recursive:true,force:true});
}
