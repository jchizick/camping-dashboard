import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('./access-removal-in-page.js',import.meta.url),'utf8');
const target={tripId:'synthetic-removal-qa',membershipId:'10000000-0000-0000-0000-000000000812',expected:'allowed',confirmRemoval:true};
function harness(origin='https://staging.fieldprotocol.online',status=200,body={outcome:'access_removed'}) {
 const calls=[];
 const context=vm.createContext({location:{origin},AbortSignal,fetch:async(...args)=>{calls.push(args);return {status,json:async()=>body};}});
 vm.runInContext(source,context);
 assert.equal(calls.length,0);
 return {calls,run:context.fieldProtocolAccessRemovalQA};
}
test('same product endpoint, cookie session, target-only payload and sanitized result',async()=>{
 const h=harness();assert.equal((await h.run(target)).verdict,'PASS');
 assert.equal(h.calls[0][0],'/api/invitations');
 const options=h.calls[0][1];assert.equal(options.credentials,'same-origin');assert.equal(options.redirect,'error');
 assert.deepEqual(JSON.parse(options.body),{operation:'remove_access',tripId:target.tripId,membershipId:target.membershipId});
 assert.deepEqual(Object.keys(options.headers),['Content-Type']);
});
for(const origin of ['https://www.fieldprotocol.online','https://other.test','http://staging.fieldprotocol.online']) test('rejects origin '+origin,async()=>{
 const h=harness(origin);await assert.rejects(h.run(target),/STAGING_ORIGIN/);assert.equal(h.calls.length,0);
});
for(const [status,code,expected] of [[403,'not_authorized','denied'],[401,'not_authenticated','signed_out']]) test(expected,async()=>{
 assert.equal((await harness(undefined,status,{code}).run({...target,expected})).verdict,'PASS');
});
test('disabled/missing schema cannot be reported as authorization PASS',async()=>{
 assert.equal((await harness(undefined,503,{code:'invitation_failed'}).run({...target,expected:'denied'})).verdict,'FAIL');
});
test('requires explicit confirmation and a strict target',async()=>{
 const h=harness();await assert.rejects(h.run({...target,confirmRemoval:false}));await assert.rejects(h.run({...target,membershipId:'bad'}));assert.equal(h.calls.length,0);
});
