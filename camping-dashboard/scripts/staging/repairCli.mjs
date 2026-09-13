import {spawnSync} from 'node:child_process';
import {VERSIONS} from './postMigrationContract.mjs';
const FILE='20260912215252_normalize_public_function_execute_privileges.sql';
export const CLI_CODES=new Set(['REPAIR_CLI_NOT_FOUND','REPAIR_CLI_VERSION_MISMATCH','REPAIR_CHILD_START_FAILED',
 'REPAIR_MIGRATION_LIST_FAILED','REPAIR_MIGRATION_LIST_PARSE_FAILED','REPAIR_REMOTE_HISTORY_MISMATCH',
 'REPAIR_DRY_RUN_CLI_FAILED','REPAIR_DRY_RUN_PARSE_FAILED','REPAIR_PENDING_SET_MISMATCH',
 'REPAIR_DB_CONNECT_FAILED','REPAIR_TLS_FAILED','REPAIR_AUTH_FAILED','REPAIR_TIMEOUT','REPAIR_UNKNOWN_CLI_FAILURE']);
const reasons=[
 [/certificate|ssl error|tls error|x509|sslrootcert/i,'REPAIR_TLS_FAILED','TLS verification or configuration failed'],
 [/password authentication failed|authentication failed|sasl|SQLSTATE\s*28P01/i,'REPAIR_AUTH_FAILED','Database authentication failed'],
 [/connection refused|failed to connect|dial tcp|no such host|network is unreachable|tenant or user not found/i,'REPAIR_DB_CONNECT_FAILED','Database connection failed'],
 [/unknown flag|unknown option|unrecognized option/i,null,'CLI option rejected'],
 [/permission denied|access is denied|EPERM|EACCES/i,null,'Local access denied'],
 [/not found|ENOENT/i,null,'Required local resource unavailable'],
 ];
