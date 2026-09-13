import { expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
const mocks = vi.hoisted(()=>({rpc:vi.fn(),create:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:mocks.create}));
import { callInvitationBridge } from './server';
it('uses a distinct service-only client and only the whitelisted bridge RPC',async()=>{
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','http://localhost:54321');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','local-secret');
  mocks.create.mockReturnValue({rpc:mocks.rpc});mocks.rpc.mockResolvedValue({data:{outcome:'pending'},error:null});
  await callInvitationBridge('verified-id','inspect',{tokenHash:'digest'});
  expect(mocks.create.mock.calls[0].slice(0,2)).toEqual(['http://localhost:54321','local-secret']);
  expect(mocks.create.mock.calls[0][2].auth).toEqual({persistSession:false,autoRefreshToken:false});
  expect(mocks.rpc).toHaveBeenCalledWith('trip_invitation_bridge',{p_actor:'verified-id',p_operation:'inspect',p_input:{tokenHash:'digest'}});
  vi.unstubAllEnvs();
});
it('never includes database error text in thrown API errors',async()=>{
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','http://localhost:54321');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','local-secret');
  mocks.create.mockReturnValue({rpc:mocks.rpc});mocks.rpc.mockResolvedValue({data:null,error:{code:'42501',message:'sensitive token'}});
  await expect(callInvitationBridge('verified-id','accept',{tokenHash:'digest'})).rejects.toMatchObject({message:'not_authorized',status:403});
  vi.unstubAllEnvs();
});
it.each(['PGRST202','42883','42501'])('removal fails closed for missing schema or DB denial (%s)',async code=>{
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','http://localhost:54321');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','local-secret');
  mocks.create.mockReturnValue({rpc:mocks.rpc});mocks.rpc.mockResolvedValue({data:null,error:{code,message:'private details'}});
  await expect(callInvitationBridge('verified-id','remove_access',{tripId:'trip-a',membershipId:'target-id'}))
    .rejects.toMatchObject({message:code==='42501'?'not_authorized':'invitation_failed',status:code==='42501'?403:503});
  expect(mocks.rpc).toHaveBeenCalledWith('trip_invitation_bridge',{p_actor:'verified-id',p_operation:'remove_access',p_input:{tripId:'trip-a',membershipId:'target-id'}});
  vi.unstubAllEnvs();
});
