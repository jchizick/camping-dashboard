import test from 'node:test';
import assert from 'node:assert/strict';
import {safeOutput,cliDiagnostic,childEnvironment,parsePending,runRepairDryRun} from './repairCli.mjs';
import {VERSIONS} from './postMigrationContract.mjs';
const file='20260912215252_normalize_public_function_execute_privileges.sql';
const table=VERSIONS.map((v,i)=>`  ${v}  |  ${i<31?v:''}  | date`).join('\n');
const json=JSON.stringify({migrations:VERSIONS.map((v,i)=>({local:v,remote:i<31?v:''}))});
const quoted=VERSIONS.map((v,i)=>' `'+v+'` | `'+(i<31?v:' ')+'` | `date`').join('\r\n');
function harness(change=()=>{}){
 const records=[],calls=[];
 const options={cli:'cli.js',dbUrl:'postgresql://user:PASSWORD@localhost/db?secret=TOKEN',workdir:'C:/temp space/project',env:{},preserve:d=>records.push(d),spawn:(binary,args,opts)=>{
  const i=calls.length;calls.push({binary,args,opts});const r={status:0,stdout:i===0?table:file,stderr:'Warning: harmless warning'};change(r,i);return r;
 }};return {records,calls,run:()=>runRepairDryRun(options)};
}
for(const [name,list] of [['LF',table],['CRLF',table.replaceAll('\n','\r\n')],['no final newline',table.trimEnd()],['tabs',table.replaceAll('  ','\t')],['JSON',json],['warning plus JSON','Warning: hello\n'+json],['warning plus table','Warning: hello\n'+table]])test('list '+name,()=>assert.deepEqual(parsePending(list,file),[VERSIONS.at(-1)]));
test('same real-process invocation strategy; success warnings retained as counts only',()=>{
 const h=harness();assert.deepEqual(h.run(),[VERSIONS.at(-1)]);assert.equal(h.calls.length,2);
 assert.deepEqual(h.calls.map(c=>c.args.slice(1,4)),[['migration','list','--db-url'],['db','push','--dry-run']]);
 assert.equal(h.calls[0].opts.timeout,120000);assert.equal(h.calls[0].opts.shell,undefined);
 assert.ok(h.records.every(r=>r.exitCode===0));assert.equal(h.records.at(-1).parseState,'PASS');
});
for(const [name,change,code] of [
 ['nonzero list',r=>{r.status=1;r.stderr='unknown flag';},'REPAIR_MIGRATION_LIST_FAILED'],
 ['auth',r=>{r.status=1;r.stderr='password authentication failed SQLSTATE 28P01';},'REPAIR_AUTH_FAILED'],
 ['TLS',r=>{r.status=1;r.stderr='x509 certificate invalid';},'REPAIR_TLS_FAILED'],
 ['connection',r=>{r.status=1;r.stderr='dial tcp connection refused';},'REPAIR_DB_CONNECT_FAILED'],
 ['timeout',r=>{r.status=null;r.error={code:'ETIMEDOUT'};},'REPAIR_TIMEOUT'],
 ['not found',r=>{r.status=null;r.error={code:'ENOENT'};},'REPAIR_CLI_NOT_FOUND'],
 ['start error',r=>{r.status=null;r.error={code:'EACCES'};},'REPAIR_CHILD_START_FAILED'],
 ['malformed list',r=>{r.stdout='nothing';},'REPAIR_MIGRATION_LIST_PARSE_FAILED'],
 ['remote mismatch',r=>{r.stdout=table.replace(VERSIONS[0]+'  | date','99999999999999  | date');},'REPAIR_REMOTE_HISTORY_MISMATCH'],
])test(name,()=>{const h=harness(r=>change(r));assert.throws(h.run,new RegExp(code));assert.equal(h.calls.length,1);assert.equal(h.records.at(-1).code,code);});
for(const [name,change,code] of [
 ['dry CLI failure',r=>{r.status=1;r.stdout='';},'REPAIR_DRY_RUN_CLI_FAILED'],
 ['dry parse failure',r=>{r.stdout='No pending migrations';},'REPAIR_DRY_RUN_PARSE_FAILED'],
 ['pending mismatch',r=>{r.stdout=file+'\n20270101000000_other.sql';},'REPAIR_PENDING_SET_MISMATCH'],
])test(name,()=>{const h=harness((r,i)=>{if(i===1)change(r);});assert.throws(h.run,new RegExp(code));assert.equal(h.records.at(-1).lastCompletedStage,'migration_list_parsed');});
test('aggressive redaction drops URLs, passwords, PATs, API keys and unknown prose',()=>{
 const secrets=['postgresql://user:pw@host/db?sslrootcert=private','password=abc','host=private user=private password=private',
  'sbp_secret123','sb_secret_abc','sb_publishable_abc','eyJhbGciOiJIUzI1NiJ9.abc.def','?token=secret','Bearer unlabeled','PRIVATE_CAPTION'];
 const output=JSON.stringify(safeOutput(secrets.join('\n')+'\npassword authentication failed SQLSTATE 28P01'));
 for(const s of secrets)assert.ok(!output.includes(s));assert.ok(output.includes('28P01'));assert.ok(output.includes('authentication failed'));
});
test('environment filters secrets and ambient PG settings',()=>{
 assert.deepEqual(childEnvironment({Path:'path',USERPROFILE:'user',PAT:'secret',PGPASSWORD:'secret',PGSSLMODE:'disable'},{PGSSLMODE:'verify-full',PGSSLROOTCERT:'ca'}),{Path:'path',USERPROFILE:'user',PGSSLMODE:'verify-full',PGSSLROOTCERT:'ca'});
});
test('CLI 2.109.1 text tables quote versions and the blank remote cell',()=>assert.deepEqual(parsePending('Local | Remote | Time\n---|---|---\n'+quoted,file),[VERSIONS.at(-1)]));
test('unbalanced backticks are not accepted as version syntax',()=>assert.throws(()=>parsePending(quoted.replace('`'+VERSIONS[0]+'`','`'+VERSIONS[0]),file),/REPAIR_MIGRATION_LIST_PARSE_FAILED/));
test('diagnostic has no raw argv, stderr or thrown error strings',()=>{
 const d=cliDiagnostic('dry_run',{status:1,stderr:'PASSWORD secret',error:{message:'secret'}},'migration_list_parsed');
 assert.ok(!JSON.stringify(d).includes('secret'));assert.equal(d.exitCode,1);
});
