import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const css = fs.readFileSync(path.join(projectRoot, 'src/app/globals.css'), 'utf8');
const start = css.indexOf(
  '/* Visual Phase 3: authenticated supporting surfaces and expedition texture. */'
);
const end = css.indexOf(
  '/* End Visual Phase 3 supporting visual polish. */'
);
const phaseCss = css.slice(start, end);

describe('authenticated mobile supporting visual polish', () => {
  it('uses the packaged topo map as a directly rendered authenticated background with a safe fallback', () => {
    expect(fs.existsSync(path.join(projectRoot, 'public/topo-map-bg.svg'))).toBe(true);
    expect(
      fs.readFileSync(path.join(projectRoot, 'public/sw.js'), 'utf8')
    ).toContain("'/topo-map-bg.svg'");
    expect(phaseCss).toContain('background-image: url("/topo-map-bg.svg")');
    expect(phaseCss).toContain('--workspace-topography-opacity: 0.72');
    expect(phaseCss).toContain('background-size: cover');
    expect(phaseCss).toContain('mix-blend-mode: screen');
    expect(phaseCss).not.toContain('mask-image: url("/topo-map-bg.svg")');
    expect(css).toContain('background: var(--workspace-scene-fallback)');
  });

  it('keeps cartographic line hierarchy in the transparent source artwork', () => {
    const topo = fs.readFileSync(
      path.join(projectRoot, 'public/topo-map-bg.svg'),
      'utf8'
    );
    expect(topo).not.toContain('<rect');
    expect(topo).toContain('stroke:#A8C9B2;stroke-opacity:0.46');
    expect(topo).toContain('stroke:#91B09C;stroke-opacity:0.35');
    expect(topo).toContain('stroke:#819E8C;stroke-opacity:0.28');
    expect(topo).toContain('stroke:#789182;stroke-opacity:0.20');
  });

  it('defines a mobile-only surface, divider, radius, and spacing hierarchy', () => {
    expect(phaseCss).toContain('@media (max-width: 767px)');
    for (const token of [
      '--workspace-phase3-surface-primary',
      '--workspace-phase3-surface-secondary',
      '--workspace-phase3-surface-inset',
      '--workspace-phase3-divider',
      '--workspace-phase3-radius-primary',
      '--workspace-phase3-radius-secondary',
      '--workspace-phase3-radius-control',
    ]) {
      expect(phaseCss).toContain(token);
    }
  });

  it('applies the hierarchy across every locked mobile destination', () => {
    for (const selector of [
      '.mobile-readiness-command',
      '.mobile-plan-workspace',
      '.gear-checklist-card',
      '.mobile-crew-person',
      '.mobile-field-essentials',
    ]) {
      expect(phaseCss).toContain(selector);
    }

    expect(phaseCss).toContain('.mobile-field-prep__checks');
    expect(phaseCss).toContain('grid-template-columns: 1fr');
  });

  it('keeps shell, offline status, navigation, and forms in the shared restrained system', () => {
    for (const selector of [
      '.trip-app-header',
      '.trip-source-status',
      '.trip-mobile-nav',
      '.crud-sheet__panel--workspace',
      '.crud-form__actions',
    ]) {
      expect(phaseCss).toContain(selector);
    }

    expect(phaseCss).not.toContain('font-family: var(--font-display)');
  });

  it('keeps the desktop saved-trip rail from displacing workspace content', () => {
    expect(phaseCss).toContain('@media (min-width: 1280px)');
    expect(phaseCss).toContain('grid-template-rows: auto minmax(0, 1fr)');
    expect(phaseCss).toContain('grid-row: 1 / span 2');
    expect(phaseCss).toContain('[data-trip-app-shell] .trip-source-status');
    expect(phaseCss).toContain('[data-trip-app-shell] .trip-app-main');
  });
});
