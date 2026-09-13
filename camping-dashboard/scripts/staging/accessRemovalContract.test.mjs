import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourcePath} from './paths.mjs';
import {hash} from './typeComparison.mjs';
import {VERSIONS as OLD_VERSIONS,SCHEMA_FINGERPRINT as OLD_FINGERPRINT} from './postMigrationContract.mjs';
import {ACCESS_REMOVAL_VERSIONS,ACCESS_REMOVAL_FINGERPRINT,accessRemovalInventory,verifyAccessRemovalSchema,verifyAccessRemovalTypes,exactMigrationBytes,accessRemovalAction} from './accessRemovalContract.mjs';
test('exact extended source inventory, preserving completed history',()=>{
 assert.equal(accessRemovalInventory(sourcePath()).length,33);
 assert.deepEqual(ACCESS_REMOVAL_VERSIONS.slice(0,32),OLD_VERSIONS);
 assert.equal(OLD_FINGERPRINT,'b3e3c93d5de2a53b9e7a4afae89d9ada');
});
test('EOL reconstruction requires exact preapproved byte hash',()=>{
 const expected=hash('a\r\nb\r\n');assert.equal(exactMigrationBytes(Buffer.from('a\nb\n'),expected).toString(),'a\r\nb\r\n');
 assert.equal(exactMigrationBytes(Buffer.from('a\r\nb\r\n'),hash('a\nb\n')).toString(),'a\nb\n');
 assert.throws(()=>exactMigrationBytes(Buffer.from('a\nc\n'),expected),/BYTES_MISMATCH/);
});
test('strict final schema accepts 33 and rejects the still-hosted 32',()=>{
 assert.equal(verifyAccessRemovalSchema({history:ACCESS_REMOVAL_VERSIONS,catalog:{fingerprint:ACCESS_REMOVAL_FINGERPRINT}}).apply,false);
 assert.throws(()=>verifyAccessRemovalSchema({history:OLD_VERSIONS,catalog:{fingerprint:OLD_FINGERPRINT}}),/HISTORY_MISMATCH/);
});
for(const history of [[],ACCESS_REMOVAL_VERSIONS.slice(0,28),[...ACCESS_REMOVAL_VERSIONS].reverse(),[...ACCESS_REMOVAL_VERSIONS,'20990101000000']])test('incorrect history rejected '+history.length,()=>{
 assert.throws(()=>verifyAccessRemovalSchema({history,catalog:{fingerprint:ACCESS_REMOVAL_FINGERPRINT}}),/HISTORY_MISMATCH/);
});
test('no fingerprint relaxation',()=>assert.throws(()=>verifyAccessRemovalSchema({history:ACCESS_REMOVAL_VERSIONS,catalog:{fingerprint:OLD_FINGERPRINT}}),/CATALOG_MISMATCH/));
test('type comparison rejects domain changes',()=>{
 const types=readFileSync(sourcePath('src/types/supabase.ts'),'utf8');
 assert.equal(verifyAccessRemovalTypes(types,types).structuralEquivalent,true);
 assert.throws(()=>verifyAccessRemovalTypes(types,types.replace('p_actor: string','p_actor: number')),/TYPE_GATE/);
});
test('no generic migration, repair or deployment capability',()=>{
 assert.equal(accessRemovalAction('verify').apply,false);
 for(const action of ['plan','apply','STAGING_REPAIR_31_TO_32','deploy',undefined])assert.throws(()=>accessRemovalAction(action),/VERIFY_ONLY/);
});
