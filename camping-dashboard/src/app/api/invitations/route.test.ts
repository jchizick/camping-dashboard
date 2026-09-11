import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only',()=>({}));
const mocks = vi.hoisted(()=>({getUser:vi.fn(),call:vi.fn(),delivery:vi.fn(),enabled:vi.fn()}));
vi.mock('@/lib/serverSupabase',()=>({createRequestSupabaseClient:async()=>({auth:{getUser:mocks.getUser}})}));
vi.mock('@/lib/invitations/server',()=>({callInvitationBridge:mocks.call}));
vi.mock('@/lib/invitations/delivery',()=>({localInvitationsEnabled:mocks.enabled,localInvitationDelivery:{deliver:mocks.delivery}}));
import { POST } from './route';
import { createTripInvitationToken } from '@/lib/tripInvitationToken';
const request = (body:unknown,origin:string|null='http://localhost') => new NextRequest('http://localhost/api/invitations',{
  method:'POST',headers:{'content-type':'application/json',...(origin ? {origin} : {})},body:JSON.stringify(body)});
beforeEach(()=>{mocks.enabled.mockReturnValue(true);mocks.getUser.mockResolvedValue({data:{user:{id:'verified-session-id'}},error:null});mocks.call.mockResolvedValue({outcome:'pending'});});
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
