import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('desktop workspace presentation boundary', () => {
  it('keeps hierarchy polish scoped to the desktop document without changing focus or layout', () => {
    const css = readFileSync('src/components/trip/desktopWorkspaceHierarchy.css', 'utf8');
    expect(css).toContain('@scope ([data-desktop-trip-workspace])');
    expect(css).toContain('[data-desktop-workspace-document]');
    expect(css).not.toMatch(/:focus|outline:|display:|grid-template|(?:min-|max-)?width:|(?:min-|max-)?height:|opacity:|visibility:/);
    expect(css).toContain('.dwg-item-actions button[aria-pressed]');
    expect(css).toContain('.dwg-item-actions button:not([aria-pressed])');
    expect(css).toContain('.dwc-member-copy h3');
  });
});
