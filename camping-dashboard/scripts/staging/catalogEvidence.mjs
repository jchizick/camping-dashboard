import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {describeCatalog,compareCatalogs} from './catalogComparison.mjs';
// Save first, compare second: a failure cannot discard the forensic input.
// The caller supplies only the catalog envelope, never raw psql output/credentials.
export function saveCatalogEvidence(directory,label,envelope,expected) {
 if(!/^(local-[12]|probe-[AB])$/.test(label))throw new Error('CATALOG_LABEL_INVALID');
 if(!envelope||!Array.isArray(envelope.catalog)||!/^[a-f0-9]{32}$/.test(envelope.fingerprint))throw new Error('CATALOG_ENVELOPE_INVALID');
 mkdirSync(directory,{recursive:true});
 const base=join(directory,label);
 writeFileSync(base+'-manifest.json',JSON.stringify({fingerprint:envelope.fingerprint,catalog:envelope.catalog},null,2)+'\n');
 const diagnostic=describeCatalog(envelope.catalog);
 writeFileSync(base+'-components.json',JSON.stringify(diagnostic,null,2)+'\n');
 const diff=expected?compareCatalogs(expected,envelope.catalog):null;
 if(diff)writeFileSync(base+'-diff.json',JSON.stringify(diff,null,2)+'\n');
 return {manifest:base+'-manifest.json',components:base+'-components.json',diff:diff?base+'-diff.json':null,
   fingerprint:envelope.fingerprint,fullManifestSha256:diagnostic.fullManifestSha256,stableCoreSha256:diagnostic.stableCoreSha256,
   componentMatches:diff?Object.fromEntries(Object.entries(diff.components).map(([k,v])=>[k,v.match])):null,authorization:false};
}
export function captureProbeCatalog(output,directory,label,expectedPath) {
 let row;try{row=JSON.parse(output);}catch{throw new Error('CATALOG_ENVELOPE_INVALID');}
 // Project provenance/TLS are checked by the runner before either probe.
 // Capture is evidence only: a mismatch still aborts before type generation.
 if(row.database_name!=='postgres'||row.database_user!=='postgres'||row.session_user!=='postgres'||row.read_only!=='on')throw new Error('CATALOG_SESSION_INVALID');
 const expected=JSON.parse(readFileSync(expectedPath,'utf8'));
 return saveCatalogEvidence(directory,label,row.catalog_diagnostic,expected.catalog);
}
