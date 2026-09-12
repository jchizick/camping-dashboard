import {POST,PRE,VERSIONS,POST_SENTINELS,SCHEMA_FINGERPRINT} from './postMigrationContract.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {rootCertificates} from 'node:tls';
import {SENTINELS,sqlEvidence,identityVerdict} from './sqlIdentity.mjs';
import {classify,checkCertificate,checkClient,invocation,parseIdentity,probe,requireFreshGate,withRootCertificate,migrationTls,REF} from './sqlProbe.mjs';
const uri = password => `postgresql://postgres.${REF}:${encodeURIComponent(password)}@aws-0-ca-central-1.pooler.supabase.com:5432/postgres?sslmode=verify-full`;
for(const [detail,expected] of [
 ['certificate verify failed','SSL_VERIFY_FAILED'],['server certificate does not match host name','SSL_HOSTNAME_FAILED'],
 ['password authentication failed','POOLER_AUTH_FAILED'],['Tenant or user not found','POOLER_TENANT_NOT_FOUND'],
 ['IP temporarily banned','POOLER_NETWORK_BANNED'],['could not translate host','POOLER_DNS_FAILED'],
 ['connection refused','POOLER_TCP_FAILED'],['timeout expired','POOLER_CONNECT_TIMEOUT'],
 ['ERROR: permission denied','SQL_SESSION_FAILED'],['SENTINEL_RAW_SECRET','POOLER_CONNECTIVITY_UNKNOWN'],
]) test(`sanitized ${expected}`,()=>assert.equal(classify({stderr:detail}),expected));
test('hard timeout',()=>assert.equal(classify({code:'ETIMEDOUT'}),'POOLER_CONNECT_TIMEOUT'));
test('missing certificate',()=>assert.throws(()=>checkCertificate(),/SSL_ROOT_CERT_MISSING/));
test('nonexistent certificate',()=>assert.throws(()=>checkCertificate(resolve('absent.crt'),()=>{throw {code:'ENOENT'}}),/SSL_ROOT_CERT_MISSING/));
test('relative certificate',()=>assert.throws(()=>checkCertificate('relative.crt'),/SSL_ROOT_CERT_UNREADABLE/));
test('malformed certificate path',()=>assert.throws(()=>checkCertificate(resolve('bad\0.crt')),/SSL_ROOT_CERT_UNREADABLE/));
test('malformed certificate content',()=>assert.throws(()=>checkCertificate(resolve('bad.crt'),()=> 'not a certificate'),/SSL_ROOT_CERT_UNREADABLE/));
test('unreadable certificate',()=>assert.throws(()=>checkCertificate(resolve('bad.crt'),()=>{throw {code:'EACCES'}}),/SSL_ROOT_CERT_UNREADABLE/));
test('missing client',()=>assert.throws(()=>checkClient('psql',()=>{throw {code:'ENOENT'}}),/PSQL_NOT_FOUND/));
test('unsupported client',()=>assert.throws(()=>checkClient('psql',()=> 'psql (PostgreSQL) 14.1'),/PSQL_VERSION_UNSUPPORTED/));
test('supported client',()=>checkClient('psql',()=> 'psql (PostgreSQL) 17.6'));
for(const character of ['@',':','/','?','#','%','&',' ']) test('reserved character roundtrip '+JSON.stringify(character),()=> {
 const password='synthetic'+character+'value';
 const call=invocation(uri(password),password,resolve('root.crt'),'A');
 assert.equal(call.options.env.PGPASSWORD,password);
 assert.ok(!JSON.stringify(call.args).includes(password));
 assert.equal(decodeURIComponent(new URL(uri(password)).password),password);
});
test('B uses real URI via getenv, never argv or stdin literal',()=>{
 const password='SENTINEL@:/?#%& value';const call=invocation(uri(password),password,resolve('root.crt'),'B',{PGSERVICE:'bad',SUPABASE_ACCESS_TOKEN:'bad'});
 assert.equal(call.options.env.STAGING_PROBE_URI,withRootCertificate(uri(password),resolve('root.crt')));
 assert.equal(call.options.env.PGSERVICE,undefined);assert.equal(call.options.env.SUPABASE_ACCESS_TOKEN,undefined);
 assert.ok(!JSON.stringify(call.args).includes('SENTINEL'));assert.ok(!call.options.input.includes('SENTINEL'));
 assert.match(call.options.input,/\\connect -reuse-previous=off :probe_uri/);
 assert.equal(call.options.env.PGSSLMODE,'verify-full');assert.equal(call.options.env.PGSSLROOTCERT,resolve('root.crt'));
});
test('independent password catches URI mismatch',()=>assert.throws(()=>invocation(uri('one'),'two',resolve('root.crt'),'A'),/URI_CONSTRUCTION_FAILED/));
const row={migration_history:VERSIONS,post_schema_hash:SCHEMA_FINGERPRINT,post_sentinels:Object.fromEntries(Object.keys(POST_SENTINELS).map(s=>[s,true])),database_name:'postgres',database_user:'postgres',session_user:'postgres',read_only:'on',system_id:'1234',sentinels:Object.fromEntries(SENTINELS.map(s=>[s,false])),schema_hash:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'};
test('valid identity',()=>assert.equal(parseIdentity(JSON.stringify(row)),'1234'));
for(const key of Object.keys(row).filter(k=>k!=='sentinels')) test('reject wrong identity '+key,()=>assert.throws(()=>parseIdentity(JSON.stringify({...row,[key]:'wrong'})),/STAGING_DATABASE_IDENTITY_MISMATCH/));
test('unknown client error secrets never escape',()=>assert.throws(()=>probe('psql',uri('secret'),'secret',resolve('root.crt'),'A',()=>{throw {stderr:'secret',message:'secret',spawnargs:['secret']}}),/^Error: POOLER_CONNECTIVITY_UNKNOWN$/));
const now=Date.now();
const proof=identityVerdict({management_project_match:true,pooler_tenant_match:true,api_credentials_project_match:true,tls_verified:true},sqlEvidence(JSON.stringify(row)),true);
const gate={identityVersion:3,identityA:proof,identityB:proof,probesAgree:true,ready:true,probeA:true,probeB:true,clusterIdentityMatch:true,readOnly:true,ref:REF,source:'sha',host:'host',port:5432,timestampUtc:new Date(now).toISOString()};
test('fresh A/B gate accepted',()=>requireFreshGate(gate,REF,'sha','host',now));
for(const key of Object.keys(gate)) test('migration gate rejects invalid '+key,()=>assert.throws(()=>requireFreshGate({...gate,[key]:'invalid'},REF,'sha','host',now),/FRESH_SQL_PROBES_REQUIRED/));
test('migration gate refuses stale evidence',()=>assert.throws(()=>requireFreshGate(gate,REF,'sha','host',now+600001),/FRESH_SQL_PROBES_REQUIRED/));
test('migration gate refuses future evidence',()=>assert.throws(()=>requireFreshGate(gate,REF,'sha','host',now-1),/FRESH_SQL_PROBES_REQUIRED/));
test('empty cert rejected',()=>assert.throws(()=>checkCertificate(resolve('empty.crt'),()=>''),/SSL_ROOT_CERT_UNREADABLE/));
test('real public trust PEM parses in memory only (never used as staging CA)',()=>{
 const valid=rootCertificates.find(pem=>{try{checkCertificate(resolve('test-only.crt'),()=>pem);return true}catch{return false}});
 assert.ok(valid);checkCertificate(resolve('test-only.crt'),()=>valid);
});
for(const name of ['certs with spaces/ca.crt','certs#&%?/ca.crt']) test('CA URI roundtrip '+name,()=>{
 const cert=resolve(name);const password='synthetic@:/?#%& space';const enriched=withRootCertificate(uri(password),cert);
 assert.equal(new URL(enriched).searchParams.get('sslrootcert'),cert);
 assert.equal(new URL(enriched).password,new URL(uri(password)).password);
 assert.ok(!enriched.includes('+')); assert.match(enriched,/sslmode=verify-full/);
});
test('CLI TLS survives URL rebuild through explicit PG environment',()=>{
 const cert=resolve('certs/staging-ca.crt');const result=migrationTls(uri('test'),cert,{PATH:'keep',PGSSLMODE:'disable',PGSSLROOTCERT:'wrong',PGSERVICE:'wrong',PGOPTIONS:'wrong'});
 assert.equal(result.env.PGSSLMODE,'verify-full');assert.equal(result.env.PGSSLROOTCERT,cert);
 assert.equal(result.env.PGSERVICE,undefined);assert.equal(result.env.PGOPTIONS,undefined);assert.equal(result.env.PATH,'keep');
 assert.equal(new URL(result.dbUrl).searchParams.get('sslrootcert'),cert);
});
test('CA builder preserves target guard',()=>assert.throws(()=>withRootCertificate(uri('test').replace('verify-full','require'),resolve('ca.crt'))));
test('CA builder refuses missing path',()=>assert.throws(()=>withRootCertificate(uri('test'),''),/SSL_ROOT_CERT_MISSING/));
test('CA builder refuses relative path',()=>assert.throws(()=>withRootCertificate(uri('test'),'ca.crt'),/SSL_ROOT_CERT_UNREADABLE/));
