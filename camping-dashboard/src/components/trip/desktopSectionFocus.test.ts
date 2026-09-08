import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { desktopSectionHeading } from './desktopSectionNavigation';

it('styles every canonical destination with a visible, non-layout focus cue and forced-colors fallback', () => {
  const css = readFileSync('src/components/trip/desktopSectionFocus.css', 'utf8');
  expect(css).toContain('@scope ([data-desktop-trip-workspace] [data-desktop-workspace-document])');
  for (const route of ['', '/plan', '/gear', '/crew', '/guide']) {
    expect(css).toContain(`#${desktopSectionHeading(`/trips/trip-1${route}`, 'trip-1')}`);
  }
  expect(css).toContain(':focus-visible');
  expect(css).toContain('text-decoration-line: underline');
  expect(css).toContain('@media (forced-colors: active)');
  expect(css).toContain('outline-color: CanvasText');
  expect(css).not.toMatch(/outline:\s*none|forced-color-adjust:\s*none|padding:|margin:|border:|scroll-margin|height:|width:/);
});
