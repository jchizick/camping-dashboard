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
  let coverageGeometry = null;
  if (!historical) {
    coverageGeometry = await page.evaluate(() => {
      const rect = element => element.getBoundingClientRect().toJSON();
      const rail = document.querySelector('.workspace-preview__essentials');
      const sidebar = document.querySelector('.trip-workspace-sidebar__surface');
      const boundary = document.querySelector('[data-workspace-preview-capture]');
      const modules = [...rail.querySelectorAll('[data-coverage-module]')].map(element => {
        const copy = element.querySelector('.workspace-preview__coverage-copy');
        const fraction = element.querySelector('.workspace-preview__coverage-fraction');
        const meter = element.querySelector('[role="meter"]');
        const chevron = element.querySelector('.workspace-preview__coverage-chevron');
        const children = [...element.querySelectorAll('*')].map(child => ({ rect:rect(child),
          overflow:child.scrollWidth > child.clientWidth + 1 || child.scrollHeight > child.clientHeight + 1 }));
        return { id:element.dataset.coverageModule, rect:rect(element), copy:rect(copy), fraction:rect(fraction),
          chevron:rect(chevron), meter:rect(meter), fill:rect(meter.firstElementChild),
          counterFontSize:parseFloat(getComputedStyle(fraction).fontSize), annotationFontSize:parseFloat(getComputedStyle(fraction.querySelector('small')).fontSize),
          count:Number(meter.getAttribute('aria-valuenow')), total:Number(meter.getAttribute('aria-valuemax')),
          children };
      });
      return { sidebar:rect(sidebar), rail:rect(rail), boundary:rect(boundary), modules,
        bottomDifference:Math.abs(rect(sidebar).bottom - rect(rail).bottom),
        focusable:rail.querySelectorAll('a,button,input,select,textarea,[tabindex]').length };
    });
    const { sidebar, rail, boundary, modules, bottomDifference, focusable } = coverageGeometry;
    const tolerance = capture.scale; // At most one source CSS pixel; normally exactly aligned.
    assert(bottomDifference <= tolerance, 'Sidebar/coverage rail visible bottoms must align');
    assert(rail.bottom < boundary.bottom && sidebar.bottom < boundary.bottom, 'Preserve the bottom capture inset');
    assert(rail.left >= boundary.left && rail.right <= boundary.right, 'Rail must fit the capture width');
    assert.equal(modules.length, 3); assert.equal(focusable, 0, 'Coverage illustration is inert');
    assert(Math.max(...modules.map(module => module.rect.width)) - Math.min(...modules.map(module => module.rect.width)) < 1, 'Balanced coverage columns');
    for (const coverageModule of modules) {
      assert(coverageModule.counterFontSize >= 16 && coverageModule.annotationFontSize >= 10, 'Coverage type must remain legible at source scale');
      assert(coverageModule.count >= 0 && coverageModule.total > 0 && coverageModule.count <= coverageModule.total, 'Valid fictional coverage');
      assert(coverageModule.copy.right <= coverageModule.fraction.left + 1, 'Descriptor must not collide with the fraction');
      assert(coverageModule.fraction.right < coverageModule.chevron.left, 'Fraction must not collide with the chevron');
      assert(coverageModule.meter.bottom <= rail.bottom && coverageModule.meter.left >= rail.left && coverageModule.meter.right <= rail.right, 'Progress indicator containment');
      assert(Math.abs(coverageModule.fill.width / coverageModule.meter.width - coverageModule.count / coverageModule.total) < 0.002, 'Progress fill must represent the displayed fraction');
      for (const child of coverageModule.children) {
        assert(!child.overflow, 'Coverage content must not overflow');
        assert(child.rect.left >= coverageModule.rect.left - 1 && child.rect.right <= coverageModule.rect.right + 1 &&
          child.rect.top >= rail.top && child.rect.bottom <= rail.bottom, 'Coverage content must remain inside its column and rail');
      }
    }
  } else {
    assert.equal(await page.locator('[data-coverage-module]').count(), 0, 'Historical mode has no Coverage Counters');
  }
  const rawPng = await target.screenshot({ animations: 'disabled', caret: 'hide' });
  const rawMetadata = await sharp(rawPng).metadata();
  assert.equal(rawMetadata.width, historical ? 2880 : capture.width);
  // Fractional wrappers can enclose one extra device pixel. Crop only that
  // pixel when needed; never rescale the product geometry.
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
  const report = { capture, historical, browser: browser.version(), encoder: sharp.versions, geometry, coverageGeometry,
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
