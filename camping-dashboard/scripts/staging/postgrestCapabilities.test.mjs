import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import ts from 'typescript';
import {sourcePath} from './paths.mjs';
import {CLIENT_VERSIONS,assertClientVersions,verifyInstalledClient,classifyPostgrestVersion} from './postgrestCapabilities.mjs';

test('installed versions equal the reviewed lockfile graph',()=>assert.deepEqual(verifyInstalledClient(),CLIENT_VERSIONS));
for(const name of Object.keys(CLIENT_VERSIONS))for(const side of ['locked','installed'])test(name+' '+side+' upgrade requires review',()=>{
 const locked={...CLIENT_VERSIONS},installed={...CLIENT_VERSIONS};
 (side==='locked'?locked:installed)[name]='2.99.0';
 assert.throws(()=>assertClientVersions(locked,installed),/POSTGREST_CLIENT_REVIEW_REQUIRED/);
});
for(const value of [null,undefined,14.17,'','14','v14.17','14.17.0.1','14.17-beta','14.17.0-rc.1','14.17+build','14.17.0+build','014.17','14.017','14.17.00','14.17\n','14.17 ','14.9007199254740992'])test('format fails closed '+JSON.stringify(value),()=>assert.equal(classifyPostgrestVersion(value).verdict,'POSTGREST_VERSION_INVALID'));
for(const version of ['12.99','13.0','13.99','15.0','140.0'])test('server family fails closed '+version,()=>assert.equal(classifyPostgrestVersion(version).verdict,'POSTGREST_VERSION_UNSUPPORTED'));
for(const version of ['14.0','14.5','14.17','14.17.0','14.999.999'])test('reviewed family '+version,()=>assert.equal(classifyPostgrestVersion(version).profile,'postgrest-14-compatible'));

test('complete installed source inventory of version-dependent types',()=>{
 const found=[];
 for(const pkg of Object.keys(CLIENT_VERSIONS)){
  const base=sourcePath('node_modules',pkg,'src');
  function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){
   const path=resolve(dir,entry.name);if(entry.isDirectory())walk(path);
   else if(/\.ts$/.test(path)&&/PostgrestVersion|MaxAffectedEnabled|SpreadOnManyEnabled/.test(readFileSync(path,'utf8')))found.push(pkg+'/'+relative(base,path).replaceAll('\\','/'));
  }}walk(base);
 }
 assert.deepEqual(found.sort(),[
  '@supabase/postgrest-js/PostgrestTransformBuilder.ts',
  '@supabase/postgrest-js/select-query-parser/result.ts',
  '@supabase/postgrest-js/types/common/common.ts',
  '@supabase/postgrest-js/types/feature-flags.ts',
  '@supabase/supabase-js/SupabaseClient.ts',
  '@supabase/supabase-js/index.ts',
  '@supabase/supabase-js/lib/rest/types/common/common.ts',
 ].sort());
});

const schema=`type Schema={public:{Tables:{
 trips:{Row:{id:number;name:string};Insert:{id?:number;name:string};Update:{name?:string};Relationships:[]};
 members:{Row:{id:number;trip_id:number;name:string};Insert:{trip_id:number;name:string};Update:{name?:string};Relationships:[{foreignKeyName:'members_trip_id_fkey';columns:['trip_id'];isOneToOne:false;referencedRelation:'trips';referencedColumns:['id']}]}
 };Views:{};Functions:{trip_rows:{Args:{trip_id:number};Returns:{id:number;name:string}[]}};Enums:{};CompositeTypes:{}}};`;
function fixture(version,enabled){
 const metadata=version===null?'':`&{__InternalSupabase:{PostgrestVersion:${JSON.stringify(version)}}}`;
 return `import type {SupabaseClient,QueryData} from '@supabase/supabase-js';
 import type {MaxAffectedEnabled,SpreadOnManyEnabled} from '../../node_modules/@supabase/postgrest-js/src/types/feature-flags';
 type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
 type Assert<T extends true>=T;
 type Flag1=Assert<Equal<MaxAffectedEnabled<${version===null?'undefined':JSON.stringify(version)}>,${enabled}>>;
 type Flag2=Assert<Equal<SpreadOnManyEnabled<${version===null?'undefined':JSON.stringify(version)}>,${enabled}>>;
 type All14Max=Assert<Equal<MaxAffectedEnabled<\`14.\${number}\`>,true>>;
 type All14Spread=Assert<Equal<SpreadOnManyEnabled<\`14.\${number}.\${number}\`>,true>>;
 ${schema}
 declare const client:SupabaseClient<Schema${metadata}>;
 const patch=client.from('trips').update({name:'synthetic'});const maxPatch=patch.maxAffected(1);
 const del=client.from('trips').delete();const maxDelete=del.maxAffected(1);
 const rpc=client.rpc('trip_rows',{trip_id:1});const maxRpc=rpc.maxAffected(1);
 type Patch=Assert<Equal<typeof maxPatch,${enabled?'typeof patch':"{Error:'maxAffected method only available on postgrest 13+'}"}>>;
 type Delete=Assert<Equal<typeof maxDelete,${enabled?'typeof del':"{Error:'maxAffected method only available on postgrest 13+'}"}>>;
 type Rpc=Assert<Equal<typeof maxRpc,${enabled?'typeof rpc':"{Error:'maxAffected method only available on postgrest 13+'}"}>>;
 const selectMax=client.from('trips').select('id').maxAffected(1);
 type Method=Assert<Equal<typeof selectMax,{Error:${enabled?"'maxAffected method only available on update or delete'":"'maxAffected method only available on postgrest 13+'"}}>>;
 const many=client.from('trips').select('id,...members(name)');
 type Many=Assert<Equal<QueryData<typeof many>,${enabled?'{id:number;name:string[]}[]':"{id:number;members:{error:true}&'\"trips\" and \"members\" do not form a many-to-one or one-to-one relationship spread not possible'}[]"}>>;
 const nested=client.from('trips').select('id,members(name)');
 type Nested=Assert<Equal<QueryData<typeof nested>,{id:number;members:{name:string}[]}[]>>;
 const one=client.from('members').select('...trips(name)');
 type One=Assert<Equal<QueryData<typeof one>,{name:string}[]>>;
 const inserted=client.from('trips').insert({name:'synthetic'}).select('id,name');
 type Insert=Assert<Equal<QueryData<typeof inserted>,{id:number;name:string}[]>>;
 // @ts-expect-error existing column contracts remain strict
 client.from('trips').update({name:123});
 // @ts-expect-error existing RPC arguments remain strict
 client.rpc('trip_rows',{trip_id:'invalid'});
 `;
}
function compile(text){
 const file=sourcePath('scripts/staging/__capability_fixture.mts');
 const options={noEmit:true,strict:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler};
 const host=ts.createCompilerHost(options),read=host.readFile,exists=host.fileExists;
 host.readFile=p=>resolve(p)===file?text:read(p);host.fileExists=p=>resolve(p)===file||exists(p);
 const program=ts.createProgram([file],options,host);
 return ts.getPreEmitDiagnostics(program).map(d=>({line:d.file?d.file.getLineAndCharacterOfPosition(d.start??0).line+1:null,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));
}
// Public SDK inference AND direct installed flags; nothing is executed or emitted.
for(const [version,enabled] of [[null,false],['12.99',false],['13.0',true],['13.99',true],['14.0',true],['14.5',true],['14.17',true],['14.17.0',true],['14.999',true],['15.0',false]])
 test('installed client compilation '+version,()=>assert.deepEqual(compile(fixture(version,enabled)),[]));
