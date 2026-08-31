import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(
  path.join(process.cwd(), 'src', 'app', 'globals.css'),
  'utf8'
);

describe('Mobile Home composition CSS boundary', () => {
  it('keeps the readiness-command composition scoped to semantic phone layout', () => {
    const marker = css.indexOf('/* Mobile v1 Home command centre.');
    const endMarker = css.indexOf(
      '/* End Mobile v1 Home command centre. */',
      marker
    );
    const milestoneCss = css.slice(marker, endMarker);
    const phoneBlock = milestoneCss.slice(
      milestoneCss.indexOf('@scope (html[data-phone-layout="true"])'),
      milestoneCss.indexOf('@media (prefers-reduced-motion: reduce)')
    );

    expect(marker).toBeGreaterThan(-1);
    expect(endMarker).toBeGreaterThan(marker);
    expect(phoneBlock).toContain('.mobile-home-overview');
    expect(phoneBlock).toContain('.mobile-readiness-command');
    expect(phoneBlock).toContain('.mobile-readiness-gauge');
    expect(phoneBlock).toContain('.mobile-readiness-gauge__marker');
    expect(phoneBlock).toContain('.mobile-readiness-gauge__landmarks');
    expect(phoneBlock).toContain('.mobile-trip-context');
    expect(phoneBlock).toContain('.mobile-home-schedule');
    expect(milestoneCss).toContain('@scope (html[data-phone-layout="true"])');
    expect(milestoneCss).not.toContain('@media (min-width:');
    expect(milestoneCss).not.toContain(':has(');
  });
});
