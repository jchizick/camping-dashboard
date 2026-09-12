// Explicit integration-evidence test: requires both fresh local replay captures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {describeCatalog,compareCatalogs} from './catalogComparison.mjs';
import {VERSIONS,SCHEMA_FINGERPRINT} from './postMigrationContract.mjs';
import {replayContext} from './replayContext.mjs';
const fresh=replayContext();
const a=fresh.before.catalog,b=fresh.repeat.catalog;
const read=name=>name==='local-1-history.json'?fresh.before.history:fresh.repeat.history;
test('both independent fresh resets replayed exactly 31',()=>{for(const n of [1,2])assert.deepEqual(read('local-'+n+'-history.json'),VERSIONS.slice(0,31));});
test('both reset fingerprints match unchanged authorization expectation',()=>{assert.equal(a.fingerprint,SCHEMA_FINGERPRINT);assert.equal(b.fingerprint,SCHEMA_FINGERPRINT);});
test('full manifests and every component match across resets',()=>{assert.deepEqual(a,b);assert.deepEqual(describeCatalog(a.catalog),describeCatalog(b.catalog));assert.deepEqual(compareCatalogs(a.catalog,b.catalog).differences,[]);});
