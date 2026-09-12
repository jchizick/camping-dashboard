import test from 'node:test';
import assert from 'node:assert/strict';
import {baseline as a,hostedStyle as b,signatures} from './fixtures/functionGrantDrift.mjs';
import {describeExecute, diagnoseExecute} from './functionGrantDiagnostic.mjs';
import {compareCatalogs} from './catalogComparison.mjs';
const signature='public.fixture()';
const grant=(role,option=false)=>['function-grant',`${signature}.${role}.EXECUTE`,option];
test('explicit service-role execution is present even when grant option is false',()=>assert.deepEqual(describeExecute([grant('service_role')],signature,'service_role'),{direct:true,throughPublic:false,aclAllows:true,grantOption:false}));
test('PUBLIC-derived execution is distinct from explicit execution',()=>assert.deepEqual(describeExecute([grant('PUBLIC')],signature,'service_role'),{direct:false,throughPublic:true,aclAllows:true,grantOption:false}));
test('redundant ACL path is diagnostic, never automatic acceptance',()=>{const a=[grant('PUBLIC')],b=[...a,grant('service_role')];assert.equal(diagnoseExecute(a,b,signature,'service_role').classification,'REDUNDANT_ACL_PATH_CHANGE');assert.equal(compareCatalogs(a,b).equivalent,false);});
test('provider-default fixture surviving PUBLIC revoke broadens execution',()=>{const local=[grant('authenticated')],hosted=[...local,grant('service_role')];assert.equal(diagnoseExecute(local,hosted,signature,'service_role').classification,'EXECUTION_ACCESS_CHANGE');assert.equal(compareCatalogs(local,hosted).equivalent,false);});
test('grant option is significant even with PUBLIC access',()=>assert.equal(diagnoseExecute([grant('PUBLIC'),grant('service_role')],[grant('PUBLIC'),grant('service_role',true)],signature,'service_role').classification,'GRANT_OPTION_CHANGE'));
for(const role of ['anon','authenticated'])test(role+' changes remain strict',()=>assert.equal(compareCatalogs([], [grant(role)]).equivalent,false));
test('unintended service grant fails regardless of function name',()=>{const d=compareCatalogs([],[grant('service_role')]);assert.equal(d.equivalent,false);assert.equal(d.authorization,false);});
test('synthetic three-function hosted drift has exactly three broadening grants without grant option',()=>{
  const diff=compareCatalogs(a,b);assert.equal(diff.equivalent,false);assert.equal(diff.differences.length,3);
  for(const name of ['create_trip','claim_trip_weather_manual','claim_trip_alerts_manual']){
    const f=signatures.find(key=>key.startsWith('public.'+name+'('));
    const d=diagnoseExecute(a,b,f,'service_role');assert.equal(d.classification,'EXECUTION_ACCESS_CHANGE');assert.equal(d.after.grantOption,false);
    for(const role of ['PUBLIC','anon'])assert.equal(describeExecute(b,f,role).aclAllows,false);
    assert.equal(describeExecute(b,f,'authenticated').aclAllows,true);
  }
});
