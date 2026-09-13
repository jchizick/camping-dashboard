import {readFileSync} from 'node:fs';
import {sourcePath} from './paths.mjs';

// Audited installed clients, not upstream master. Re-audit on dependency changes.
export const CLIENT_VERSIONS=Object.freeze({
 '@supabase/supabase-js':'2.98.0',
 '@supabase/postgrest-js':'2.98.0',
 '@supabase/ssr':'0.9.0',
});
export const CAPABILITY_PROFILE='postgrest-14-compatible';
export const CAPABILITIES=Object.freeze({maxAffected:true,spreadOnMany:true});
export function assertClientVersions(locked,installed){
 for(const [name,version] of Object.entries(CLIENT_VERSIONS))
  if(locked[name]!==version||installed[name]!==version)throw Error('POSTGREST_CLIENT_REVIEW_REQUIRED');
}
export function verifyInstalledClient(){
 const lock=JSON.parse(readFileSync(sourcePath('package-lock.json'),'utf8'));
 const locked={},installed={};
 for(const name of Object.keys(CLIENT_VERSIONS)){
  locked[name]=lock.packages?.['node_modules/'+name]?.version;
  installed[name]=JSON.parse(readFileSync(sourcePath('node_modules',name,'package.json'),'utf8')).version;
 }
 assertClientVersions(locked,installed);
 return CLIENT_VERSIONS;
}
export function classifyPostgrestVersion(value){
 // Hosted generators emit major.minor; also accept standard major.minor.patch.
 // No coercion, leading zeroes, prerelease/build suffixes or unbounded integers.
 const match=typeof value==='string'&&/^(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/.exec(value);
 if(!match||match.slice(1).filter(v=>v!==undefined).some(v=>!Number.isSafeInteger(Number(v))))
  return {verdict:'POSTGREST_VERSION_INVALID',profile:null};
 // The installed flags use 13/14 prefixes, but only 14 is the reviewed hosted
 // server family. Do not silently approve a downgrade to 13 or future major.
 if(match[1]!=='14')return {verdict:'POSTGREST_VERSION_UNSUPPORTED',profile:null};
 return {verdict:'POSTGREST_CAPABILITY_PASS',profile:CAPABILITY_PROFILE,capabilities:CAPABILITIES};
}
