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
  'warning-surface',
  'warning-border',
  'warning-text',
  'danger-surface',
  'danger-border',
  'danger-text',
  'focus-ring',
] as const;

describe('trip workspace visual tokens', () => {
  it('defines every token for all four theme and mode combinations', () => {
    for (const token of workspaceTokens) {
      const definitions = css.match(
        new RegExp(`--workspace-${token.replaceAll('-', '\\-')}\\s*:`, 'g')
      );
      expect(definitions, token).toHaveLength(4);
    }
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

  it('preserves natural route scrolling and reduced-motion state treatment', () => {
    expect(css).toMatch(/\.trip-section-page \.timeline-card\s*\{\s*max-height:\s*none;/);
    expect(css).toMatch(/\.trip-section-page \.gear-checklist-card\s*\{\s*max-height:\s*none;/);
    expect(css).toContain('.trip-section-page .park-intel-scroll');
    expect(css).toContain('.trip-section-page .prep-feed-scroll');

    const reducedMotion = css.slice(
      css.indexOf('@media (prefers-reduced-motion: reduce)'),
      css.indexOf('Trip navigation uses one explicit 768px handoff')
    );
    expect(reducedMotion).toContain('.trip-workspace-state-panel *');
    expect(reducedMotion).toContain('animation: none !important');
  });
});
