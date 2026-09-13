import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTarget, validateHistory, verifyManifest, PROTECTED } from './guard.mjs';
import { readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync } from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {exactMigrationBytes} from './accessRemovalContract.mjs';
const ref = 'abcdefghijklmnopqrst';
const direct = `postgresql://postgres:synthetic@db.${ref}.supabase.co:5432/postgres?sslmode=verify-full`;
test('accepts dedicated direct identity', () => assert.equal(validateTarget(ref,direct).mode,'direct'));
test('accepts dedicated session pooler identity', () => assert.equal(validateTarget(ref,`postgresql://postgres.${ref}:synthetic@aws-0-ca-central-1.pooler.supabase.com:5432/postgres?sslmode=verify-full`).mode,'session-pooler'));
for (const protectedRef of PROTECTED) test(`rejects protected project ${protectedRef}`,()=>assert.throws(()=>validateTarget(protectedRef,direct)));
for (const [name,url] of Object.entries({
  wrongHost:direct.replace(ref,'zzzzzzzzzzzzzzzzzzzz'),
  noTLS:direct.replace('?sslmode=verify-full',''),
  downgrade:direct.replace('verify-full','disable'),
  duplicateTLS:direct+'&sslmode=disable',
  hostOverride:direct+'&host=production',
  spoofedSuffix:direct.replace('.supabase.co:','.supabase.co.evil.test:'),
  wrongDatabase:direct.replace('/postgres?','/template1?'),
  transactionPooler:`postgresql://postgres.${ref}:synthetic@aws-0-ca-central-1.pooler.supabase.com:6543/postgres?sslmode=verify-full`,
  wrongPoolerUser:'postgresql://postgres:synthetic@aws-0-ca-central-1.pooler.supabase.com:5432/postgres?sslmode=verify-full',
})) test(`rejects ${name}`,()=>assert.throws(()=>validateTarget(ref,url)));
test('accepts empty and exact-prefix histories',()=>{ validateHistory([],['1','2']); validateHistory(['1'],['1','2']); validateHistory(['1','2'],['1','2']); });
test('rejects divergent, missing-middle and extra histories',()=>{ for (const h of [['2'],['1','3'],['1','2','3']]) assert.throws(()=>validateHistory(h,['1','2'])); });
const manifest = JSON.parse(readFileSync(new URL('./migrations.json',import.meta.url),'utf8'));
const root = fileURLToPath(new URL('../../',import.meta.url));
import { fileURLToPath } from 'node:url';
test('frozen 32 archive matches hashes independently of later source migrations',()=>{
 const dir=mkdtempSync(join(tmpdir(),'fp-guard32-'));
 try{
  mkdirSync(join(dir,'supabase/migrations'),{recursive:true});
  for(const e of manifest.migrations)writeFileSync(join(dir,'supabase/migrations',e.name),exactMigrationBytes(readFileSync(join(root,'supabase/migrations',e.name)),e.sha256));
  assert.equal(verifyManifest(dir,manifest).length,32);
 }finally{const rel=relative(resolve(tmpdir()),resolve(dir));if(!rel.startsWith('..')&&!isAbsolute(rel)&&rel.startsWith('fp-guard32-'))rmSync(dir,{recursive:true,force:true});}
});
test('rejects modified migration hash',()=>{ const copy=structuredClone(manifest); copy.migrations[0].sha256='0'.repeat(64); assert.throws(()=>verifyManifest(root,copy)); });
test('rejects wrong baseline manifest',()=>assert.throws(()=>verifyManifest(root,{...manifest,sha:'unapproved'})));
