import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,cpSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sourcePath,SOURCE_ROOT} from './paths.mjs';
import {verifyManifest} from './guard.mjs';
const manifest=JSON.parse(readFileSync(new URL('./migrations.json',import.meta.url),'utf8'));
test('root is module-relative rather than caller working directory',()=>assert.equal(sourcePath('package.json'),join(SOURCE_ROOT,'package.json')));
test('temporary source fixture validates and rejects a real byte change',()=>{
 const dir=mkdtempSync(join(tmpdir(),'fp-manifest-test-'));
 try {
  mkdirSync(join(dir,'supabase'));cpSync(sourcePath('supabase/migrations'),join(dir,'supabase/migrations'),{recursive:true});
  assert.equal(verifyManifest(dir,manifest).length,32);
  const file=join(dir,'supabase/migrations',manifest.migrations.at(-1).name);
  writeFileSync(file,readFileSync(file,'utf8')+'-- tampered\n');
  assert.throws(()=>verifyManifest(dir,manifest),/manifest mismatch/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('portable test inputs contain no historical output prerequisites',()=>{
 for(const file of ['catalogDeterminism.test.mjs','functionGrantDiagnostic.test.mjs','guard.test.mjs','privilegeNormalization.test.mjs','catalogReplay.mjs','localReplayEvidence.mjs','migrate.mjs'])
  assert.doesNotMatch(readFileSync(new URL('./'+file,import.meta.url),'utf8'),/output\/|C:\\Users\\/);
});
test('hosted verification retains mandatory externally supplied fresh gate and certificate',()=>{
 const s=readFileSync(new URL('./migrate.mjs',import.meta.url),'utf8');
 assert.match(s,/process.env.STAGING_SQL_GATE/);assert.match(s,/requireFreshGate\(/);
 assert.match(s,/process.env.STAGING_SSL_ROOT_CERT/);assert.match(s,/checkCertificate\(cert\)/);
 assert.match(s,/authorizeMigrationAction\(action\)/);
});
