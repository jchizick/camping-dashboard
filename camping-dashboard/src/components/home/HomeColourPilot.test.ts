import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
const pilotMarker = 'Home colour pilot';
const pilot = css.slice(css.indexOf(pilotMarker));

const semanticTokens = [
  '--color-bg-canvas',
  '--color-bg-surface',
  '--color-bg-subtle',
  '--color-border-subtle',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-action-primary',
  '--color-action-primary-hover',
  '--color-focus-ring',
  '--color-category-weather',
  '--color-category-map',
  '--color-category-readiness',
  '--color-category-daylight',
  '--color-category-plan',
  '--color-category-gear',
  '--color-category-crew',
  '--color-category-guide',
  '--color-category-record',
  '--color-status-positive',
  '--color-status-warning',
  '--color-status-danger',
  '--color-status-info',
];

describe('Home colour pilot CSS contract', () => {
  it('keeps the requested semantic tokens in one bounded Home pilot section', () => {
    expect(css.match(new RegExp(pilotMarker, 'g'))).toHaveLength(1);
    expect(pilot).toContain('[data-trip-app-shell]:has(.home-overview)');

    for (const token of semanticTokens) {
      expect(pilot).toContain(`${token}:`);
    }
  });

  it('does not remap global accent or status compatibility variables', () => {
    for (const token of [
      '--accent-yellow',
      '--accent-blue',
      '--accent-green',
      '--accent-red',
      '--status-ready',
      '--status-attention',
      '--status-critical',
      '--status-info',
    ]) {
      expect(pilot).not.toMatch(new RegExp(`${token.replace('--', '\\-\\-')}\\s*:`));
    }
  });
});
