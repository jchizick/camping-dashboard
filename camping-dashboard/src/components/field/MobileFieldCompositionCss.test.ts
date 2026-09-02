import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('mobile Field CSS boundary', () => {
  it('keeps the composition scoped to semantic phone layout without duplicate rendering', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const start = css.indexOf('/* Mobile v1 Field composition.');
    const end = css.indexOf('/* End Mobile v1 Field composition. */');
    const block = css.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('@scope (html[data-phone-layout="true"])');
    expect(block).not.toContain('@media (min-width:');
    expect(block).not.toContain(':has(');
    expect(block).toContain('.mobile-field-essentials');
    expect(block).toContain('.mobile-field-notice[open]');
    expect(block).toContain('.mobile-field-prep__check');
    expect(block).toContain('.mobile-field-notices .mobile-field-section__heading p');
    expect(block).toContain('.mobile-field-notices__count');
    expect(block).toContain('color: var(--workspace-brand-accent);');
    expect(block).toContain('min-height: 2.75rem');
  });
});
