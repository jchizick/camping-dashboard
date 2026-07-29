// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');

describe('Home Day Plan responsive timeline axis', () => {
  it('defines wide and compact axis values without hard-coded line offsets', () => {
    expect(css).toMatch(
      /\.today-timeline__item\s*\{[^}]*--today-timeline-axis-x:\s*4\.65rem;[^}]*--today-timeline-marker-center-y:\s*0\.755rem;/
    );
    expect(css).toMatch(
      /\.today-timeline__item\s*\{[^}]*--today-timeline-axis-x:\s*3\.825rem;[^}]*--today-timeline-marker-center-y:\s*0\.655rem;/
    );
    expect(css).not.toContain('left: 4.12rem');
  });

  it('positions both line segments and markers from the shared axes', () => {
    expect(css).toMatch(
      /\.today-timeline__item:not\(:last-child\)::after\s*\{[^}]*top:\s*var\(--today-timeline-marker-center-y\);[^}]*left:\s*var\(--today-timeline-axis-x\);/
    );
    expect(css).toMatch(
      /\.today-timeline__marker\s*\{[^}]*top:\s*var\(--today-timeline-marker-center-y\);[^}]*left:\s*var\(--today-timeline-axis-x\);/
    );
    expect(css).toMatch(
      /\.today-timeline__item > div\s*\{[^}]*min-width:\s*0;[^}]*grid-column:\s*3;/
    );
  });
});
