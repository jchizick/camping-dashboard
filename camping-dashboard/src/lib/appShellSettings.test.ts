import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_SHELL_SETTINGS } from './appShellSettings';

describe('app shell theme defaults', () => {
  it('uses Expedition Light without trip weather context', () => {
    expect(APP_SHELL_SETTINGS.theme_variant).toBe('expedition');
    expect(APP_SHELL_SETTINGS.manual_theme_override).toBe('day');
  });

  it('is shared by both app-shell routes', () => {
    for (const path of ['src/app/trips/page.tsx', 'src/app/trips/new/page.tsx']) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8');
      expect(source).toContain("import { APP_SHELL_SETTINGS } from '@/lib/appShellSettings'");
      expect(source).not.toContain("theme_variant: 'clean'");
    }
  });
});
