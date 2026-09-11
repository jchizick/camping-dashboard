import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import nextConfig from '../../../next.config';
it('keeps token page GET a dynamic mutation-free shell and suppresses dev URL logs',async()=>{
  const page = readFileSync('src/app/invite/page.tsx','utf8');
  expect(existsSync('src/app/invite/[token]/page.tsx')).toBe(false);
  expect(page).toContain("dynamic = 'force-dynamic'");expect(page).not.toContain('runInvitationOperation');expect(page).not.toContain('callInvitationBridge');
  const headers = await nextConfig.headers!();
  expect(headers[0]).toMatchObject({source:'/invite/:path*',headers:expect.arrayContaining([{key:'Cache-Control',value:'private, no-store'},{key:'Referrer-Policy',value:'no-referrer'}])});
  const logging = nextConfig.logging;
  if (!logging || !logging.incomingRequests || typeof logging.incomingRequests === 'boolean') throw new Error('Expected scoped logging');
  for (const url of ['/invite/opaque','/auth/callback?next=%2Finvite%2Fopaque','/trips?next=%2Finvite%2Fopaque']) {
    expect(logging.incomingRequests.ignore?.some(pattern=>pattern.test(url))).toBe(true);
  }
});
it('marks every privileged module server-only and contains no token logging',()=>{
  for (const file of ['delivery','service','server']) {
    const source=readFileSync(`src/lib/invitations/${file}.ts`,'utf8');
    expect(source).toContain("import 'server-only'");expect(source).not.toMatch(/console\.(log|warn|error)/);
  }
});
