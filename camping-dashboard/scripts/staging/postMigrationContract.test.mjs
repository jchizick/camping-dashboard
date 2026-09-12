import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PRE,POST,VERSIONS,POST_SENTINELS,SCHEMA_FINGERPRINT,schemaState,authorizeMigrationAction} from './postMigrationContract.mjs';
import {sqlEvidence,SENTINELS,identitySql,validIdentityEvidence,identityVerdict} from './sqlIdentity.mjs';
const row={database_name:'postgres',database_user:'postgres',session_user:'postgres',read_only:'on',system_id:'123',schema_hash:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
 migration_history:VERSIONS,post_sentinels:Object.fromEntries(Object.keys(POST_SENTINELS).map(k=>[k,true])),post_schema_hash:SCHEMA_FINGERPRINT};
test('POST valid',()=>assert.ok(sqlEvidence(JSON.stringify(row)).passed));
test('explicit PRE empty fixture valid but cannot authorize current resume',()=>{
 const result=sqlEvidence(JSON.stringify({...row,migration_history:[],sentinels:Object.fromEntries(SENTINELS.map(k=>[k,false]))}),undefined,PRE);
 assert.ok(result.passed);
 assert.equal(validIdentityEvidence(identityVerdict({management_project_match:true,pooler_tenant_match:true,api_credentials_project_match:true,tls_verified:true},result,true)),false);
});
for(const [name,history] of [['partial',VERSIONS.slice(0,30)],['production28',VERSIONS.slice(0,28)],['reordered',[...VERSIONS].reverse()],['empty',[]],['wrong final',[...VERSIONS.slice(0,-1),'99999999999999']]])
 test(name,()=>assert.equal(schemaState({...row,migration_history:history},POST).schema_state_code,'STAGING_SCHEMA_PARTIAL'));
test('missing post sentinel is partial',()=>assert.equal(schemaState({...row,post_sentinels:{}},POST).schema_state_code,'STAGING_SCHEMA_PARTIAL'));
test('wrong fingerprint rejected',()=>assert.equal(schemaState({...row,post_schema_hash:'wrong'},POST).schema_state_code,'STAGING_SCHEMA_FINGERPRINT_MISMATCH'));
test('PRE cannot accept any applied history',()=>assert.equal(schemaState(row,PRE).schema_state_code,'STAGING_SCHEMA_PARTIAL'));
test('no automatic state selection',()=>assert.throws(()=>schemaState(row),/EXPLICIT/));
test('POST query includes exact history and catalog, PRE uses no catalog comparison',()=>{
 assert.match(identitySql(POST),/json_agg\(version ORDER BY version\)/);assert.match(identitySql(POST),/pg_get_functiondef/);
 assert.match(identitySql(PRE),/'post_schema_hash',NULL/);
});
test('current state verify only',()=>{assert.deepEqual(authorizeMigrationAction('verify'),{staging_state:POST,apply:false,dryRun:false});for(const a of ['apply','plan'])assert.throws(()=>authorizeMigrationAction(a),/VERIFY_ONLY/);});
test('future migration requires new reviewed contract',()=>assert.throws(()=>authorizeMigrationAction('verify',[...VERSIONS,'20260913000000']),/NEW_MIGRATION/));
test('legacy apply rejected before network or credentials',()=>{
 assert.throws(()=>execFileSync(process.execPath,[fileURLToPath(new URL('./migrate.mjs',import.meta.url)),'apply'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}),e=>e.stderr.includes('POST_MIGRATION_VERIFY_ONLY'));
});
test('runner contains no push or migration-list invocation',()=>{const s=readFileSync(new URL('./migrate.mjs',import.meta.url),'utf8');assert.doesNotMatch(s,/run\(\['db','push'|run\(\['migration','list'/);});
test('checkpoint requires the exact pinned history/catalog/query digests',()=>{
 const proof=identityVerdict({management_project_match:true,pooler_tenant_match:true,api_credentials_project_match:true,tls_verified:true},sqlEvidence(JSON.stringify(row)),true);
 for(const key of ['migration_history_sha256','post_schema_fingerprint','schema_query_sha256']) assert.equal(validIdentityEvidence({...proof,[key]:'wrong'}),false);
});
