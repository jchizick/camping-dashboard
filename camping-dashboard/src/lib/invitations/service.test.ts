import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { runInvitationOperation } from './service';
import { createTripInvitationToken, hashTripInvitationToken } from '../tripInvitationToken';
import { DeliveryError, localInvitationDelivery, takeLocalInvitationMessages } from './delivery';
import { getInvitationReturnPath } from './contracts';
import { getSafeNextPath, buildOAuthCallbackUrl } from '../authRedirect';
import { parseOfflineTarget } from '../offlineTarget';

const summary = { deliveryAttemptId:'22222222-2222-2222-2222-222222222222',deliveryState:'not_attempted', id:'11111111-1111-1111-1111-111111111111',email:'invitee@example.test',role:'viewer',status:'pending',expiresAt:'2026-09-18',tripName:'Synthetic trip' };
const call = vi.fn(); const deliver = vi.fn();
const deps = {call,delivery:{deliver},origin:'http://localhost:3000',provider:'local' as const,limit:vi.fn().mockResolvedValue(undefined)};
beforeEach(()=>{call.mockImplementation(async (_actor,op)=>op==='delivery_start'||op==='delivery_finish' ? {updated:true} : summary);deliver.mockResolvedValue({status:'captured_locally'});});
describe('trusted invitation service',()=>{
  it('requires authentication before management',async()=>{
    await expect(runInvitationOperation(deps,null,'create',{tripId:'trip',email:summary.email})).rejects.toMatchObject({status:401});
    expect(call).not.toHaveBeenCalled();
  });
  it.each(['user_id','actor','owner','verifiedEmail','tokenHash'])('rejects spoofed %s',async key=>{
    await expect(runInvitationOperation(deps,'owner','create',{tripId:'trip',email:summary.email,[key]:'spoof'})).rejects.toMatchObject({status:400});
  });
  it('persists digest before delivery and returns only a safe summary',async()=>{
    const result = await runInvitationOperation(deps,'verified-owner','create',{tripId:'trip',email:summary.email});
    const [actor,op,input] = call.mock.calls.find(c=>c[1]==='create')!;
    expect(actor).toBe('verified-owner');expect(op).toBe('create');expect(input.role).toBe('viewer');
    const url = new URL(deliver.mock.calls[0][0].acceptanceUrl);
    expect(hashTripInvitationToken(url.hash.slice(1))).toBe(input.tokenHash);
    expect(call.mock.invocationCallOrder[0]).toBeLessThan(deliver.mock.invocationCallOrder[0]);
    expect(JSON.stringify(result)).not.toContain(input.tokenHash);
    expect(url.pathname).toBe('/invite'); expect(url.search).toBe('');
    expect(JSON.stringify(result)).not.toContain(url.hash.slice(1));
    expect(result).toMatchObject({delivery:'captured_locally'});
  });
  it('does not deliver after database failure',async()=>{
    call.mockRejectedValue(new Error('not authorized'));
    await expect(runInvitationOperation(deps,'other','create',{tripId:'trip',email:summary.email})).rejects.toThrow();
    expect(deliver).not.toHaveBeenCalled();
  });
  it('reports delivery failure and rotates a fresh token on retry',async()=>{
    deliver.mockRejectedValue(new Error('do not expose details'));
    expect(await runInvitationOperation(deps,'owner','create',{tripId:'trip',email:summary.email})).toMatchObject({delivery:'unknown'});
    expect(await runInvitationOperation(deps,'owner','resend',{tripId:'trip',invitationId:summary.id})).toMatchObject({delivery:'unknown'});
    expect(call.mock.calls.find(c=>c[1]==='create')![2].tokenHash).not.toBe(call.mock.calls.find(c=>c[1]==='resend')![2].tokenHash);
  });
  it('does not deliver a terminal resend and revokes without delivery',async()=>{
    call.mockResolvedValue({...summary,status:'revoked'});
    expect(await runInvitationOperation(deps,'owner','resend',{tripId:'trip',invitationId:summary.id})).toMatchObject({delivery:'not_sent'});
    await runInvitationOperation(deps,'owner','revoke',{tripId:'trip',invitationId:summary.id});
    expect(deliver).not.toHaveBeenCalled();
  });
  it('signed-out lookup is generic and never queries or mutates the database',async()=>{
    expect(await runInvitationOperation(deps,null,'inspect',{token:createTripInvitationToken().rawToken})).toEqual({outcome:'signed_out'});
    expect(call).not.toHaveBeenCalled();
  });
  it('requires session and only accepts a token, not role/trip/email',async()=>{
    const token = createTripInvitationToken().rawToken;
    await expect(runInvitationOperation(deps,null,'accept',{token})).rejects.toMatchObject({status:401});
    for (const key of ['role','tripId','email']) await expect(runInvitationOperation(deps,'invitee','accept',{token,[key]:'spoof'})).rejects.toMatchObject({status:400});
    call.mockResolvedValue({outcome:'accepted',trip_id:'trip'});
    await runInvitationOperation(deps,'invitee','accept',{token});
    expect(call).toHaveBeenCalledWith('invitee','accept',{tokenHash:hashTripInvitationToken(token)});
  });
  it('malformed token returns unavailable without lookup',async()=>{
    expect(await runInvitationOperation(deps,'invitee','inspect',{token:'invalid'})).toEqual({outcome:'unavailable'});
    expect(call).not.toHaveBeenCalled();
  });
  it('persists known provider failure without reporting sent or changing lifecycle',async()=>{
    deliver.mockRejectedValue(new DeliveryError('provider_rejected'));
    expect(await runInvitationOperation(deps,'owner','create',{tripId:'trip',email:summary.email})).toMatchObject({delivery:'failed',invitation:{status:'pending',deliveryState:'failed'}});
    expect(call.mock.calls.find(c=>c[1]==='delivery_finish')![2]).toMatchObject({state:'failed',failureCode:'provider_rejected'});
  });
  it('never reports sent if the post-send durable write fails',async()=>{
    call.mockImplementation(async (_actor,op)=>{if(op==='delivery_finish') throw new Error('storage unavailable');return op==='delivery_start' ? {updated:true} : summary;});
    expect(await runInvitationOperation(deps,'owner','create',{tripId:'trip',email:summary.email})).toMatchObject({delivery:'unknown'});
    expect(deliver).toHaveBeenCalledTimes(1);
  });
  it('does not send when an attempt was already claimed',async()=>{
    call.mockImplementation(async (_actor,op)=>op==='delivery_start' ? {updated:false} : summary);
    expect(await runInvitationOperation(deps,'owner','create',{tripId:'trip',email:summary.email})).toMatchObject({delivery:'not_sent'});
    expect(deliver).not.toHaveBeenCalled();
  });
});

