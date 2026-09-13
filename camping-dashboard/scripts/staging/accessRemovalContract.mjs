// Revision 33, verification only. The completed 31->32 repair contract stays frozen.
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {hash,compareTypes} from './typeComparison.mjs';
import {VERSIONS as BASE_VERSIONS,HISTORY_SHA256,SCHEMA_QUERY_SHA256,SCHEMA_SQL} from './postMigrationContract.mjs';
import {compareHostedTypes} from './hostedTypeGate.mjs';
const extension=JSON.parse(readFileSync(new URL('./accessRemovalMigration.json',import.meta.url),'utf8'));
const base=JSON.parse(readFileSync(new URL('./migrations.json',import.meta.url),'utf8'));
export const ACCESS_REMOVAL_VERSIONS=[...BASE_VERSIONS,extension.migration.name.slice(0,14)];
export const ACCESS_REMOVAL_FINGERPRINT='58c4311b982fe8716cbc19ea5c687093';
export const ACCESS_REMOVAL_STATE='POST_ACCESS_REMOVAL_STAGING_33';
export function exactMigrationBytes(bytes,expected) {
  if(hash(bytes)===expected)return bytes;
  // Reconstruct ONLY the already pinned historical bytes after checkout EOL conversion.
  // No SQL/canonical catalog normalization, and no unchecked fallback.
  const lf=bytes.toString('utf8').replace(/\r\n/g,'\n');
  if(hash(lf)===expected)return Buffer.from(lf);
  const crlf=lf.replace(/\n/g,'\r\n');
  if(hash(crlf)===expected)return Buffer.from(crlf);
  throw Error('ACCESS_REMOVAL_MIGRATION_BYTES_MISMATCH');
}
export function accessRemovalInventory(root) {
  if(extension.version!==1||extension.baseCount!==32||extension.baseHistorySha256!==HISTORY_SHA256
    ||hash(JSON.stringify(BASE_VERSIONS))!==HISTORY_SHA256||hash(SCHEMA_SQL)!==SCHEMA_QUERY_SHA256
    ||extension.migration.name!=='20260913131931_trip_access_removal_bridge.sql')throw Error('ACCESS_REMOVAL_CONTRACT_REVIEW_REQUIRED');
  const entries=[...base.migrations,extension.migration];
  const names=readdirSync(join(root,'supabase/migrations')).filter(n=>n.endsWith('.sql')).sort();
  if(JSON.stringify(names)!==JSON.stringify(entries.map(e=>e.name)))throw Error('ACCESS_REMOVAL_INVENTORY_MISMATCH');
  return entries.map(e=>({...e,bytes:exactMigrationBytes(readFileSync(join(root,'supabase/migrations',e.name)),e.sha256)}));
}
export function verifyAccessRemovalSchema({history,catalog}) {
  if(JSON.stringify(history)!==JSON.stringify(ACCESS_REMOVAL_VERSIONS))throw Error('ACCESS_REMOVAL_HISTORY_MISMATCH');
  if(!/^[a-f0-9]{32}$/.test(ACCESS_REMOVAL_FINGERPRINT)||catalog?.fingerprint!==ACCESS_REMOVAL_FINGERPRINT)throw Error('ACCESS_REMOVAL_CATALOG_MISMATCH');
  return {state:ACCESS_REMOVAL_STATE,migrations:33,fingerprint:ACCESS_REMOVAL_FINGERPRINT,apply:false};
}
export function verifyAccessRemovalTypes(baseline,actual,{hosted=false}={}) {
  if(hosted) {
    const result=compareHostedTypes(baseline,actual);
    if(!result.equivalent)throw Error('ACCESS_REMOVAL_HOSTED_TYPE_GATE_FAILED');
    return result;
  }
  const strip=s=>s.replace(/\r\n/g,'\n').replace(/^\/\/ This file is generated[^]*?\n\n/,'').trim();
  const comparison=compareTypes(baseline,actual);
  if(!comparison.equivalent||strip(baseline)!==strip(actual))throw Error('ACCESS_REMOVAL_LOCAL_TYPE_GATE_FAILED');
  return {normalizedEquivalent:true,structuralEquivalent:true};
}
export function accessRemovalAction(action) {
  if(action!=='verify')throw Error('ACCESS_REMOVAL_VERIFY_ONLY');
  return {apply:false,deploy:false};
}
