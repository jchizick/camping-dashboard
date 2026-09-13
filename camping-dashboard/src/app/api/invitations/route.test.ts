import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only',()=>({}));
const mocks = vi.hoisted(()=>({getUser:vi.fn(),call:vi.fn(),delivery:vi.fn(),enabled:vi.fn(),consume:vi.fn()}));
vi.mock('@/lib/serverSupabase',()=>({createRequestSupabaseClient:async()=>({auth:{getUser:mocks.getUser}})}));
vi.mock('@/lib/invitations/server',()=>({callInvitationBridge:mocks.call,consumeInvitationRates:mocks.consume}));
vi.mock('@/lib/invitations/config',()=>({invitationConfig:()=>mocks.enabled() ? {provider:'local',origin:'http://localhost',rateSecret:'local-only-invitation-rate-test-key'} : null}));
import { GET, POST } from './route';
import { createTripInvitationToken } from '@/lib/tripInvitationToken';
import { InvitationFailure } from '@/lib/invitations/service';
const request = (body:unknown,origin:string|null='http://localhost') => new NextRequest('http://localhost/api/invitations',{
  method:'POST',headers:{'content-type':'application/json',...(origin ? {origin} : {})},body:JSON.stringify(body)});
beforeEach(()=>{mocks.consume.mockResolvedValue({allowed:true,retryAfter:0});mocks.enabled.mockReturnValue(true);mocks.getUser.mockResolvedValue({data:{user:{id:'verified-session-id'}},error:null});mocks.call.mockResolvedValue({outcome:'pending'});});
it.each(['https://evil.test',null])('rejects origin %s before auth/db',async origin=>{
  expect((await POST(request({operation:'accept',token:'x'},origin))).status).toBe(403);expect(mocks.call).not.toHaveBeenCalled();
});
it('is inaccessible when local gate is disabled',async()=>{
  mocks.enabled.mockReturnValue(false);expect((await POST(request({operation:'inspect'}))).status).toBe(503);expect(mocks.getUser).not.toHaveBeenCalled();
});
it('derives identity from verified getUser and returns private no-store',async()=>{
  const response = await POST(request({operation:'inspect',token:createTripInvitationToken().rawToken}));
  expect(response.status).toBe(200);expect(mocks.call.mock.calls[0][0]).toBe('verified-session-id');
  expect(response.headers.get('cache-control')).toBe('private, no-store');expect(response.headers.get('referrer-policy')).toBe('no-referrer');
});
it('does not trust a user returned alongside auth failure',async()=>{
  mocks.getUser.mockResolvedValue({data:{user:{id:'untrusted'}},error:{message:'bad'}});
  expect((await POST(request({operation:'accept',token:createTripInvitationToken().rawToken}))).status).toBe(401);expect(mocks.call).not.toHaveBeenCalled();
});
it('rejects identity injection',async()=>{
  expect((await POST(request({operation:'accept',token:createTripInvitationToken().rawToken,user_id:'owner'}))).status).toBe(400);expect(mocks.call).not.toHaveBeenCalled();
});
it('rejects oversized JSON before session lookup',async()=>{
  expect((await POST(request({operation:'inspect',token:'x'.repeat(3000)}))).status).toBe(413);
  expect(mocks.getUser).not.toHaveBeenCalled();
});
it('suppresses upstream error details',async()=>{
  mocks.call.mockRejectedValue(new Error('sensitive token/hash'));
  const response = await POST(request({operation:'inspect',token:createTripInvitationToken().rawToken}));
  expect(await response.json()).toEqual({code:'invitation_failed'});
});
it('throttles before auth or body lookup and returns Retry-After',async()=>{
  mocks.consume.mockResolvedValue({allowed:false,retryAfter:37});
  const response=await POST(request({operation:'inspect',token:'invalid'}));
  expect(response.status).toBe(429);expect(response.headers.get('Retry-After')).toBe('37');
  expect(await response.json()).toEqual({code:'rate_limited'});expect(mocks.getUser).not.toHaveBeenCalled();
});
it('fails closed if distributed rate storage is unavailable',async()=>{
  mocks.consume.mockRejectedValue(new Error('private storage details'));
  const response=await POST(request({operation:'inspect',token:'invalid'}));
  expect(response.status).toBe(503);expect(await response.json()).toEqual({code:'invitation_failed'});
  expect(mocks.getUser).not.toHaveBeenCalled();
});