describe('local delivery guard and auth return',()=>{
  it('captures only with explicit local opt-in and refuses production',async()=>{
    vi.stubEnv('NODE_ENV','test');vi.stubEnv('VERCEL','');vi.stubEnv('TRIP_INVITATIONS_LOCAL','true');
    const message = {...summary,role:'viewer' as const,acceptanceUrl:'http://localhost/invite#test'};
    await localInvitationDelivery.deliver(message);expect(takeLocalInvitationMessages()).toEqual([message]);
    expect(takeLocalInvitationMessages()).toEqual([]);
    vi.stubEnv('NODE_ENV','production');
    await expect(localInvitationDelivery.deliver(message)).rejects.toThrow('Delivery unavailable');
    vi.stubEnv('NODE_ENV','test');vi.stubEnv('VERCEL','1');
    await expect(localInvitationDelivery.deliver(message)).rejects.toThrow('Delivery unavailable');
    vi.unstubAllEnvs();
  });
  it('preserves the invitation through existing OAuth and excludes offline matching',()=>{
    const path = '/invite';
    expect(getSafeNextPath(path)).toBe(path);expect(getInvitationReturnPath(path)).toBe(path);
    const callback = new URL(buildOAuthCallbackUrl({origin:'https://app.test',pathname:path,search:''}));
    expect(callback.pathname).toBe('/auth/callback');expect(callback.searchParams.get('next')).toBe(path);
    expect(parseOfflineTarget(path)).toBeNull();
    for (const value of ['https://evil.test','//evil.test','/\\evil.test','/%2f%2fevil.test']) expect(getSafeNextPath(value)).toBeNull();
    for (const value of ['//evil.test','/trips',path+'?next=//evil.test',path+'/extra']) expect(getInvitationReturnPath(value)).toBeNull();
  });
});
