import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describeCatalog,compareCatalogs} from './catalogComparison.mjs';
import {saveCatalogEvidence,captureProbeCatalog} from './catalogEvidence.mjs';
import {SCHEMA_FINGERPRINT,SCHEMA_QUERY_SHA256} from './postMigrationContract.mjs';
import {VERSIONS,POST_SENTINELS} from './postMigrationContract.mjs';
import {probe} from './sqlProbe.mjs';
const catalog=[['relation','public.trips',['r',true,false]],['column','public.trips.id',['text',true,'','',null]],
 ['column','public.trips.name',['text',false,'','',null]],['constraint','public.trips.pk','PRIMARY KEY (id)'],
 ['function','public.f(x text)','CREATE OR REPLACE FUNCTION public.f(x text) RETURNS text LANGUAGE sql AS $$ SELECT x $$'],
 ['policy','public.trips.members',['PERMISSIVE',['authenticated','anon'],'SELECT','true',null]],
 ['relation-grant','public.trips.authenticated.SELECT',false],['relation-grant','public.trips.postgres.SELECT',false]];
const change=(kind,fn)=>catalog.map(e=>e[0]===kind?fn(structuredClone(e)):structuredClone(e)).filter(Boolean);
test('deterministic entry and ACL order',()=>assert.deepEqual(describeCatalog(catalog),describeCatalog([...catalog].reverse())));
test('policy role ordering',()=>assert.ok(compareCatalogs(catalog,change('policy',e=>(e[2][1].reverse(),e))).equivalent));
test('component reporting identifies only changed categories',()=>{
 const d=compareCatalogs(catalog,change('relation-grant',e=>(e[2]=true,e)));
 assert.equal(d.components['relation-grant'].match,false);assert.equal(d.components.column.match,true);assert.equal(d.equivalent,false);
});
for(const [name,kind,fn] of [
 ['missing table','relation',()=>null],['missing column','column',()=>null],['type','column',e=>(e[2][0]='uuid',e)],
 ['nullability','column',e=>(e[2][1]=!e[2][1],e)],['missing constraint','constraint',()=>null],
 ['missing function','function',()=>null],['signature','function',e=>(e[1]='public.f(x uuid)',e)],
 ['RLS','relation',e=>(e[2][1]=false,e)],['missing policy','policy',()=>null],
 ['grant option','relation-grant',e=>(e[2]=true,e)],
 ['owner-derived ACL grantee','relation-grant',e=>(e[1]=e[1].replace('postgres','supabase_admin'),e)],
 ['default expression','column',e=>(e[2][4]="'different'::text",e)],
 ['function security','function',e=>(e[2]+=' SECURITY DEFINER',e)]
]) test(name+' cannot be accepted as environment-only',()=>{const d=compareCatalogs(catalog,change(kind,fn));assert.equal(d.equivalent,false);assert.equal(d.authorization,false);assert.ok(d.differences.length);});
test('core hash cannot conceal a default change in full comparison',()=>{const d=compareCatalogs(catalog,change('column',e=>(e[2][4]='now()',e)));assert.equal(d.stableCoreMatch,true);assert.equal(d.equivalent,false);});
test('literal/body whitespace is not stripped',()=>assert.equal(compareCatalogs(catalog,change('function',e=>(e[2]=e[2].replace('SELECT x','SELECT  x'),e))).equivalent,false));
test('duplicate keys and unknown categories fail closed',()=>{assert.throws(()=>describeCatalog([...catalog,catalog[0]]));assert.throws(()=>describeCatalog([['owner','public.trips','postgres']]));});
test('artifact persists before comparison error; metadata envelope excludes credentials',()=>{
 const dir=mkdtempSync(join(tmpdir(),'catalog-evidence-'));try{
  assert.throws(()=>saveCatalogEvidence(dir,'probe-A',{fingerprint:SCHEMA_FINGERPRINT,catalog},[['bad']]));
  assert.ok(readdirSync(dir).includes('probe-A-manifest.json'));
  assert.ok(!readFileSync(join(dir,'probe-A-manifest.json'),'utf8').includes('credential'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('unchanged authorization fingerprint and SQL digest',()=>{assert.equal(SCHEMA_FINGERPRINT,'b3e3c93d5de2a53b9e7a4afae89d9ada');assert.equal(SCHEMA_QUERY_SHA256,'f8793c2db46829c68f5ce673f9fe43981173fe1837f44f4625dc4b826ab9e8d5');});
test('invalid session cannot write diagnostic',()=>assert.throws(()=>captureProbeCatalog('{}','unused','probe-A','unused'),/SESSION/));
test('failed probe retains manifest before unchanged authorization rejects hash',()=>{
 const dir=mkdtempSync(join(tmpdir(),'catalog-probe-'));try{
  const raw=JSON.stringify({database_name:'postgres',database_user:'postgres',session_user:'postgres',read_only:'on',system_id:'123',
   schema_hash:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',migration_history:VERSIONS,post_sentinels:Object.fromEntries(Object.keys(POST_SENTINELS).map(k=>[k,true])),
   post_schema_hash:'11111111111111111111111111111111',catalog_diagnostic:{fingerprint:'11111111111111111111111111111111',catalog}});
  const result=probe('unused','postgresql://postgres.mgnkvfohpqixgacszovv:test@aws-0-ca-central-1.pooler.supabase.com:5432/postgres?sslmode=verify-full','test',join(dir,'ca.crt'),'A',()=>raw,
   output=>saveCatalogEvidence(dir,'probe-A',JSON.parse(output).catalog_diagnostic,catalog));
  assert.equal(result.passed,false);assert.equal(result.evidence.schema_state_code,'STAGING_SCHEMA_FINGERPRINT_MISMATCH');
  assert.ok(readdirSync(dir).includes('probe-A-manifest.json'));assert.ok(readdirSync(dir).includes('probe-A-diff.json'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
