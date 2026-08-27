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

  it('uses stronger frost while preserving explicit Expedition text contrast', () => {
    const phase4Marker = css.indexOf('Home expedition glass surfaces');
    const supports = css.slice(
      css.indexOf('@supports ((backdrop-filter', phase4Marker),
      css.indexOf('.home-overview .home-weather-condition', phase4Marker)
    );

    expect(supports).toContain('blur(20px) saturate(1.1)');
    expect(css).toContain('.home-priority-card__inline-action {');
    expect(css).toContain('color: var(--color-text-primary);');
  });

  it('keeps the clean-light acrylic recipe scoped to the Home dashboard', () => {
    const marker = css.indexOf('Clean light Home acrylic material');
    const cleanAcrylicCss = css.slice(marker);

    expect(marker).toBeGreaterThan(-1);
    expect(cleanAcrylicCss).toContain(
      '.theme-clean:not(.dark) [data-trip-app-shell]:has(.home-overview) {'
    );
    expect(cleanAcrylicCss).toContain('--clean-home-glass-standard:');
    expect(cleanAcrylicCss).toContain('--clean-home-glass-dense:');
    expect(cleanAcrylicCss).toContain('--clean-home-glass-warning:');
    expect(cleanAcrylicCss).not.toContain(
      '.theme-clean.dark [data-trip-app-shell]:has(.home-overview) {'
    );
  });

  it('gives clean-light Home surfaces distinct standard, dense, and warning recipes', () => {
    const marker = css.indexOf('Clean light Home acrylic material');
    const cleanAcrylicCss = css.slice(marker);

    expect(cleanAcrylicCss).toContain('blur(20px) saturate(1.1)');
    expect(cleanAcrylicCss).toContain('blur(24px) saturate(1.1)');
    expect(cleanAcrylicCss).toContain('blur(22px) saturate(1.08)');
    expect(cleanAcrylicCss).toContain('var(--clean-home-glass-shadow-raised)');
    expect(cleanAcrylicCss).toContain('repeating-linear-gradient');
  });

  it('does not stack backdrop blur on clean-light card headers', () => {
    expect(css).toMatch(
      /\.theme-clean:not\(\.dark\) \[data-trip-app-shell\]:has\(\.home-overview\) \.home-glass-surface > div:first-child\s*\{[^}]*backdrop-filter:\s*none;/
    );
  });

  it('provides clean-light opaque and reduced-transparency fallbacks', () => {
    const fallbackMarker = css.indexOf('Opaque clean-light Home fallbacks');
    const supports = css.indexOf('@supports ((backdrop-filter', fallbackMarker);
    const reduced = css.indexOf('@media (prefers-reduced-transparency: reduce)', supports);
    const fallbackCss = css.slice(fallbackMarker, supports);
    const reducedCss = css.slice(reduced, css.indexOf('@media (min-width: 1440px)', reduced));

    expect(fallbackCss).toContain('var(--clean-home-glass-solid-standard)');
    expect(fallbackCss).toContain('var(--clean-home-glass-solid-dense)');
    expect(fallbackCss).toContain('var(--clean-home-glass-solid-warning)');
    expect(reducedCss).toContain('var(--clean-home-glass-solid-standard)');
    expect(reducedCss).toContain('var(--clean-home-glass-solid-dense)');
    expect(reducedCss).toContain('var(--clean-home-glass-solid-warning)');
  });

  it('uses a natural-height wide composition without fixed grid rows', () => {
    const homeMarker = css.indexOf('Home expedition glass surfaces');
    const signedOutMarker = css.indexOf('Signed-out Field Protocol landing', homeMarker);
    const homeCss = css.slice(homeMarker, signedOutMarker);
    const wide = homeCss.slice(homeCss.indexOf('@media (min-width: 1440px)'));

    expect(homeMarker).toBeGreaterThan(-1);
    expect(signedOutMarker).toBeGreaterThan(homeMarker);
    expect(wide).toContain('grid-template-rows: auto auto');
    expect(wide).toContain('.home-map');
    expect(wide).toContain('.home-weather');
    expect(wide).toContain('.home-priority');
    expect(wide).not.toMatch(/grid-template-rows:\s*\d/);
  });

  it('scopes the portrait-tablet proportional refinement without changing its topology', () => {
    const portraitStart = css.indexOf(
      '@media (min-width: 768px) and (max-width: 1023px) and (orientation: portrait)'
    );
    const portrait = css.slice(
      portraitStart,
      css.indexOf('@media (min-width: 1024px)', portraitStart)
    );

    expect(portraitStart).toBeGreaterThan(-1);
    expect(portrait).toContain('padding-top: 2.625rem;');
    expect(portrait).toMatch(/\.trip-situation-rail\s*\{[^}]*margin-top:\s*1.5rem;/);
    expect(portrait).toContain('height: 21.875rem !important;');
    expect(portrait).toContain('min-height: 6.5rem;');
    expect(portrait).toContain('grid-template-columns: auto minmax(0, 1fr) auto;');
    expect(portrait).not.toContain('.home-weather');
    expect(portrait).not.toContain('.home-readiness');
    expect(portrait).not.toContain('.home-today');
  });

  it('scopes the compact three-track Home composition to short landscape tablets', () => {
    const compactStart = css.indexOf(
      '@media (min-width: 1024px) and (max-width: 1279px) and (max-height: 800px)'
    );
    const compact = css.slice(
      compactStart,
      css.indexOf('@media (min-width: 1280px)', compactStart)
    );

    expect(compactStart).toBeGreaterThan(-1);
    expect(compact).toContain('minmax(0, 1.52fr)');
    expect(compact).toContain('minmax(18.75rem, 1fr)');
    expect(compact).toContain('minmax(14.5rem, 0.82fr)');
    expect(compact).toMatch(/\.home-map\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1 \/ 3;/);
    expect(compact).toMatch(/\.home-weather\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1 \/ 3;/);
    expect(compact).toMatch(/\.home-readiness\s*\{[^}]*grid-column:\s*3;[^}]*grid-row:\s*1;/);
    expect(compact).toMatch(/\.home-today\s*\{[^}]*grid-column:\s*3;[^}]*grid-row:\s*2;/);
    expect(compact).toMatch(/\.home-priority\s*\{[^}]*height:\s*6rem;[^}]*grid-column:\s*1 \/ -1;/);
    expect(compact).toContain('height: 19.6875rem !important;');
    expect(compact).not.toMatch(/\.today-timeline__item p\s*\{[^}]*display:\s*none;/);
    expect(compact).not.toMatch(/\.home-weather-forecast-day[^}]*display:\s*none/);
  });

  it('scopes the compact three-track Home composition to short wide desktops', () => {
    const compactStart = css.indexOf(
      '@media (min-width: 1280px) and (max-width: 1439px) and (max-height: 800px)'
    );
    const compact = css.slice(compactStart, css.indexOf('@media (min-width: 1440px)', compactStart));

    expect(compactStart).toBeGreaterThan(-1);
    expect(compact).toContain('minmax(0, 1.6fr)');
    expect(compact).toContain('minmax(18rem, 1fr)');
    expect(compact).toContain('minmax(14.5rem, 0.8fr)');
    expect(compact).toMatch(/\.home-map\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1 \/ 3;/);
    expect(compact).toMatch(/\.home-weather\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1 \/ 3;/);
    expect(compact).toMatch(/\.home-readiness\s*\{[^}]*grid-column:\s*3;[^}]*grid-row:\s*1;/);
    expect(compact).toMatch(/\.home-today\s*\{[^}]*grid-column:\s*3;[^}]*grid-row:\s*2;/);
    expect(compact).toMatch(/\.home-priority\s*\{[^}]*height:\s*6rem;[^}]*grid-column:\s*1 \/ -1;/);
    expect(compact).toContain('height: 19.6875rem !important;');
    expect(compact).not.toMatch(/\.today-timeline__item p\s*\{[^}]*display:\s*none;/);
  });
});