// Deliberately do not retain arbitrary provider prose. Even redacted prose may
// contain an unlabeled credential. Preserve only recognized canonical text/classes.
export function safeOutput(text='') {
 const raw=String(text);
 const matches=reasons.filter(([pattern])=>pattern.test(raw));
 const states=[...raw.matchAll(/SQLSTATE[\s:=]+([0-9A-Z]{5})\b/g)].map(m=>m[1]);
 return {messages:[...new Set(matches.map(([, ,message])=>message))],
  sqlstates:[...new Set(states.filter(s=>/^(08|22|23|28|42|53|57|58|XX)[0-9A-Z]{3}$/.test(s)))],
  code:matches.find(([,code])=>code)?.[1]??null};
}
export function childEnvironment(env,tls={}) {
 return {...Object.fromEntries(Object.entries(env).filter(([k])=>/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(k))),...tls};
}
export function cliDiagnostic(operation,result,lastCompletedStage) {
 const output=String(result.stdout??'')+'\n'+String(result.stderr??'');
 const sanitized=safeOutput(output);
 let code=null;
 if(result.error?.code==='ETIMEDOUT')code='REPAIR_TIMEOUT';
 else if(result.error?.code==='ENOENT')code='REPAIR_CLI_NOT_FOUND';
 else if(result.error)code='REPAIR_CHILD_START_FAILED';
 else if(result.status!==0)code=sanitized.code??(operation==='migration_list'?'REPAIR_MIGRATION_LIST_FAILED':operation==='dry_run'?'REPAIR_DRY_RUN_CLI_FAILED':'REPAIR_UNKNOWN_CLI_FAILURE');
 return {operation,lastCompletedStage,exitCode:Number.isInteger(result.status)?result.status:null,
  timedOut:result.error?.code==='ETIMEDOUT',stdoutLength:String(result.stdout??'').length,stderrLength:String(result.stderr??'').length,
  code:code??'OK',messages:sanitized.messages,sqlstates:sanitized.sqlstates};
}
function fail(code){throw Error(code);}
export function parseMigrationList(output) {
 const text=output.replace(/\x1b\[[0-9;]*m/g,'').trim();
 let rows;
 const jsonLine=text.split(/\r?\n/).find(l=>l.trim().startsWith('{'));
 if(jsonLine){
  try {const data=JSON.parse(jsonLine);if(!Array.isArray(data.migrations))throw Error();
   rows=data.migrations.map(r=>{if(typeof r.local!=='string'||typeof r.remote!=='string'||![r.local,r.remote].every(v=>v===''||/^\d{14}$/.test(v)))throw Error();return [r.local,r.remote];});
  }catch{fail('REPAIR_MIGRATION_LIST_PARSE_FAILED');}
 }else{
  const cell=value=>{
   let v=value.trim();
   if(v.startsWith('`')&&v.endsWith('`'))v=v.slice(1,-1).trim();
   if(v!==''&&!/^\d{14}$/.test(v))fail('REPAIR_MIGRATION_LIST_PARSE_FAILED');
   return v;
  };
  rows=[];
  for(const line of text.split(/\r?\n/)){
   if(!line.includes('|')||/^[\s|:-]+$/.test(line))continue;
   const fields=line.split('|');
   if(fields[0].trim()==='Local'&&fields[1]?.trim()==='Remote')continue;
   if(fields.length!==3)fail('REPAIR_MIGRATION_LIST_PARSE_FAILED');
   rows.push([cell(fields[0]),cell(fields[1])]);
  }
  if(!rows.length)fail('REPAIR_MIGRATION_LIST_PARSE_FAILED');
 }
 if(JSON.stringify(rows.map(r=>r[0]).filter(Boolean))!==JSON.stringify(VERSIONS))fail('REPAIR_PENDING_SET_MISMATCH');
 if(JSON.stringify(rows.map(r=>r[1]).filter(Boolean))!==JSON.stringify(VERSIONS.slice(0,31)))fail('REPAIR_REMOTE_HISTORY_MISMATCH');
 return rows.filter(r=>r[0]&&!r[1]).map(r=>r[0]);
}
export function parsePending(list,dry) {
 const pending=parseMigrationList(list);
 const names=dry.replace(/\x1b\[[0-9;]*m/g,'').match(/\b\d{14}_[a-zA-Z0-9_]+\.sql\b/g)??[];
 if(!names.length)fail('REPAIR_DRY_RUN_PARSE_FAILED');
 if(names.length!==1||names[0]!==FILE)fail('REPAIR_PENDING_SET_MISMATCH');
 return pending;
}
// This shared runner only exposes read-only CLI operations. Hosted apply stays
// private in repairTransport, behind the unchanged runRepair authorization gates.
export function runRepairDryRun({cli,dbUrl,workdir,env,preserve=()=>{},spawn=spawnSync,verifyBytes=()=>{}}) {
 let last='authorization';
 const run=(operation,args)=>{
  verifyBytes();
  let r;try{r=spawn(process.execPath,[cli,...args,'--db-url',dbUrl,'--workdir',workdir],
   {env,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000,windowsHide:true});}
  catch{r={error:{code:'START_FAILED'},status:null};}
  const diagnostic=cliDiagnostic(operation,r,last);preserve(diagnostic);
  if(diagnostic.code!=='OK')fail(diagnostic.code);
  return {output:String(r.stdout??'')+'\n'+String(r.stderr??''),diagnostic};
 };
 const list=run('migration_list',['migration','list']);
 try{parseMigrationList(list.output);}catch(e){preserve({...list.diagnostic,code:e.message,parseState:'FAILED'});throw e;}
 preserve({...list.diagnostic,code:'OK',parseState:'PASS'});
 last='migration_list_parsed';
 const dry=run('dry_run',['db','push','--dry-run']);
 try{const pending=parsePending(list.output,dry.output);preserve({...dry.diagnostic,parseState:'PASS',code:'OK'});return pending;}
 catch(e){preserve({...dry.diagnostic,code:e.message,parseState:'FAILED'});throw e;}
}
