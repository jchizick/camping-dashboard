import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const css = readFileSync(resolve(projectRoot, 'src/app/globals.css'), 'utf8');
const destinationFiles = [
  'src/components/home/HomeOverview.tsx',
  'src/app/trips/[tripId]/plan/page.tsx',
  'src/app/trips/[tripId]/crew/page.tsx',
  'src/app/trips/[tripId]/guide/page.tsx',
];

describe('semantic phone-layout contract', () => {
  it('removes independent media-query composition logic from every destination', () => {
    for (const file of destinationFiles) {
      const source = readFileSync(resolve(projectRoot, file), 'utf8');
      expect(source).toContain('usePhoneLayout');
      expect(source).not.toContain('matchMedia(');
      expect(source).not.toContain("'(max-width: 767px)'");
    }
  });

  it('scopes authenticated destination and shell presentation to the document marker', () => {
    const phoneScope = '@scope (html[data-phone-layout="true"])';
    expect(css.split(phoneScope).length - 1).toBeGreaterThanOrEqual(10);
    for (const selector of [
      '.mobile-home-overview',
      '.mobile-plan-overview',
      '.gear-mobile-brief',
      '.mobile-crew-overview',
      '.mobile-field-essentials',
      '.trip-navigation-mobile-bar',
    ]) {
      expect(css).toContain(selector);
    }
  });

  it('keeps landscape sheet geometry width-based while extending phone affordances through the marker', () => {
    const typographyStart = css.indexOf('/* Visual Phase 2: authenticated mobile typography application. */');
    const typographyEnd = css.indexOf('/* End Visual Phase 2 typography application. */');
    const typography = css.slice(typographyStart, typographyEnd);
    const phoneScopeStart = typography.indexOf('@scope (html[data-phone-layout="true"])');
    const widthGeometryStart = typography.indexOf('@media (max-width: 767px)', phoneScopeStart);
    const phoneAffordances = typography.slice(phoneScopeStart, widthGeometryStart);
    const widthGeometry = typography.slice(widthGeometryStart);

    expect(phoneAffordances).toMatch(/\.crud-sheet__panel--workspace :is\([\s\S]*font-size:\s*1rem;/);
    expect(phoneAffordances).not.toMatch(
      /\.crud-sheet__panel--workspace\s*\{[^}]*max-width:\s*none/,
    );
    expect(widthGeometry).toContain('max-width: none');
    expect(widthGeometry).toContain('flex: 0 0 100%');
  });
});
