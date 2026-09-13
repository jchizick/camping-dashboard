// Private hosted mutation adapter: only reachable through the explicit guarded runner.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {isAbsolute,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {SOURCE_ROOT} from './paths.mjs';
import {validateTarget} from './guard.mjs';
import {invocation,checkClient,checkCertificate} from './sqlProbe.mjs';
import {IDENTITY_SQL,projectMatches} from './sqlIdentity.mjs';
import {FUNCTIONS_SQL,parseSnapshot} from './repairTransport.mjs';
import {accessManagementInventory} from './accessManagementInventory.mjs';
import {requireCommittedSource} from './accessManagementSource.mjs';
import {verifyAccessRemovalTypes} from './accessRemovalContract.mjs';
import {MODE,REF,FILE,CA_HASH,hash,fail,runAccessManagement,transactionSql} from './accessManagementContract.mjs';
export const SNAPSHOT_SQL=IDENTITY_SQL.replace('BEGIN READ ONLY;','BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;').replace(/COMMIT;$/,FUNCTIONS_SQL+'\nCOMMIT;');
function transport(env){
 if(env.STAGING_REF!==REF)fail('TARGET_MISMATCH');
 const source=requireCommittedSource(env.STAGING_APPROVED_SOURCE_SHA);
 let routing;try{routing=validateTarget(REF,env.STAGING_DATABASE_URL);}catch{fail('TARGET_MISMATCH');}
 if(routing.mode!=='session-pooler')fail('TARGET_MISMATCH');
 const cert=env.STAGING_SSL_ROOT_CERT,binary=env.STAGING_PSQL_PATH??'psql';
 const ca=()=>{checkCertificate(cert);if(hash(readFileSync(cert))!==CA_HASH)fail('CA_MISMATCH');};ca();checkClient(binary);
 if(!env.SUPABASE_ACCESS_TOKEN||!env.SUPABASE_READ_SETUP_TOKEN)fail('CREDENTIALS_REQUIRED');
 if(!isAbsolute(env.STAGING_EVIDENCE_DIR??''))fail('EVIDENCE_DIRECTORY_REQUIRED');
 const bytes=()=>{requireCommittedSource(source);const entries=accessManagementInventory(SOURCE_ROOT);return entries.find(e=>e.name===FILE).bytes;};
 async function api(path,readToken=false,query){
  const response=await fetch(`https://api.supabase.com/v1/projects/${REF}${path}`,{method:query?'POST':'GET',
   headers:{Authorization:`Bearer ${readToken?env.SUPABASE_READ_SETUP_TOKEN:env.SUPABASE_ACCESS_TOKEN}`,...(query?{'Content-Type':'application/json'}:{})},
   ...(query?{body:JSON.stringify({query,read_only:true})}:{}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)fail('PROVENANCE_FAILED');return response.json();
 }
 function probe(mode){ca();const {args,options}=invocation(env.STAGING_DATABASE_URL,env.STAGING_DATABASE_PASSWORD,cert,mode);
  options.input=options.input.replace(IDENTITY_SQL,SNAPSHOT_SQL);
  try{return parseSnapshot(execFileSync(binary,args,options));}catch{fail('SQL_PROBE_FAILED');}
 }
 async function capture(session){
  const project=await api('');if(!projectMatches(project))fail('TARGET_MISMATCH');
  const poolers=await api('/config/database/pooler',true),keys=await api('/api-keys?reveal=true',true);
  const primary=Array.isArray(poolers)?poolers.filter(p=>p.database_type==='PRIMARY'):[];
  if(primary.length!==1)fail('PROVENANCE_FAILED');
  const p=primary[0];if(typeof p.connection_string!=='string'||p.connectionString&&p.connectionString!==p.connection_string)fail('PROVENANCE_FAILED');
  let u;try{u=new URL(p.connection_string);}catch{fail('PROVENANCE_FAILED');}
  if(!['postgres:','postgresql:'].includes(u.protocol)||u.hostname!==routing.host||decodeURIComponent(u.username)!==`postgres.${REF}`||u.pathname!=='/postgres'||!['5432','6543'].includes(u.port))fail('PROVENANCE_FAILED');
  const modern=Array.isArray(keys)&&keys.some(k=>k.type==='publishable'&&/^sb_publishable_/.test(k.api_key))&&keys.some(k=>k.type==='secret'&&/^sb_secret_/.test(k.api_key));
  const legacy=Array.isArray(keys)&&keys.some(k=>k.name==='anon'&&typeof k.api_key==='string'&&k.api_key.length>20)&&keys.some(k=>k.name==='service_role'&&typeof k.api_key==='string'&&k.api_key.length>20);
  if(!modern&&!legacy)fail('PROVENANCE_FAILED');
  const receipt={version:2,ready:true,ref:REF,state:'ACTIVE_HEALTHY',timestampUtc:new Date().toISOString(),poolerEndpoint:`/projects/${REF}/config/database/pooler`,poolerStatus:200,host:routing.host,user:`postgres.${REF}`,database:'postgres',port:5432,apiEndpoint:`/projects/${REF}/api-keys?reveal=true`,apiStatus:200,generation:modern?'modern':'legacy'};
  const a=probe('A');const independent=await api('/database/query',false,'select system_identifier::text as system_id from pg_control_system()');
  if(!Array.isArray(independent)||independent.length!==1)fail('PROVENANCE_FAILED');const b=probe('B');
  return {a,b,project,receipt,caHash:CA_HASH,tlsVerified:true,independentSystemId:independent[0].system_id,host:routing.host,ref:REF,source,session,timestampUtc:new Date().toISOString()};
 }
 return {source,bytes,capture,
  types:async()=>{
   requireCommittedSource(source);
   const cli=join(SOURCE_ROOT,'node_modules/supabase/dist/supabase.js');
   const options={cwd:SOURCE_ROOT,encoding:'utf8',stdio:'pipe',timeout:60000,maxBuffer:16*1024*1024,env:{...process.env,SUPABASE_ACCESS_TOKEN:env.SUPABASE_ACCESS_TOKEN}};
   if(execFileSync(process.execPath,[cli,'--version'],options).trim()!=='2.109.1')fail('TYPE_GATE_FAILED');
   const generated=execFileSync(process.execPath,[cli,'gen','types','--project-id',REF,'--lang','typescript','--schema','public'],options);
   const baseline=readFileSync(join(SOURCE_ROOT,'src/types/supabase.ts'),'utf8');
   mkdirSync(env.STAGING_EVIDENCE_DIR,{recursive:true});
   writeFileSync(join(env.STAGING_EVIDENCE_DIR,'generated-public34.ts'),generated);
   // Existing audited AST normalization accounts for hosted capability metadata
   // and the five equivalent generic constraints; all other shape stays strict.
   const structural=verifyAccessRemovalTypes(baseline,generated,{hosted:true});
   if(!structural.equivalent)fail('TYPE_GATE_FAILED');
   return {normalizedEquivalent:true,structuralEquivalent:true,capability:structural.capability.verdict};
  },
  pending:async snapshot=>{const entries=accessManagementInventory(SOURCE_ROOT);return entries.map(e=>e.name.slice(0,14)).filter(v=>!snapshot.row.migration_history.includes(v));},
  preserve:async result=>{mkdirSync(env.STAGING_EVIDENCE_DIR,{recursive:true});writeFileSync(join(env.STAGING_EVIDENCE_DIR,'access-management-result.json'),JSON.stringify(result,null,2));},
  apply:async()=>{
   const sql=transactionSql(bytes());ca();const {args,options}=invocation(env.STAGING_DATABASE_URL,env.STAGING_DATABASE_PASSWORD,cert,'A');
   // Connection retains verify-full/independent password, no URI in argv. Only this
   // private apply path clears the probe's read-only default; SQL rechecks under lock.
   options.env.PGOPTIONS='-c statement_timeout=30000';options.env.PGAPPNAME='staging-access-management-33-to-34';
   options.input=sql;options.timeout=60000;execFileSync(binary,args,options);
  },
 };
}
export async function runHostedAccessManagement(mode,action,env=process.env){
 if(mode!==MODE||!['--dry-run','--apply','--verify'].includes(action))fail('MODE_NOT_EXPLICIT');
 const io=transport(env);
 return runAccessManagement({mode,action,ref:REF,session:randomUUID(),source:io.source,io});
}
