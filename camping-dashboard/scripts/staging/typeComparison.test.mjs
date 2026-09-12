import test from 'node:test';
import assert from 'node:assert/strict';
import {compareTypes} from './typeComparison.mjs';
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
