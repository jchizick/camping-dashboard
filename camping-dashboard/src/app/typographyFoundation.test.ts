import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(new URL('./layout.tsx', import.meta.url), 'utf8');
const globalCss = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

describe('Field Protocol typography foundation', () => {
  it('loads each approved role through Next font infrastructure', () => {
    expect(layoutSource).toContain("from 'next/font/google'");
    expect(layoutSource).toMatch(/Barlow_Condensed\(\{[\s\S]*?weight: '800'/);
    expect(layoutSource).toMatch(
      /DM_Sans\(\{[\s\S]*?weight: \['400', '500', '600', '700'\]/
    );
    expect(layoutSource).toMatch(/DM_Serif_Display\(\{[\s\S]*?weight: '400'/);
    expect(layoutSource).toMatch(
      /Inter\(\{[\s\S]*?weight: \['400', '500', '600', '700'\]/
    );
    expect(layoutSource).toMatch(
      /JetBrains_Mono\(\{[\s\S]*?weight: \['400', '500', '700'\]/
    );
  });

  it('defines semantic display, UI, editorial, and technical roles', () => {
    expect(globalCss).toMatch(
      /(?:^|\n)body \{[^}]*--font-display: var\(--font-display-face\);[^}]*--font-ui: var\(--font-ui-face\);[^}]*--font-editorial: var\(--font-trip-display\);[^}]*--font-technical: var\(--font-mono-compat-face\);/
    );
  });

  it('keeps the current rendered defaults behind an explicit compatibility bridge', () => {
    expect(globalCss).toContain('--font-sans: var(--font-sans-compat-face)');
    expect(globalCss).toContain('--font-mono: var(--font-mono-compat-face)');
    expect(globalCss).toMatch(/(?:^|\n)body \{[^}]*font-family: var\(--font-sans\)/);
    expect(globalCss).not.toMatch(/(?:^|\n)body \{[^}]*font-family: var\(--font-ui\)/);
    expect(layoutSource).toContain('dmSerifDisplay.variable');
  });

  it('provides an explicit all-caps 800 display primitive without applying it globally', () => {
    expect(globalCss).toMatch(
      /\.type-display,[\s\S]*?font-family: var\(--font-display\);[\s\S]*?font-weight: 800;[\s\S]*?text-transform: uppercase;/
    );
    expect(layoutSource).not.toMatch(/className=.*type-display/);
  });

  it('has no runtime Google Fonts stylesheet or asset dependency', () => {
    expect(globalCss).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/);
    expect(layoutSource).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/);
  });
});
