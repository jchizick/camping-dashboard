import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Expedition primary-theme migration', () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      'supabase/migrations/20260808210000_make_expedition_primary_theme.sql'
    ),
    'utf8'
  );

  it('migrates only Clean variants and preserves day/night preferences', () => {
    expect(migration).toMatch(/update public\.settings/i);
    expect(migration).toMatch(/set theme_variant = 'expedition'/i);
    expect(migration).toMatch(/where theme_variant = 'clean'/i);
    expect(migration).not.toMatch(/set\s+manual_theme_override/i);
  });

  it('keeps the maintenance helper from coupling variants to day or night', () => {
    const helper = readFileSync(resolve(process.cwd(), 'toggle_theme.js'), 'utf8');
    expect(helper).toMatch(/update\(\{ theme_variant: mode \}\)/);
    expect(helper).toMatch(/\.not\('trip_id', 'is', null\)/);
    expect(helper).not.toMatch(/manual_theme_override\s*:/);
  });
});
