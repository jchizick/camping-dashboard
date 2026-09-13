// Hosted adapter is constructed only by the explicitly invoked repair CLI.
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,cpSync,rmSync} from 'node:fs';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {SOURCE_ROOT} from './paths.mjs';
import {verifyManifest,validateTarget} from './guard.mjs';
import {invocation,checkClient,checkCertificate,migrationTls} from './sqlProbe.mjs';
import {projectMatches,IDENTITY_SQL} from './sqlIdentity.mjs';
import {describeCatalog} from './catalogComparison.mjs';
import {MODE,REF,SOURCE,FILE,CA_HASH,digest,fail,migrationBytes,runRepair} from './repairContract.mjs';
import {VERSIONS} from './postMigrationContract.mjs';
export const FUNCTIONS_SQL=readFileSync(new URL('./repairFunctions.sql',import.meta.url),'utf8');
// Both SELECTs run within the same read-only, repeatable-read snapshot.
export const REPAIR_SQL=IDENTITY_SQL.replace('BEGIN READ ONLY;','BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;').replace(/COMMIT;$/,FUNCTIONS_SQL+'\nCOMMIT;');
export function parseSnapshot(output) {
 try {const lines=output.trim().split(/\r?\n/);if(lines.length!==2)throw Error();
  return {row:JSON.parse(lines[0]),functions:JSON.parse(lines[1])};
 }catch{fail('REPAIR_SQL_FAILED');}
}
export function parsePending(list,dry) {
 const clean=s=>s.replace(/\x1b\[[0-9;]*m/g,'');
 let rows;
 if(clean(list).trim().startsWith('{')) {
  try {const data=JSON.parse(clean(list).trim().split(/\r?\n/)[0]);
   if(!Array.isArray(data.migrations))throw Error();
   rows=data.migrations.map(r=>{if(typeof r.local!=='string'||typeof r.remote!=='string'||![r.local,r.remote].every(v=>v===''||/^\d{14}$/.test(v)))throw Error();return [null,r.local,r.remote];});
  }catch{fail('REPAIR_PENDING_SET_MISMATCH');}
 }else rows=[...clean(list).matchAll(/^\s*(\d{14})?\s*\|\s*(\d{14})?\s*\|[^\n]*$/gm)];
 if(JSON.stringify(rows.map(r=>r[1]).filter(Boolean))!==JSON.stringify(VERSIONS)||
   JSON.stringify(rows.map(r=>r[2]).filter(Boolean))!==JSON.stringify(VERSIONS.slice(0,31)))fail('REPAIR_PENDING_SET_MISMATCH');
 const filenames=clean(dry).match(/\b\d{14}_[a-zA-Z0-9_]+\.sql\b/g)??[];
 if(filenames.length!==1||filenames[0]!==FILE)fail('REPAIR_PENDING_SET_MISMATCH');
 return rows.filter(r=>r[1]&&!r[2]).map(r=>r[1]);
}
function createHostedTransport(env) {
 if(env.STAGING_REF!==REF)fail('REPAIR_TARGET_MISMATCH');
 let identity;
 try {identity=validateTarget(REF,env.STAGING_DATABASE_URL);}catch{fail('REPAIR_TARGET_MISMATCH');}
 if(identity.mode!=='session-pooler')fail('REPAIR_TARGET_MISMATCH');
 const root=resolve(env.STAGING_SOURCE_DIR??SOURCE_ROOT);
 const manifest=JSON.parse(readFileSync(new URL('./migrations.json',import.meta.url),'utf8'));
 verifyManifest(root,manifest);
 const cert=env.STAGING_SSL_ROOT_CERT;
 checkCertificate(cert);
 if(digest(readFileSync(cert))!==CA_HASH)fail('REPAIR_CA_MISMATCH');
 const binary=env.STAGING_PSQL_PATH??'psql';checkClient(binary);
 if(!env.SUPABASE_ACCESS_TOKEN||!env.SUPABASE_READ_SETUP_TOKEN)fail('REPAIR_CREDENTIALS_REQUIRED');
 const evidence=env.STAGING_EVIDENCE_DIR;
 if(!evidence||!isAbsolute(evidence))fail('REPAIR_EVIDENCE_DIRECTORY_REQUIRED');
 const cli=resolve(env.STAGING_CLI_PATH??join(root,'node_modules/supabase/dist/supabase.js'));
 if(execFileSync(process.execPath,[cli,'--version'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()!=='2.109.1')fail('REPAIR_CLI_VERSION_MISMATCH');
 const temp=mkdtempSync(join(tmpdir(),'fp-repair-31-32-'));
 const cleanup=()=>{const rel=relative(resolve(tmpdir()),temp);if(!rel.startsWith('..')&&!isAbsolute(rel)&&rel.startsWith('fp-repair-31-32-'))rmSync(temp,{recursive:true,force:true});};
 try {
  mkdirSync(join(temp,'supabase'));
  cpSync(join(root,'supabase/migrations'),join(temp,'supabase/migrations'),{recursive:true});
  writeFileSync(join(temp,'supabase/config.toml'),'project_id = "staging-repair-31-to-32"\n');
 }catch{cleanup();fail('REPAIR_SOURCE_COPY_FAILED');}
 const bytes=()=>{verifyManifest(root,manifest);verifyManifest(temp,manifest);
  const original=readFileSync(join(root,'supabase/migrations',FILE));migrationBytes(original);
  const copy=readFileSync(join(temp,'supabase/migrations',FILE));migrationBytes(copy);return copy;};
 async function api(path,readToken=false,query) {
  // Every URL has the fixed staging ref; no arbitrary endpoint or project input.
  const response=await fetch(`https://api.supabase.com/v1/projects/${REF}${path}`,{
   method:query?'POST':'GET',headers:{Authorization:`Bearer ${readToken?env.SUPABASE_READ_SETUP_TOKEN:env.SUPABASE_ACCESS_TOKEN}`,...(query?{'Content-Type':'application/json'}:{})},
   ...(query?{body:JSON.stringify({query,read_only:true})}:{}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)fail('REPAIR_PROVENANCE_FAILED');return response.json();
 }
 function readProbe(mode) {
  checkCertificate(cert);if(digest(readFileSync(cert))!==CA_HASH)fail('REPAIR_CA_MISMATCH');
  const {args,options}=invocation(env.STAGING_DATABASE_URL,env.STAGING_DATABASE_PASSWORD,cert,mode);
  options.input=options.input.replace(IDENTITY_SQL,REPAIR_SQL);
  try{return parseSnapshot(execFileSync(binary,args,options));}catch{fail('REPAIR_SQL_FAILED');}
 }
 async function capture(session) {
  const project=await api('');if(!projectMatches(project))fail('REPAIR_TARGET_MISMATCH');
  // Re-read provider-owned connection and API-key provenance in this very invocation.
  const poolers=await api('/config/database/pooler',true);
  const keys=await api('/api-keys?reveal=true',true);
  const primary=Array.isArray(poolers)?poolers.filter(p=>p.database_type==='PRIMARY'):[];
  if(primary.length!==1)fail('REPAIR_PROVENANCE_FAILED');
  const p=primary[0];if(typeof p.connection_string!=='string'||p.connectionString&&p.connectionString!==p.connection_string)fail('REPAIR_PROVENANCE_FAILED');
  let u;try{u=new URL(p.connection_string);}catch{fail('REPAIR_PROVENANCE_FAILED');}
  if(!['postgres:','postgresql:'].includes(u.protocol)||u.hostname!==identity.host||decodeURIComponent(u.username)!==`postgres.${REF}`||u.pathname!=='/postgres'||!['5432','6543'].includes(u.port))fail('REPAIR_PROVENANCE_FAILED');
  const modern=Array.isArray(keys)&&keys.some(k=>k.type==='publishable'&&/^sb_publishable_/.test(k.api_key))&&keys.some(k=>k.type==='secret'&&/^sb_secret_/.test(k.api_key));
  const legacy=Array.isArray(keys)&&keys.some(k=>k.name==='anon'&&typeof k.api_key==='string'&&k.api_key.length>20)&&keys.some(k=>k.name==='service_role'&&typeof k.api_key==='string'&&k.api_key.length>20);
  if(!modern&&!legacy)fail('REPAIR_PROVENANCE_FAILED');
  const receipt={version:2,ready:true,ref:REF,state:'ACTIVE_HEALTHY',timestampUtc:new Date().toISOString(),poolerEndpoint:`/projects/${REF}/config/database/pooler`,poolerStatus:200,host:identity.host,user:`postgres.${REF}`,database:'postgres',port:5432,apiEndpoint:`/projects/${REF}/api-keys?reveal=true`,apiStatus:200,generation:modern?'modern':'legacy'};
  const a=readProbe('A');
  const independent=await api('/database/query',false,'select system_identifier::text as system_id from pg_control_system()');
  if(!Array.isArray(independent)||independent.length!==1)fail('REPAIR_PROVENANCE_FAILED');
  const b=readProbe('B');
  return {a,b,project,receipt,caHash:CA_HASH,tlsVerified:true,independentSystemId:independent[0].system_id,host:identity.host,ref:REF,source:SOURCE,session,timestampUtc:new Date().toISOString()};
 }
 function cliRun(args) {
  bytes();const tls=migrationTls(env.STAGING_DATABASE_URL,cert,{});
  const childEnv=Object.fromEntries(Object.entries(env).filter(([k])=>/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(k)));
  Object.assign(childEnv,tls.env);
  const result=spawnSync(process.execPath,[cli,...args,'--db-url',tls.dbUrl,'--workdir',temp],{env:childEnv,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000});
  if(result.error||result.status!==0)fail('REPAIR_CLI_FAILED');
  // CLI output is consumed only by strict parsers, never logged.
  return result.stdout+'\n'+result.stderr;
 }
 return {bytes,capture,cleanup,
  preserve:async(label,snapshot)=>{if(!['before','after'].includes(label))fail('REPAIR_EVIDENCE_LABEL');
   mkdirSync(evidence,{recursive:true});writeFileSync(join(evidence,label+'-catalog.json'),JSON.stringify({source:SOURCE,state:label==='before'?'POST_MIGRATION_31_PRE_REPAIR':'POST_MIGRATION_STAGING',fingerprint:snapshot.row.post_schema_hash,...describeCatalog(snapshot.row.catalog_diagnostic.catalog),functions:snapshot.functions},null,2));},
  dryRun:async()=>parsePending(cliRun(['migration','list']),cliRun(['db','push','--dry-run'])),
  apply:async()=>{cliRun(['db','push','--yes']);},
 };
}
// The actual mutation adapter is private. The only exported hosted entry must
// traverse the complete repair state machine; callers cannot invoke apply alone.
export async function runHostedRepair(mode,action,env=process.env) {
 if(mode!==MODE||!['--dry-run','--apply'].includes(action))fail('REPAIR_MODE_NOT_EXPLICIT');
 const io=createHostedTransport(env);
 try{return await runRepair({mode,ref:REF,session:randomUUID(),io,dryRunOnly:action==='--dry-run'});}
 finally{io.cleanup();}
}
