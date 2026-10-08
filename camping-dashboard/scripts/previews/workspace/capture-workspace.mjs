import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { directory, renderWorkspace } from './render-workspace.mjs';
import { capture } from './capture-config.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
// Use existing Playwright or the desktop runtime. Never install dependencies here.
const { chromium } = require(process.env.PREVIEW_PLAYWRIGHT_MODULE || 'playwright');
const project = path.resolve(directory, '../../..');
const historical = process.argv.includes('--historical');
const destination = process.argv.slice(2).find(value => !value.startsWith('--'));
const output = path.resolve(project, destination || 'output/workspace-preview/' + (historical ? 'historical' : 'unified'));
assert(output.startsWith(path.join(project, 'output') + path.sep), 'Capture output must stay under the project output directory');
await fs.mkdir(output, { recursive: true });
const html = renderWorkspace({ unified: !historical });
const server = http.createServer(async (request, response) => {
  try {
    const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (name === '/') { response.setHeader('Content-Type', 'text/html'); response.end(html); return; }
    const base = name === '/preview.css' || name === '/fonts.css' || name === '/unified.css' || name.startsWith('/fonts/') ? directory : path.join(project, 'public');
    const file = path.resolve(base, '.' + name);
    if (!file.startsWith(base + path.sep)) throw new Error('Invalid local path');
    response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream');
    response.end(await fs.readFile(file));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: capture.viewport, deviceScaleFactor: capture.deviceScaleFactor,
    locale: capture.locale, timezoneId: capture.timezoneId, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const unexpected = [], errors = [];
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    unexpected.push(route.request().url()); return route.abort();
  });
  const page = await context.newPage();
  await page.clock.install({ time: new Date(capture.fixedTime) });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
  await page.goto(origin);
  await page.locator('[data-desktop-workspace-overview]').waitFor();
  const map = await fs.readFile(path.join(directory, 'map.svg'), 'utf8');
  await page.locator('.home-map-card__canvas').evaluate((element, svg) => {
    element.innerHTML = svg;
    const image = element.querySelector('svg');
    Object.assign(image.style, { width: '100%', height: '100%', display: 'block' });
    image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  }, map);
  await page.getByRole('button', { name: 'Set location', exact: true }).evaluate(element => {
    for (const node of element.childNodes) if (node.nodeType === 3 && node.textContent.includes('Set location')) node.textContent = 'Reposition';
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
    document.activeElement?.blur();
    document.documentElement.dataset.fixtureReady = 'true';
  });
  await page.locator('[data-fixture-ready="true"]').waitFor({ state: 'attached' });
  const fonts = await page.evaluate(() => [...document.fonts].filter(font => font.status === 'loaded').map(font => ({ family: font.family, weight: font.weight })));
  for (const family of ['Barlow Condensed', 'DM Sans', ...(!historical ? ['Inter'] : [])]) {
    assert(fonts.some(font => font.family === family), 'Required local font missing: ' + family);
  }
  await page.mouse.move(-10, -10);
  const selectors = ['.trip-workspace-sidebar__surface', '.desktop-workspace-overview', '.dwo-identity', '.dwo-map', '.dwo-forecast', '.dwo-notice'];
  if (!historical) selectors.push('.trip-access-invite', '.workspace-preview__essentials', '.workspace-account-trigger', '.trip-shell-control');
  const measure = () => page.evaluate(selectors => Object.fromEntries(selectors.map(selector => [selector, document.querySelector(selector).getBoundingClientRect().toJSON()])), selectors);
  const geometry = await measure();
  // A real timer is independent of the frozen browser clock; sample twice after layout settles.
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.deepEqual(await measure(), geometry, 'Fixture geometry must be stable');
  const target = historical ? page : page.locator(capture.selector);
  if (!historical) {
    const box = await target.boundingBox();
    assert.equal(box.width, capture.wrapper.width); assert.equal(box.height, capture.wrapper.height);
    assert(Math.abs(geometry['.trip-access-invite'].width / capture.scale - 75.046875) < 0.1);
    assert(Math.abs(geometry['.trip-access-invite'].height / capture.scale - 36) < 0.01);
  }
  const rawPng = await target.screenshot({ animations: 'disabled', caret: 'hide' });
  const rawMetadata = await sharp(rawPng).metadata();
  assert.equal(rawMetadata.width, historical ? 2880 : capture.width);
  // Element screenshots enclose the 775.5px wrapper in 776 CSS pixels. Remove
  // only that extra bottom device pixel, without rescaling the product geometry.
  assert(historical ? rawMetadata.height === 1800 : rawMetadata.height >= capture.height && rawMetadata.height <= capture.height + 1);
  const png = historical || rawMetadata.height === capture.height ? rawPng : await sharp(rawPng)
    .extract({ left: 0, top: 0, width: capture.width, height: capture.height }).png().toBuffer();
  await fs.writeFile(path.join(output, 'source.png'), png);
  const webp = await sharp(png).resize(capture.width, historical ? 1600 : capture.height).webp({ quality: capture.quality }).toBuffer();
  const metadata = await sharp(webp).metadata();
  assert.equal(metadata.width, capture.width); assert.equal(metadata.height, historical ? 1600 : capture.height);
  assert.equal(metadata.format, 'webp'); assert.equal(metadata.hasAlpha, false);
  for (const key of ['icc', 'exif', 'xmp']) assert.equal(metadata[key], undefined);
  const sha256 = crypto.createHash('sha256').update(webp).digest('hex');
  let comparison = null;
  if (historical) {
    // Read the immutable Git blob, so this gate remains usable after replacing the public asset.
    const reference = execFileSync('git', ['show', capture.baseline + ':camping-dashboard/public/trips/desktop-workspace-preview.webp'], { cwd: project });
    assert.equal(crypto.createHash('sha256').update(reference).digest('hex'), capture.historicalSha256);
    const a = await sharp(reference).raw().toBuffer(), b = await sharp(webp).raw().toBuffer();
    assert.equal(a.length, b.length);
    let sum = 0, changed = 0;
    for (let i = 0; i < a.length; i++) { const delta = Math.abs(a[i] - b[i]); sum += delta; if (delta > 10) changed++; }
    comparison = { byteIdentical: webp.equals(reference), meanAbsoluteChannelDifference: sum / a.length, channelsDifferingByMoreThan10Percent: changed / a.length * 100 };
  }
  assert.deepEqual(unexpected, [], 'Unexpected network request'); assert.deepEqual(errors, [], 'Capture runtime/resource error');
  const report = { capture, historical, browser: browser.version(), encoder: sharp.versions, geometry,
    dimensions: { width: metadata.width, height: metadata.height }, opaque: !metadata.hasAlpha, metadataStripped: true,
    bytes: webp.length, sha256, comparison, unexpected, errors,
    fonts };
  await fs.writeFile(path.join(output, 'candidate.webp'), webp);
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
