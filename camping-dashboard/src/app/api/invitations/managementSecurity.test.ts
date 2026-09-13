import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({getUser:vi.fn(),bridge:vi.fn(),consume:vi.fn()}));
vi.mock('@/lib/serverSupabase',()=>({createRequestSupabaseClient:async()=>({auth:{getUser:mocks.getUser}})}));
vi.mock('@/lib/invitations/server',()=>({callInvitationBridge:mocks.bridge,consumeInvitationRates:mocks.consume}));
import {GET,POST} from './route';
beforeEach(()=>{
  mocks.getUser.mockResolvedValue({data:{user:{id:'verified-user'}},error:null});
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('TRIP_INVITATIONS_LOCAL','false');
  vi.stubEnv('TRIP_INVITATIONS_ENABLED','false');
  vi.stubEnv('RESEND_API_KEY','');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','');
});
afterEach(()=>vi.unstubAllEnvs());
it('uses the real disabled config: false availability and no schema-dependent call',async()=>{
  expect(await (await GET(new NextRequest('https://app.example.test/api/invitations'))).json()).toEqual({tripAccessAvailable:false});
  const response=await POST(new NextRequest('https://app.example.test/api/invitations',{
    method:'POST',headers:{origin:'https://app.example.test','content-type':'application/json'},
    body:JSON.stringify({operation:'list_access',tripId:'trip-fixture'})}));
  expect(response.status).toBe(503);expect(await response.json()).toEqual({code:'delivery_unavailable'});
  expect(mocks.bridge).not.toHaveBeenCalled();expect(mocks.consume).not.toHaveBeenCalled();
});
it.each(['RESEND_API_KEY','SUPABASE_SERVICE_ROLE_KEY','TRIP_INVITATIONS_PROVIDER'])('disabled availability never diagnoses %s',async key=>{
  vi.stubEnv(key,'non-secret-fixture-value');
  const response=await GET(new NextRequest('https://app.example.test/api/invitations'));
  expect(await response.json()).toEqual({tripAccessAvailable:false});
  expect(mocks.bridge).not.toHaveBeenCalled();
});
it.each([null,{id:'untrusted'}])('does not disclose availability to an invalid session %j',async user=>{
  mocks.getUser.mockResolvedValue({data:{user},error:user?{message:'invalid session'}:null});
  const response=await GET(new NextRequest('https://app.example.test/api/invitations'));
  expect(response.status).toBe(401);expect(await response.json()).toEqual({code:'not_authenticated'});
});
