import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { invitationConfig, type InvitationConfig } from './config';
import { invitationTemplate } from './template';
import { resendInvitationDelivery } from './resend';
import { invitationLimiter } from './rateLimit';

const token='a'.repeat(43);
const message={email:'fixture@example.test',tripName:'Pine Lake',role:'editor' as const,expiresAt:'2026-09-18T12:00:00Z',acceptanceUrl:`https://app.example.test/invite#${token}`};
const id='12345678-1234-1234-1234-123456789012';
const config:InvitationConfig={provider:'resend',origin:'https://app.example.test',from:'Field Protocol <invites@example.test>',apiKey:'re_synthetic_test_key_only',rateSecret:'synthetic-rate-secret-32-characters'};
afterEach(()=>vi.unstubAllEnvs());
it('escapes HTML, preserves safe Unicode/plain text and confines the token to the acceptance URL',()=>{
  const rendered=invitationTemplate({...message,tripName:'Été <script>alert("x")</script> & \'camp\'\r\nHeader: nope'});
  expect(rendered.html).toContain('&lt;script&gt;');expect(rendered.html).not.toContain('<script>');
  expect(rendered.html).toContain('&quot;x&quot;');expect(rendered.html).toContain('&#39;camp&#39;');
  expect(rendered.text).toContain('Été <script>');expect(rendered.text).not.toContain('\r\nHeader');
  for(const value of [rendered.html,rendered.text]) {
    expect(value).toContain('Editor');expect(value).toContain('2026-09-18 12:00:00 UTC');
    expect(value).toContain('Google-account email');expect(value.split(token)).toHaveLength(2);
  }
  expect(rendered.html).toContain(`href="${message.acceptanceUrl}"`);
  expect(rendered.subject).not.toContain('Été');
});
it('bounds long trip names and renders Viewer without extra private data',()=>{
  const result=invitationTemplate({...message,role:'viewer',tripName:'x'.repeat(1000)});
  expect(result.text).toContain('x'.repeat(200));expect(result.text).not.toContain('x'.repeat(201));
  expect(result.text).toContain('Viewer');expect(result.text).not.toContain(message.email);
});
it('uses the configured sender and one stable attempt key for retry, and a new key for resend',async()=>{
  const request=vi.fn().mockRejectedValueOnce(new Error('timeout secret')).mockResolvedValue(new Response(JSON.stringify({id}),{status:200}));
  const adapter=resendInvitationDelivery(config,request);
  expect(await adapter.deliver(message,id)).toEqual({status:'sent',providerMessageId:id});
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[0][1].body).toBe(request.mock.calls[1][1].body);
  expect(request.mock.calls[0][1].headers['Idempotency-Key']).toBe(`invitation/${id}`);
  expect(request.mock.calls[1][1].headers['Idempotency-Key']).toBe(`invitation/${id}`);
  request.mockResolvedValue(new Response(JSON.stringify({id}),{status:200}));
  await adapter.deliver(message,'22345678-1234-1234-1234-123456789012');
  expect(request.mock.calls[2][1].headers['Idempotency-Key']).not.toBe(request.mock.calls[0][1].headers['Idempotency-Key']);
  expect(JSON.parse(request.mock.calls[0][1].body).from).toBe(config.from);
});
it.each([[422,'provider_rejected',1],[401,'provider_auth',1],[403,'provider_auth',1],[429,'provider_rate_limited',1],[503,'provider_unknown',2]])('sanitizes provider status %i',async(status,code,calls)=>{
  const request=vi.fn().mockImplementation(async()=>new Response('secret arbitrary provider body',{status:Number(status)}));
  await expect(resendInvitationDelivery(config,request).deliver(message,id)).rejects.toMatchObject({message:code,code});
  expect(request).toHaveBeenCalledTimes(Number(calls));
});
it('records an ambiguous timeout without exposing network errors',async()=>{
  const request=vi.fn().mockRejectedValue(new Error('secret token'));
  await expect(resendInvitationDelivery(config,request).deliver(message,id)).rejects.toMatchObject({code:'provider_unknown'});
  expect(request).toHaveBeenCalledTimes(2);
});
it('rejects invalid fragment/origin before making a provider request',async()=>{
  const request=vi.fn();
  for(const acceptanceUrl of ['https://evil.test/invite#'+token,'https://app.example.test/invite?token='+token]) {
    await expect(resendInvitationDelivery(config,request).deliver({...message,acceptanceUrl},id)).rejects.toMatchObject({code:'invalid_request'});
  }
  expect(request).not.toHaveBeenCalled();
});
function enabledConfig() {
  for(const [key,value] of Object.entries({NODE_ENV:'production',VERCEL:'1',VERCEL_ENV:'preview',TRIP_INVITATIONS_ENABLED:'true',
    TRIP_INVITATIONS_LOCAL:'',TRIP_INVITATIONS_PROVIDER:'resend',TRIP_INVITATIONS_ORIGIN:config.origin,
    TRIP_INVITATIONS_FROM_ADDRESS:'invites@example.test',RESEND_API_KEY:config.apiKey,TRIP_INVITATIONS_RATE_SECRET:config.rateSecret,
    NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-only'})) vi.stubEnv(key,value);
}
it('fails closed by default and never falls back to fake on Vercel',()=>{
  enabledConfig();vi.stubEnv('TRIP_INVITATIONS_ENABLED','');vi.stubEnv('TRIP_INVITATIONS_LOCAL','true');expect(invitationConfig()).toBeNull();
});
it.each(['TRIP_INVITATIONS_ORIGIN','TRIP_INVITATIONS_FROM_ADDRESS','RESEND_API_KEY','TRIP_INVITATIONS_RATE_SECRET','SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SUPABASE_URL'])('requires valid %s',key=>{
  enabledConfig();expect(invitationConfig()?.provider).toBe('resend');vi.stubEnv(key,'');expect(invitationConfig()).toBeNull();
});
it.each(['https://evil.test/path','https://user:pass@app.test','http://app.test','https://app.test/#fragment','https://app.test/?q=x'])('rejects origin %s',origin=>{
  enabledConfig();vi.stubEnv('TRIP_INVITATIONS_ORIGIN',origin);expect(invitationConfig()).toBeNull();
});
it('permits fake only with explicit local opt-in and valid local origin',()=>{
  enabledConfig();vi.stubEnv('NODE_ENV','test');vi.stubEnv('VERCEL','');vi.stubEnv('TRIP_INVITATIONS_LOCAL','true');
  vi.stubEnv('TRIP_INVITATIONS_ORIGIN','http://localhost:3000');expect(invitationConfig()?.provider).toBe('local');
});
it('uses distinct HMAC buckets for owners/trips and shared recipient cooldowns without plaintext identities',async()=>{
  const consume=vi.fn().mockResolvedValue({allowed:true,retryAfter:0});const limiter=invitationLimiter(config.rateSecret,consume);
  await limiter.operation('ownerA','create');await limiter.operation('ownerB','create');
  expect(consume.mock.calls[0][0][0].key).not.toBe(consume.mock.calls[1][0][0].key);
  await limiter.operation('ownerA','create','tripA',message.email);await limiter.operation('ownerA','resend','tripB',message.email);
  expect(consume.mock.calls[2][0][0].key).not.toBe(consume.mock.calls[3][0][0].key);
  expect(consume.mock.calls[2][0][1].key).toBe(consume.mock.calls[3][0][1].key);
  expect(consume.mock.calls[2][0][3]).toMatchObject({limit:1,seconds:60});
  expect(JSON.stringify(consume.mock.calls)).not.toContain(message.email);
  await limiter.operation('invitee','inspect');await limiter.operation('invitee','accept');
  expect(consume.mock.calls[4][0][0]).toMatchObject({limit:30,seconds:60});
  expect(consume.mock.calls[5][0][0]).toMatchObject({limit:10,seconds:60});
});
it('returns safe Retry-After and fails closed when the backing service fails',async()=>{
  const consume=vi.fn().mockResolvedValue({allowed:false,retryAfter:42});const limiter=invitationLimiter(config.rateSecret,consume);
  await expect(limiter.operation('owner','resend')).rejects.toMatchObject({status:429,retryAfter:42});
  consume.mockRejectedValue(new Error('sensitive DB details'));
  await expect(limiter.operation('owner','create')).rejects.toMatchObject({status:503,message:'invitation_failed'});
});
it('groups equivalent IPv6 privacy addresses and ignores client forwarding headers outside Vercel',async()=>{
  const consume=vi.fn().mockResolvedValue({allowed:true,retryAfter:0});const limiter=invitationLimiter(config.rateSecret,consume);
  vi.stubEnv('VERCEL','1');await limiter.network(new Headers({'x-forwarded-for':'2001:db8:0:1::1'}));
  await limiter.network(new Headers({'x-forwarded-for':'2001:0db8:0000:0001::2'}));
  expect(consume.mock.calls[0]).toEqual(consume.mock.calls[1]);
  vi.stubEnv('VERCEL','');await limiter.network(new Headers({'x-forwarded-for':'1.2.3.4'}));
  await limiter.network(new Headers({'x-forwarded-for':'5.6.7.8'}));expect(consume.mock.calls[2]).toEqual(consume.mock.calls[3]);
});
