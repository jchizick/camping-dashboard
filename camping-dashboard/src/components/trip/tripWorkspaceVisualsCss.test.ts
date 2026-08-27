import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');

const workspaceTokens = [
  'scene-filter',
  'scene-overlay',
  'scene-fallback',
  'glass-sidebar',
  'glass-standard',
  'glass-dense',
  'glass-sidebar-translucent',
  'glass-standard-translucent',
  'glass-dense-translucent',
  'border-subtle',
  'border-strong',
  'elevation',
  'text-primary',
  'text-secondary',
  'accent-sage',
  'accent-amber',
  'accent-info',
  'warning-surface',
  'warning-border',
  'warning-text',
  'danger-surface',
  'danger-border',
  'danger-text',
  'focus-ring',
] as const;

describe('trip workspace visual tokens', () => {
  it('keeps variable-backed Tailwind utilities runtime scoped', () => {
    const inlineThemeStart = css.indexOf('@theme inline');
    const inlineTheme = css.slice(inlineThemeStart, css.indexOf('}', inlineThemeStart));

    expect(inlineThemeStart).toBeGreaterThan(0);
    for (const alias of [
      '--color-card-bg: var(--card-bg)',
      '--color-border-subtle: var(--border-subtle)',
      '--color-text-main: var(--text-main)',
      '--color-text-muted: var(--text-muted)',
      '--color-accent-yellow: var(--accent-yellow)',
      '--shadow-card: var(--card-shadow)',
    ]) {
      expect(inlineTheme).toContain(alias);
    }
  });

  it('defines every token for all four theme and mode combinations', () => {
    for (const token of workspaceTokens) {
      const definitions = css.match(
        new RegExp(`--workspace-${token.replaceAll('-', '\\-')}\\s*:`, 'g')
      );
      expect(definitions, token).toHaveLength(4);
    }
  });

  it('keeps navigation glass lighter than dense data surfaces in every theme', () => {
    const alphaValues = (token: string) =>
      [...css.matchAll(
        new RegExp(`--workspace-${token}:\\s*rgba\\([^)]*,\\s*([0-9.]+)\\);`, 'g')
      )].map((match) => Number(match[1]));

    const sidebar = alphaValues('glass-sidebar-translucent');
    const standard = alphaValues('glass-standard-translucent');
    const dense = alphaValues('glass-dense-translucent');

    expect(sidebar).toHaveLength(4);
    expect(standard).toHaveLength(4);
    expect(dense).toHaveLength(4);
    for (let index = 0; index < dense.length; index += 1) {
      expect(dense[index]).toBeGreaterThan(sidebar[index]);
      expect(dense[index]).toBeGreaterThan(standard[index]);
    }
    expect(Math.max(...sidebar)).toBeLessThanOrEqual(0.68);
    expect(Math.max(...standard)).toBeLessThanOrEqual(0.63);
    expect(Math.min(...dense)).toBeGreaterThanOrEqual(0.72);
  });

  it('hides the workspace scene overlay in both Clean modes', () => {
    const foundation = css.indexOf('Immersive trip workspace foundation');
    const cleanDayStart = css.indexOf('.theme-clean {', foundation);
    const cleanDay = css.slice(cleanDayStart, css.indexOf('.theme-clean.dark', cleanDayStart));
    const cleanNightStart = css.indexOf('.theme-clean.dark', cleanDayStart);
    const cleanNight = css.slice(cleanNightStart, css.indexOf('}', cleanNightStart));

    expect(cleanDay).toContain('--workspace-scene-overlay: none;');
    expect(cleanNight).toContain('--workspace-scene-overlay: none;');
  });

  it('hides the Home heading readability overlay', () => {
    expect(css).toMatch(/\.home-heading-region::before\s*\{\s*content:\s*none;/);
  });

  it('hides the Trip hero text shadow only in Clean mode', () => {
    expect(css).toMatch(/\.trip-hero__content\s*\{[^}]*text-shadow:\s*0 2px 18px/);
    expect(css).toMatch(
      /\.theme-clean \.trip-hero__content\s*\{[^}]*color:\s*#fff;[^}]*text-shadow:\s*none;/
    );
  });

  it('activates the scene, shell, and integrated Home header groups in Phase 3', () => {
    for (const token of [
      'scene-filter',
      'scene-overlay',
      'scene-fallback',
      'glass-sidebar',
      'glass-sidebar-translucent',
      'glass-standard',
      'glass-standard-translucent',
      'glass-dense',
      'glass-dense-translucent',
      'border-subtle',
      'border-strong',
      'elevation',
      'text-primary',
      'text-secondary',
      'accent-sage',
      'warning-surface',
      'warning-border',
      'danger-border',
      'focus-ring',
    ]) {
      expect(css).toContain(`var(--workspace-${token})`);
    }

    expect(css).toContain('var(--workspace-danger-surface)');
  });

  it('keeps section glass opt-in with opaque and reduced-transparency fallbacks', () => {
    expect(css).toContain('.trip-section-page');
    expect(css).toContain('.trip-section-surface > :first-child');
    expect(css).toContain('background: var(--workspace-glass-dense);');
    expect(css).toContain('background: var(--workspace-glass-dense-translucent);');

    const reducedTransparency = css.slice(
      css.indexOf('@media (prefers-reduced-transparency: reduce)'),
      css.indexOf('@media (max-width: 1023px)')
    );
    expect(reducedTransparency).toContain('.trip-section-surface > :first-child');
    expect(reducedTransparency).toContain('backdrop-filter: none');
    expect(css).not.toMatch(/\.bg-card-bg\s*\{[^}]*workspace-glass/);
  });

  it('maps the complete semantic utility palette inside routes and sheets', () => {
    for (const selector of ['.trip-section-page {', '.crud-sheet__panel--workspace {']) {
      const start = css.indexOf(selector);
      const block = css.slice(start, css.indexOf('}', start));

      expect(start).toBeGreaterThan(0);
      for (const mapping of [
        '--text-main: var(--workspace-text-primary)',
        '--text-muted: var(--workspace-text-secondary)',
        '--accent-green: var(--workspace-accent-sage)',
        '--accent-blue: var(--workspace-accent-info)',
        '--accent-red: var(--workspace-danger-text)',
        '--status-attention: var(--workspace-accent-amber)',
        '--status-info: var(--workspace-accent-info)',
        '--focus-ring: var(--workspace-focus-ring)',
        '--card-shadow: var(--workspace-elevation)',
      ]) {
        expect(block).toContain(mapping);
      }
    }
  });

  it('keeps readiness SVG colors on runtime semantic variables', () => {
    const readiness = readFileSync(
      resolve(process.cwd(), 'src/components/cards/ReadinessScoreCard.tsx'),
      'utf8'
    );

    expect(readiness).toContain("'var(--accent-green)'");
    expect(readiness).toContain('stroke="var(--border-subtle)"');
    expect(readiness).not.toMatch(/var\(--color-(?:accent|border)/);
  });

  it('does not expose clean-light Home acrylic tokens to other theme contracts', () => {
    const cleanAcrylicTokenDefinitions = [
      ...css.matchAll(/--clean-home-glass-[\w-]+\s*:/g),
    ];

    expect(cleanAcrylicTokenDefinitions.length).toBeGreaterThan(0);
    for (const definition of cleanAcrylicTokenDefinitions) {
      const precedingRuleStart = css.lastIndexOf('}', definition.index) + 1;
      const selector = css.slice(precedingRuleStart, css.indexOf('{', precedingRuleStart));
      expect(selector).toContain('.theme-clean:not(.dark)');
      expect(selector).toContain('[data-trip-app-shell]:has(.home-overview)');
      expect(selector).not.toContain('.theme-clean.dark');
      expect(selector).not.toContain('.theme-expedition');
    }
  });

  it('uses bounded desktop operational workspaces with natural-scroll fallbacks', () => {
    expect(css).toMatch(/\.trip-section-page \.timeline-card\s*\{\s*max-height:\s*none;/);
    expect(css).toMatch(/\.trip-section-page \.gear-checklist-card\s*\{\s*max-height:\s*none;/);
    expect(css).toContain('.trip-section-page .park-intel-scroll');
    expect(css).toContain('.trip-section-page .prep-feed-scroll');

    const operationalWorkspaceStart = css.indexOf('@media (min-width: 1024px) and (min-height: 700px)');
    const wideWorkspaceStart = css.indexOf('@media (min-width: 1280px) and (min-height: 700px)');
    const operationalWorkspace = css.slice(operationalWorkspaceStart, wideWorkspaceStart);
    const wideWorkspace = css.slice(wideWorkspaceStart, css.indexOf('}', css.indexOf('height:', wideWorkspaceStart)) + 1);

    expect(operationalWorkspaceStart).toBeGreaterThan(0);
    expect(operationalWorkspace).toContain('height: calc(100dvh - 5rem)');
    expect(operationalWorkspace).toContain('.trip-section-surface--primary');
    expect(operationalWorkspace).toContain('.trip-section-surface--secondary');
    expect(operationalWorkspace).toContain('grid-template-rows: minmax(0, 1fr)');
    expect(operationalWorkspace).toContain('.meal-planner-card');
    expect(operationalWorkspace).toContain('max-height: 100%');
    expect(operationalWorkspace).toContain('.meal-planner-card__entries');
    expect(operationalWorkspace).toContain('overflow-y: auto');
    expect(operationalWorkspace).toContain('overscroll-behavior: contain');
    expect(operationalWorkspace).toContain('scrollbar-gutter: stable');
    expect(operationalWorkspace).not.toContain('[data-trip-section="crew"]');
    expect(wideWorkspace).toContain('height: calc(100dvh - 2rem)');

    const compactCrewStart = css.indexOf('@media (min-width: 1280px) and (min-height: 700px) and (max-height: 900px)');
    const compactCrew = css.slice(compactCrewStart, css.indexOf('.trip-section-empty-state', compactCrewStart));
    expect(compactCrewStart).toBeGreaterThan(0);
    expect(compactCrew).toContain('[data-trip-section="crew"]');
    expect(compactCrew).toContain('.crew-workspace');
    expect(compactCrew).toContain('gap: 16px');
    expect(compactCrew).toContain('.crew-member-card__notes');
    expect(compactCrew).toContain('.crew-load-card__rows');
    expect(compactCrew).toContain('.crew-load-distribution');
    expect(compactCrew).not.toContain('overflow-y');

    const reducedMotion = css.slice(
      css.indexOf('@media (prefers-reduced-motion: reduce)'),
      css.indexOf('Trip navigation uses one explicit 768px handoff')
    );
    expect(reducedMotion).toContain('.trip-workspace-state-panel *');
    expect(reducedMotion).toContain('animation: none !important');
  });
});
