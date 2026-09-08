import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('caps only the desktop document while retaining responsive rail geometry', () => {
  const css = readFileSync('src/components/trip/desktopTripWorkspace.css', 'utf8');
  expect(css).toMatch(/\[data-desktop-trip-workspace\] \[data-desktop-workspace-document\]\s*\{\s*max-width: 1240px;\s*margin-inline: auto;/);
  expect(css).toContain('grid-template-columns: 11rem minmax(0, 1fr)');
  expect(css).toContain('@media (min-width: 1440px)');
  expect(css).toContain('grid-template-columns: 13rem minmax(0, 1fr)');
  expect(css).toContain('@media (max-height: 699px)');
});
