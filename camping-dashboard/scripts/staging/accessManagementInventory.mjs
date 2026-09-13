// Exact repository inventory. Historical EOL reconstruction remains hash checked;
// migration 34 must match the reviewed physical bytes without normalization.
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {hash} from './typeComparison.mjs';
import {exactMigrationBytes} from './accessRemovalContract.mjs';
import {VERSIONS as BASE,HISTORY_SHA256} from './postMigrationContract.mjs';
export const VERSION='20260913204351';
export const FILE=VERSION+'_trip_access_management_read.sql';
export const FILE_HASH='e54a591b31157766771fdef6cf7b4de3eff539434ae6156a690d16041a91aaf3';
export function accessManagementInventory(root){
 const base=JSON.parse(readFileSync(new URL('./migrations.json',import.meta.url),'utf8'));
 const extension=JSON.parse(readFileSync(new URL('./accessRemovalMigration.json',import.meta.url),'utf8'));
 if(hash(JSON.stringify(BASE))!==HISTORY_SHA256||extension.baseHistorySha256!==HISTORY_SHA256||extension.baseCount!==32||extension.version!==1)throw Error('ACCESS_MANAGEMENT_INVENTORY_MISMATCH');
 const entries=[...base.migrations,extension.migration,{name:FILE,sha256:FILE_HASH}];
 const names=readdirSync(join(root,'supabase/migrations')).filter(n=>n.endsWith('.sql')).sort();
 if(JSON.stringify(names)!==JSON.stringify(entries.map(e=>e.name)))throw Error('ACCESS_MANAGEMENT_INVENTORY_MISMATCH');
 return entries.map(e=>{const bytes=readFileSync(join(root,'supabase/migrations',e.name));
  if(e.name===FILE&&hash(bytes)!==FILE_HASH)throw Error('ACCESS_MANAGEMENT_MIGRATION_FILE_MISMATCH');
  return {...e,bytes:e.name===FILE?bytes:exactMigrationBytes(bytes,e.sha256)};
 });
}
