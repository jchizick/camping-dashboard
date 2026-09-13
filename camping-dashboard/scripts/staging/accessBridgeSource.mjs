import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,relative,dirname,isAbsolute} from 'node:path';
import {SOURCE_ROOT} from './paths.mjs';
import {accessRemovalInventory} from './accessRemovalContract.mjs';
import {FILE,FILE_HASH,hash,fail} from './accessBridgeContract.mjs';
// Only the shipped CLI's static local dependency closure, not ignored prep artifacts.
export function sourceFiles(root=SOURCE_ROOT){
 const seen=new Set();
 function visit(name){const path=resolve(root,name),rel=relative(root,path).replaceAll('\\','/');
  if(rel.startsWith('..')||isAbsolute(rel)||!existsSync(path))fail('SOURCE_DEPENDENCY_MISMATCH');
  if(statSync(path).isDirectory())return;
  if(seen.has(rel))return;seen.add(rel);
  if(!/\.[cm]?js$/.test(rel))return;
  const text=readFileSync(path,'utf8');
  for(const match of text.matchAll(/(?:from\s*|import\s*|new URL\(\s*)['"](\.[^'"]+)['"]/g))visit(relative(root,resolve(dirname(path),match[1])));
 }
 visit('scripts/staging/access-bridge-32-to-33.mjs');
 for(const path of ['package.json','package-lock.json','src/types/supabase.ts'])visit(path);
 for(const e of accessRemovalInventory(root))seen.add('supabase/migrations/'+e.name);
 return [...seen].sort();
}
export function requireCommittedSource(approved,root=SOURCE_ROOT,readGit){
 if(!/^[a-f0-9]{40}$/.test(approved??''))fail('APPROVED_SOURCE_REQUIRED');
 const git=readGit??(args=>execFileSync('git',['-c',`safe.directory=${resolve(root,'..').replaceAll('\\','/')}`,...args],{cwd:root,stdio:'pipe'}));
 try{
  if(git(['rev-parse','HEAD']).toString().trim()!==approved)fail('SOURCE_REVISION_MISMATCH');
  const prefix=git(['rev-parse','--show-prefix']).toString().trim();
  for(const name of sourceFiles(root)){
   const committed=git(['show',`${approved}:${prefix}${name}`]);
   const current=readFileSync(resolve(root,name));
   if(name==='supabase/migrations/'+FILE){if(hash(committed)!==FILE_HASH||hash(current)!==FILE_HASH)fail('MIGRATION_FILE_MISMATCH');}
   else if(committed.toString().replaceAll('\r\n','\n')!==current.toString().replaceAll('\r\n','\n'))fail('UNCOMMITTED_DEPENDENCY');
  }
 }catch(e){if(/^ACCESS_BRIDGE_/.test(e.message))throw e;fail('SOURCE_NOT_COMMITTED');}
 return approved;
}
