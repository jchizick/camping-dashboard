import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(
  path.join(process.cwd(), 'src', 'app', 'globals.css'),
  'utf8'
);

describe('Mobile Home composition CSS boundary', () => {
  it('keeps the readiness-command composition scoped below 768px', () => {
    const marker = css.indexOf('/* Mobile v1 Home command centre.');
    const endMarker = css.indexOf(
      '/* End Mobile v1 Home command centre. */',
      marker
    );
    const milestoneCss = css.slice(marker, endMarker);
    const mobileBlock = milestoneCss.slice(
      milestoneCss.indexOf('@media (max-width: 767px)'),
      milestoneCss.indexOf('@media (prefers-reduced-motion: reduce)')
    );

    expect(marker).toBeGreaterThan(-1);
    expect(endMarker).toBeGreaterThan(marker);
    expect(mobileBlock).toContain('.mobile-home-overview');
    expect(mobileBlock).toContain('.mobile-readiness-command');
    expect(mobileBlock).toContain('.mobile-readiness-gauge');
    expect(mobileBlock).toContain('.mobile-readiness-gauge__marker');
    expect(mobileBlock).toContain('.mobile-readiness-gauge__landmarks');
    expect(mobileBlock).toContain('.mobile-trip-context');
    expect(mobileBlock).toContain('.mobile-home-schedule');
    expect(milestoneCss).not.toContain('@media (min-width:');
    expect(milestoneCss).not.toContain(':has(');
  });
});
