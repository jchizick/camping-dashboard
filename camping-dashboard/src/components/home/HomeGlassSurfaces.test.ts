import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const css = source('src/app/globals.css');

describe('Home glass surface contracts', () => {
  it('assigns explicit scoped variants to every migrated Home surface', () => {
    expect(source('src/components/cards/MapRouteCard.tsx')).toContain(
      'home-glass-surface--standard'
    );
    expect(source('src/components/cards/WeatherCard.tsx')).toContain(
      'home-glass-surface--dense'
    );
    expect(source('src/components/home/ReadinessSummaryCard.tsx')).toContain(
      'home-glass-surface--dense'
    );
    expect(source('src/components/home/TodaySummaryCard.tsx')).toContain(
      'home-glass-surface--dense'
    );
    expect(source('src/components/home/PriorityAlertCard.tsx')).toContain(
      'home-glass-surface--warning'
    );
    expect(source('src/components/home/TripSectionLinks.tsx')).toContain(
      'home-glass-surface--navigation'
    );
  });

  it('keeps the shared Card default free of Home surface behavior', () => {
    const primitives = source('src/components/ui/Primitives.tsx');
    expect(primitives).not.toContain('home-glass-surface');
    expect(primitives).not.toContain('surface?:');
    expect(primitives).toContain('bg-card-bg border border-border-subtle');
  });

  it('defines opaque fallbacks before enhancement and reduced-transparency overrides', () => {
    const phase4Marker = css.indexOf('Home expedition glass surfaces');
    const supports = css.indexOf('@supports ((backdrop-filter', phase4Marker);
    const reduced = css.indexOf('@media (prefers-reduced-transparency: reduce)', supports);

    expect(phase4Marker).toBeGreaterThan(-1);
    expect(supports).toBeGreaterThan(phase4Marker);
    expect(reduced).toBeGreaterThan(supports);

    const fallbackCss = css.slice(phase4Marker, supports);
    expect(fallbackCss).toContain('background: var(--workspace-glass-standard)');
    expect(fallbackCss).toContain('background: var(--workspace-glass-dense)');
    expect(fallbackCss).toContain('background: var(--workspace-warning-surface)');

    const reducedCss = css.slice(reduced, css.indexOf('@media (min-width: 1440px)', reduced));
    expect(reducedCss).toContain('backdrop-filter: none');
    expect(reducedCss).toContain('var(--workspace-glass-standard)');
    expect(reducedCss).toContain('var(--workspace-glass-dense)');
  });

  it('uses a natural-height wide composition without fixed grid rows', () => {
    const wide = css.slice(css.lastIndexOf('@media (min-width: 1440px)'));
    expect(wide).toContain('grid-template-rows: auto auto');
    expect(wide).toContain('.home-map');
    expect(wide).toContain('.home-weather');
    expect(wide).toContain('.home-priority');
    expect(wide).not.toMatch(/grid-template-rows:\s*\d/);
  });
});
