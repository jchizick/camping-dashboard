// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/components/trip/desktopWorkspaceChrome.css'), 'utf8').replace(/\r\n/g, '\n');
const scope = 'html:not([data-phone-layout="true"]):has([data-desktop-trip-workspace] [data-desktop-workspace-document])';
const main = '[data-desktop-trip-workspace] > main[data-desktop-workspace-main]:has(> [data-desktop-workspace-document])';
afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-phone-layout');
});

describe('desktop workspace chrome boundary', () => {
  it('reaches portaled workspace sheets only with the desktop document mounted', () => {
    document.body.innerHTML = '<div data-desktop-trip-workspace><main data-desktop-workspace-main><div data-desktop-workspace-document></div></main></div><div class="crud-sheet__panel--workspace"></div>';
    expect(document.querySelector(scope)).toBe(document.documentElement);
    expect(document.querySelector(main)).toBeTruthy();
    expect(css).toContain(`@scope (${scope})`);
    expect(css).toContain(`${main} {\n  background: transparent;`);
    document.documentElement.setAttribute('data-phone-layout', 'true');
    expect(document.querySelector(scope)).toBeNull();
    document.documentElement.removeAttribute('data-phone-layout');
    document.querySelector('[data-desktop-workspace-document]')!.remove();
    expect(document.querySelector(scope)).toBeNull();
    expect(document.querySelector(main)).toBeNull();
  });

  it('styles Save explicitly while preserving semantic colors and backdrop', () => {
    expect(css).toContain('.crud-form__btn--save {');
    expect(css).toContain('background: var(--workspace-text-primary)');
    expect(css).toContain('var(--font-ui-face)');
    expect(css).not.toMatch(/--(?:accent-red|status-critical|status-attention):/);
    expect(css).not.toContain('.crud-sheet__overlay');
    expect(css).not.toContain('@media');
  });
});
