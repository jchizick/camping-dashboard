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
      'border-subtle',
      'border-strong',
      'elevation',
      'text-primary',
      'text-secondary',
      'accent-sage',
      'focus-ring',
    ]) {
      expect(css).toContain(`var(--workspace-${token})`);
    }

    for (const token of ['warning-surface', 'danger-surface']) {
      expect(css).not.toContain(`var(--workspace-${token})`);
    }
  });
});