const removal={operation:'remove_access',tripId:'trip-a',membershipId:'00000000-0000-0000-0000-000000000123'};
it('removes through the verified session and existing bridge with a minimal response',async()=>{
  mocks.call.mockResolvedValue({outcome:'access_removed',privateExtra:'discarded'});
  const response=await POST(request(removal));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({outcome:'access_removed'});
  expect(mocks.call).toHaveBeenCalledExactlyOnceWith('verified-session-id','remove_access',{
    tripId:removal.tripId,membershipId:removal.membershipId,
  });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it.each(['actorUserId','callerUserId','ownerId','ownerUserId','callerRole','isOwner','user_id','role','claims'])('rejects removal identity injection: %s',async key=>{
  expect((await POST(request({...removal,[key]:'owner'}))).status).toBe(400);
  expect(mocks.call).not.toHaveBeenCalled();
});
it('rejects arbitrary claims and cross-site removal before privileged mutation',async()=>{
  expect((await POST(request({...removal,claims:{sub:'owner',role:'service_role'}}))).status).toBe(400);
  expect(mocks.call).not.toHaveBeenCalled();
  mocks.getUser.mockClear();
  const crossSite=request(removal);crossSite.headers.set('sec-fetch-site','cross-site');
  expect((await POST(crossSite)).status).toBe(403);
  expect(mocks.getUser).not.toHaveBeenCalled();expect(mocks.call).not.toHaveBeenCalled();
});
it.each([null,{message:'invalid or foreign-project session'}])('rejects absent/invalid removal session (%s)',async error=>{
  mocks.getUser.mockResolvedValue({data:{user:error ? {id:'untrusted'} : null},error});
  expect((await POST(request(removal))).status).toBe(401);expect(mocks.call).not.toHaveBeenCalled();
});
it.each(['https://foreign.test',null])('rejects cross-origin removal (%s)',async origin=>{
  expect((await POST(request(removal,origin))).status).toBe(403);expect(mocks.getUser).not.toHaveBeenCalled();
});
it('keeps removal dormant and rejects missing schema or unexpected bridge responses',async()=>{
  mocks.enabled.mockReturnValue(false);
  expect((await POST(request(removal))).status).toBe(503);expect(mocks.getUser).not.toHaveBeenCalled();
  mocks.enabled.mockReturnValue(true);mocks.call.mockRejectedValue(new InvitationFailure('invitation_failed',503));
  expect(await (await POST(request(removal))).json()).toEqual({code:'invitation_failed'});
  mocks.call.mockResolvedValue(null);expect((await POST(request(removal))).status).toBe(503);
});
it.each(['viewer','editor','other-trip owner'])('returns safe DB denial for %s',async()=>{
  mocks.call.mockRejectedValue(new InvitationFailure('not_authorized',403));
  const response=await POST(request(removal));
  expect(response.status).toBe(403);expect(await response.json()).toEqual({code:'not_authorized'});
});
it.each(['bad','-'.repeat(36),'',null])('rejects invalid target membership %s',async membershipId=>{
  expect((await POST(request({...removal,membershipId}))).status).toBe(400);expect(mocks.call).not.toHaveBeenCalled();
});

const management = {operation:'list_access',tripId:'trip-a'};
const snapshot = {people:[{membershipId:'10000000-0000-0000-0000-000000000001',email:'owner@example.test',role:'owner',isCurrentUser:true}],
  pendingInvitations:[{invitationId:'20000000-0000-0000-0000-000000000001',email:'invitee@example.test',role:'viewer',status:'pending',createdAt:'2026-09-13T00:00:00Z',expiresAt:'2026-09-20T00:00:00Z'}]};
it('returns an allowlisted management snapshot using only verified actor, without delivery or rate writes',async()=>{
  mocks.call.mockResolvedValue({...snapshot,token_hash:'private-hash',people:snapshot.people.map(row=>({...row,user_id:'internal',raw_user_meta_data:{private:true}}))});
  const response=await POST(request(management));
  expect(response.status).toBe(200);expect(await response.json()).toEqual(snapshot);
  expect(mocks.call).toHaveBeenCalledExactlyOnceWith('verified-session-id','list_access',{tripId:'trip-a'});
  expect(mocks.consume).not.toHaveBeenCalled();expect(mocks.delivery).not.toHaveBeenCalled();
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it.each(['actorUserId','ownerUserId','callerRole','isOwner','claims','role','token','membershipId'])('rejects management injection %s',async key=>{
  expect((await POST(request({...management,[key]:'spoofed'}))).status).toBe(400);
  expect(mocks.call).not.toHaveBeenCalled();expect(mocks.consume).not.toHaveBeenCalled();
});
it.each([null,'','bad trip',123,'x'.repeat(201)])('rejects invalid management trip %s',async tripId=>{
  expect((await POST(request({...management,tripId}))).status).toBe(400);expect(mocks.call).not.toHaveBeenCalled();
});
it.each(['viewer','editor','owner of another trip'])('does not disclose management data for %s',async()=>{
  mocks.call.mockRejectedValue(new InvitationFailure('not_authorized',403));
  const response=await POST(request(management));expect(response.status).toBe(403);
  expect(await response.json()).toEqual({code:'not_authorized'});
});
it('denies unauthenticated management before privileged read',async()=>{
  mocks.getUser.mockResolvedValue({data:{user:null},error:null});
  expect((await POST(request(management))).status).toBe(401);expect(mocks.call).not.toHaveBeenCalled();
});
it('fails closed with no privileged query when disabled, and safely handles absent schema',async()=>{
  mocks.enabled.mockReturnValue(false);
  expect((await POST(request(management))).status).toBe(503);
  expect(mocks.call).not.toHaveBeenCalled();expect(mocks.consume).not.toHaveBeenCalled();
  mocks.enabled.mockReturnValue(true);mocks.call.mockRejectedValue(new Error('private SQL schema information'));
  const response=await POST(request(management));expect(response.status).toBe(503);
  expect(await response.json()).toEqual({code:'invitation_failed'});
});
it.each([true,false])('availability exposes only the authenticated configuration boolean (%s)',async enabled=>{
  mocks.enabled.mockReturnValue(enabled);
  const response=await GET(new NextRequest('http://localhost/api/invitations'));
  expect(await response.json()).toEqual({tripAccessAvailable:enabled});
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(mocks.call).not.toHaveBeenCalled();expect(mocks.consume).not.toHaveBeenCalled();
});
it('availability rejects invalid sessions and query parameters',async()=>{
  mocks.getUser.mockResolvedValue({data:{user:{id:'untrusted'}},error:{message:'bad session'}});
  expect((await GET(new NextRequest('http://localhost/api/invitations'))).status).toBe(401);
  expect((await GET(new NextRequest('http://localhost/api/invitations?tripId=trip-a'))).status).toBe(400);
  expect(mocks.call).not.toHaveBeenCalled();
});
