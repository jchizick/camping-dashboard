import test from 'node:test';
import assert from 'node:assert/strict';
import {compareHostedTypes,CONSTRAINTS} from './hostedTypeGate.mjs';
import {compareTypes} from './typeComparison.mjs';
const db='export type Database={public:{Tables:{trips:{Row:{id:string|null};Insert:{id?:string};Update:{id?:string};Relationships:[{foreignKeyName:"fk";isOneToOne:false}]}};Functions:{rpc:{Args:{id:string};Returns:string}};Views:{v:{Row:{id:string}}};Enums:{e:"a"|"b"};CompositeTypes:{c:{id:string}}}};';
const metadata=(text,version='"14.5"')=>text.replace('Database={','Database={__InternalSupabase:{PostgrestVersion:'+version+'};');
const constraint='T extends keyof U ? A | B : C';
for(const [alias,param] of Object.entries(CONSTRAINTS)){
 const a=db+`type ${alias}<${param} extends ${constraint}> = ${param};`;
 test(alias+' redundant nested parentheses',()=>assert.equal(compareHostedTypes(a,metadata(db)+`type ${alias}<${param} extends ((T extends (keyof U) ? (A | B) : C))> = ${param};`).typeVerdict,'HOSTED_TYPE_GATE_PASS'));
 for(const [label,changed] of [['branch',constraint.replace(': C',': D')],['union',constraint.replace('A | B','A | D')],['operator',constraint.replace('A | B','A & B')],['identifier',constraint.replace('T extends','X extends')],['keyof',constraint.replace('keyof U','keyof V')]])
  test(alias+' rejects '+label,()=>assert.equal(compareHostedTypes(a,metadata(db)+`type ${alias}<${param} extends ${changed}> = ${param};`).typeVerdict,'TYPE_CONSTRAINT_DIFFERENCE'));
}
test('precedence is preserved',()=>assert.equal(compareHostedTypes(db+'type Tables<TableName extends (A | B)[]> = TableName;',metadata(db)+'type Tables<TableName extends A | B[]> = TableName;').typeVerdict,'TYPE_CONSTRAINT_DIFFERENCE'));
test('unreviewed constraint parentheses not normalized',()=>assert.equal(compareHostedTypes(db+'type Other<T extends string>=T;',metadata(db)+'type Other<T extends (string)>=T;').equivalent,false));
test('14.5 pass',()=>assert.equal(compareHostedTypes(db,metadata(db)).typeVerdict,'HOSTED_TYPE_GATE_PASS'));
test('missing hosted fails',()=>assert.equal(compareHostedTypes(db,db).typeVerdict,'POSTGREST_METADATA_MISSING'));
for(const value of ['14.5','string','"garbage"','"14"','"14.17-beta"','"14.17+build"','"14.017"','" 14.17"'])test('invalid metadata '+value,()=>assert.equal(compareHostedTypes(db,metadata(db,value)).typeVerdict,'POSTGREST_VERSION_INVALID'));
for(const version of ['14.0','14.5','14.17','14.5.0','14.17.1','14.999'])test('compatible hosted '+version,()=>{
 const r=compareHostedTypes(db,metadata(db,JSON.stringify(version)));
 assert.equal(r.typeVerdict,'HOSTED_TYPE_GATE_PASS');assert.equal(r.capability.actual,version);
 assert.equal(r.capability.profile,'postgrest-14-compatible');
 assert.deepEqual(r.capability.capabilities,{maxAffected:true,spreadOnMany:true});
});
for(const version of ['12.9','13.0','13.99','15.0','140.0'])test('unreviewed major '+version,()=>assert.equal(compareHostedTypes(db,metadata(db,JSON.stringify(version))).typeVerdict,'POSTGREST_VERSION_UNSUPPORTED'));
test('baseline metadata must also be compatible',()=>{
 assert.equal(compareHostedTypes(metadata(db,'"14.5"'),metadata(db,'"14.17"')).typeVerdict,'HOSTED_TYPE_GATE_PASS');
 assert.equal(compareHostedTypes(metadata(db,'"15.0"'),metadata(db,'"14.17"')).equivalent,false);
});
test('extra metadata field fails',()=>assert.equal(compareHostedTypes(db,metadata(db).replace('PostgrestVersion:"14.5"','PostgrestVersion:"14.5";Other:true')).typeVerdict,'POSTGREST_VERSION_INVALID'));
test('optional metadata fails',()=>assert.equal(compareHostedTypes(db,metadata(db).replace('PostgrestVersion:','PostgrestVersion?:')).typeVerdict,'POSTGREST_VERSION_INVALID'));
test('duplicate metadata fails closed',()=>assert.throws(()=>compareHostedTypes(db,metadata(db).replace('__InternalSupabase:', '__InternalSupabase:{PostgrestVersion:"14.5"};__InternalSupabase:')),/DUPLICATE/));
test('local absence is not hosted capability proof',()=>{
 assert.equal(compareTypes(db,db).capabilityVerdict,'LOCAL_CAPABILITY_METADATA_NOT_APPLICABLE');
 assert.equal(compareHostedTypes(db,db).equivalent,false);
});
for(const [label,from,to] of [['column','id:string|null','id:number|null'],['nullability','id:string|null','id:string'],['insert','id?:string','id:string'],['relationship','isOneToOne:false','isOneToOne:true'],['RPC args','Args:{id:string}','Args:{id:number}'],['RPC return','Returns:string','Returns:number'],['enum','e:"a"|"b"','e:"a"|"c"'],['composite','c:{id:string}','c:{id:number}'],['view','v:{Row:{id:string}}','v:{Row:{id:number}}'],['table','trips:','other:']])
 test('schema drift '+label,()=>assert.equal(compareHostedTypes(db,metadata(db.replace(from,to))).typeVerdict,'TYPE_STRUCTURE_DIFFERENCE'));
test('malformed source fails closed',()=>assert.throws(()=>compareHostedTypes(db,'type X={'),/PARSE/));
