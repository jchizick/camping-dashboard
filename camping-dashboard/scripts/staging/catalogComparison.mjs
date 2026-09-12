// Diagnostic only: none of these hashes can authorize a hosted action.
import {createHash} from 'node:crypto';
export const CATEGORIES=['column','constraint','function','function-grant','index','policy','relation','relation-grant','trigger'];
const compare=(a,b)=>Buffer.compare(Buffer.from(JSON.stringify(a)),Buffer.from(JSON.stringify(b)));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function normalizeCatalog(catalog) {
 if(!Array.isArray(catalog)||catalog.length>20000)throw new Error('CATALOG_MANIFEST_INVALID');
 const seen=new Set();
 return catalog.map(entry=>{
  if(!Array.isArray(entry)||entry.length!==3||!CATEGORIES.includes(entry[0])||typeof entry[1]!=='string'||!entry[1].startsWith('public.')&&!entry[1].startsWith('app_private.'))throw new Error('CATALOG_MANIFEST_INVALID');
  const [kind,key]=entry,id=JSON.stringify([kind,key]);
  if(seen.has(id))throw new Error('CATALOG_DUPLICATE_ENTRY');seen.add(id);
  let value=structuredClone(entry[2]);
  const valid=kind==='column'?Array.isArray(value)&&value.length===5&&typeof value[0]==='string'&&typeof value[1]==='boolean'&&typeof value[2]==='string'&&typeof value[3]==='string'&&(value[4]===null||typeof value[4]==='string'):
   kind==='relation'?Array.isArray(value)&&value.length===3&&typeof value[0]==='string'&&typeof value[1]==='boolean'&&typeof value[2]==='boolean':
   kind==='policy'?Array.isArray(value)&&value.length===5&&typeof value[0]==='string'&&Array.isArray(value[1])&&value[1].every(r=>typeof r==='string')&&typeof value[2]==='string'&&value.slice(3).every(v=>v===null||typeof v==='string'):
   kind==='trigger'?Array.isArray(value)&&value.length===2&&value.every(v=>typeof v==='string'):
   kind.endsWith('-grant')?typeof value==='boolean':typeof value==='string';
  if(!valid)throw new Error('CATALOG_MANIFEST_INVALID');
  // Role membership and entry order are sets. SQL expressions/bodies are untouched.
  if(kind==='policy')value[1].sort(compare);
  return [kind,key,value];
 }).sort(compare);
}
export function describeCatalog(catalog) {
 const normalized=normalizeCatalog(catalog);
 const components=Object.fromEntries(CATEGORIES.map(k=>{const rows=normalized.filter(e=>e[0]===k);return [k,{count:rows.length,sha256:digest(rows)}];}));
 const rls=normalized.filter(e=>e[0]==='relation').map(e=>[e[1],...e[2].slice(1)]);
 const sequences=normalized.filter(e=>e[0]==='relation'&&e[2][0]==='S');
 components.rls={count:rls.length,sha256:digest(rls)};
 components.sequences={count:sequences.length,sha256:digest(sequences)};
 // Portable semantic core, intentionally NOT a replacement for mandatory full comparison.
 // Omits deparsed expressions/defaults/DDL and owner-derived ACLs from this secondary hash only.
 const core=normalized.filter(e=>['relation','column'].includes(e[0])).map(([k,n,v])=>[k,n,k==='column'?v.slice(0,4):v]);
 return {version:1,authorization:false,normalized,components,fullManifestSha256:digest(normalized),
   stableCoreSha256:digest(core),stableCoreScope:'relation identity/kind/RLS; column identity/type/nullability/identity/generated',
   excludedFromCoreStillMandatory:true};
}
export function compareCatalogs(expected,actual) {
 const a=describeCatalog(expected),b=describeCatalog(actual);
 const left=new Map(a.normalized.map(e=>[JSON.stringify(e.slice(0,2)),e]));
 const right=new Map(b.normalized.map(e=>[JSON.stringify(e.slice(0,2)),e]));
 const differences=[];
 for(const id of [...new Set([...left.keys(),...right.keys()])].sort(compare)) {
  const x=left.get(id),y=right.get(id);if(JSON.stringify(x)===JSON.stringify(y))continue;
  const kind=(x??y)[0];
  const stableChange=!x||!y||kind.endsWith('-grant')||kind==='relation'||kind==='column'&&JSON.stringify(x[2].slice(0,4))!==JSON.stringify(y[2].slice(0,4));
  differences.push({kind,key:(x??y)[1],change:!x?'added':!y?'missing':'changed',
   classification:stableChange?'SUBSTANTIVE':'UNPROVEN_ENVIRONMENT_OR_SUBSTANTIVE',before:x?.[2]??null,after:y?.[2]??null});
 }
 return {equivalent:differences.length===0,classification:differences.length?'REVIEW_REQUIRED':'EQUIVALENT',authorization:false,
  components:Object.fromEntries(Object.keys(a.components).map(k=>[k,{...b.components[k],expectedSha256:a.components[k].sha256,match:a.components[k].sha256===b.components[k].sha256}])),
  stableCoreMatch:a.stableCoreSha256===b.stableCoreSha256,differences};
}
