import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(
    path.join(process.cwd(), 'src', 'app', 'globals.css'),
    'utf8'
);

describe('Mobile Gear composition CSS boundary', () => {
    it('keeps workflow layout changes scoped to semantic phone layout', () => {
        const marker = css.indexOf('/* Mobile v1 Gear alignment.');
        const endMarker = css.indexOf('/* End Mobile v1 Gear alignment. */', marker);
        const milestoneCss = css.slice(marker, endMarker);
        const phoneCss = milestoneCss.slice(milestoneCss.indexOf('@scope (html[data-phone-layout="true"])'));

        expect(marker).toBeGreaterThan(-1);
        expect(endMarker).toBeGreaterThan(marker);
        expect(phoneCss).toContain('.trip-gear-overall-readiness');
        expect(phoneCss).toContain('.gear-mobile-brief');
        expect(phoneCss).toContain('.gear-desktop-summary');
        expect(phoneCss).toContain('.gear-desktop-weight');
        expect(phoneCss).toContain('.gear-checklist-item__pack');
        expect(phoneCss).toContain('var(--workspace-state-pending)');
        expect(phoneCss).toContain('.gear-mobile-brief__packing-progress[data-state="complete"]');
        expect(phoneCss).toContain('button[data-filter="to-pack"][aria-pressed="true"]');
        expect(milestoneCss).not.toContain('@media (min-width:');
        expect(milestoneCss).not.toContain(':has(');
    });
});
