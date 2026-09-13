import test from 'node:test';
import assert from 'node:assert/strict';
import {compareTypes,describeTypeDifferences} from './typeComparison.mjs';
const baseline='export type Database = { public: { Tables: { trips: { Row: { id: string; name: string | null }; Insert: { id?: string }; Update: { name?: string } } }; Functions: { bridge: { Args: { actor: string }; Returns: boolean } } } };';
for(const [name,text] of [
 ['line endings',baseline.replaceAll(';',';\r\n')],['header','// generated header\n'+baseline],
 ['formatting',baseline.replaceAll(' {','\n{')],['property ordering',baseline.replace('id: string; name: string | null','name: string | null; id: string')],
]) test(name,()=>assert.ok(compareTypes(baseline,text).equivalent));
for(const [name,text] of [
 ['column type',baseline.replace('id: string;','id: number;')],['nullability',baseline.replace('string | null','string')],
 ['function args',baseline.replace('actor: string','actor: number')],['function return',baseline.replace('Returns: boolean','Returns: string')],
 ['table missing',baseline.replace('trips: {','other: {')],['insert optional',baseline.replace('id?:','id:')],
 ['update shape',baseline.replace('name?: string','name?: number')],
 ['literal whitespace','export type Database = "a  b"'],
]) test(name,()=>assert.equal(compareTypes(baseline,text).equivalent,false));
test('tuple ordering retained',()=>assert.equal(compareTypes('type T=[string, number]','type T=[number, string]').equivalent,false));
test('malformed input fails closed',()=>assert.throws(()=>compareTypes(baseline,'type X = {'),/PARSE/));

test('metadata and parenthesized constraint reported without weakening acceptance',()=>{
 const a='export type Database={public:{Tables:{}}}; export type Helper<T extends string = string> = T;';
 const b='export type Database={__InternalSupabase:{PostgrestVersion:"14.5"};public:{Tables:{}}}; export type Helper<T extends (string) = string> = T;';
 assert.deepEqual(describeTypeDifferences(a,b).map(d=>d.path),['Database.__InternalSupabase.PostgrestVersion','Helper.typeParameters.T.constraint']);
 assert.equal(compareTypes(a,b).equivalent,false);
});
for(const [name,from,to,path,classification] of [
 ['column','id: string;','id: number;','Database.public.Tables.trips.Row.id','TABLE_SHAPE'],
 ['optional','id?: string','id: string','Database.public.Tables.trips.Insert.id.optional','TABLE_SHAPE'],
 ['RPC','actor: string','actor: number','Database.public.Functions.bridge.Args.actor','FUNCTION_TYPE'],
])test('diagnostic '+name,()=>{
 const differences=describeTypeDifferences(baseline,baseline.replace(from,to));
 assert.equal(differences.length,1);assert.equal(differences[0].path,path);assert.equal(differences[0].classification,classification);
 assert.equal(compareTypes(baseline,baseline.replace(from,to)).equivalent,false);
});
test('relationship tuple differences stay visible and rejected',()=>{
 const a='type Database={public:{Tables:{trips:{Relationships:[{foreignKeyName:"fk";isOneToOne:false}]}}}};';
 const b=a.replace('false','true');
 assert.equal(describeTypeDifferences(a,b)[0].path,'Database.public.Tables.trips.Relationships');
 assert.equal(describeTypeDifferences(a,b)[0].classification,'RELATIONSHIP_METADATA');
 assert.equal(compareTypes(a,b).equivalent,false);
});
test('constant identity does not depend on preceding source offsets',()=>{
 assert.deepEqual(describeTypeDifferences('type T=string; export const C={x:1} as const;','// header\ntype T = string;\n export const C = { x: 1 } as const;'),[]);
});
test('diagnostic refuses malformed and duplicate properties',()=>{
 assert.throws(()=>describeTypeDifferences(baseline,'type X={'),/PARSE/);
 assert.throws(()=>describeTypeDifferences('type X={a:string;a:number}',baseline),/DUPLICATE/);
});
