// Read-only dormant-build probe. Requires an existing Playwright installation;
// never creates an invitation, signs in, accepts, or sends email.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = new URL(process.argv[2]).origin;
const fakeToken = randomBytes(32).toString('base64url');
console.log('Probe: launch');
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
const paths = new Set();
let leaked = false;
let consoleLeak = false;
let errors = 0;
try {
  console.log('Probe: context');
  const context = await browser.newContext({ serviceWorkers: 'block' });
  context.setDefaultTimeout(15000);
  context.setDefaultNavigationTimeout(15000);
  context.on('request', request => {
    const url = request.url();
    if (url.includes(fakeToken)) leaked = true;
    const parsed = new URL(url);
    if (parsed.origin === origin) paths.add(parsed.pathname.replaceAll(fakeToken, '[REDACTED]'));
  });
  const page = await context.newPage();
  page.on('console', message => { if (message.text().includes(fakeToken)) consoleLeak = true; });
  page.on('pageerror', () => { errors++; });
  const inspect = page.waitForResponse(r => r.url() === origin + '/api/invitations' && r.request().method() === 'POST');
  const response = await page.goto(origin + '/invite#' + fakeToken, { waitUntil: 'domcontentloaded' });
  console.log('Probe: document loaded');
  const api = await inspect;
  console.log('Probe: inspection response');
  await page.locator('.invitation-landing [role=alert]').waitFor();
  assert.equal(page.url(), origin + '/invite');
  assert.equal(api.status(), 503, 'Probe is intended only for a dormant build');
  for (const result of [response, api]) {
    assert.match(result.headers()['cache-control'], /private/);
    assert.match(result.headers()['cache-control'], /no-store/);
    assert.equal(result.headers()['referrer-policy'], 'no-referrer');
  }
  console.log('Probe: headers verified');
  const plain = await context.newPage();
  await plain.goto(origin + '/invite', { waitUntil: 'domcontentloaded' });
  await plain.getByText('Open the invitation link from your email.').waitFor();
  assert.equal(leaked, false, 'Token appeared in a request URL');
  assert.equal(consoleLeak, false, 'Token appeared in browser console');
  assert.equal(errors, 0, 'Browser errors occurred');
  console.log(JSON.stringify({ result: 'PASS', origin, paths: [...paths], dormantStatus: api.status(),
    tokenInRequestURL: leaked, tokenInConsole: consoleLeak, pageErrors: errors,
    note: 'Inspect hosted logs separately; this probe cannot prove request-body log secrecy.' }, null, 2));
} catch (error) { console.error(String(error).replaceAll(fakeToken, '[REDACTED]')); process.exitCode=1; } finally { console.log('Probe: closing'); await browser.close(); }
