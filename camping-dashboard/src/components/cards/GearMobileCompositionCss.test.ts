import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(
    path.join(process.cwd(), 'src', 'app', 'globals.css'),
    'utf8'
);

describe('Mobile Gear composition CSS boundary', () => {
    it('keeps workflow layout changes below 768px', () => {
        const marker = css.indexOf('/* Mobile v1 Gear alignment.');
        const endMarker = css.indexOf('/* End Mobile v1 Gear alignment. */', marker);
        const milestoneCss = css.slice(marker, endMarker);
        const mobileCss = milestoneCss.slice(milestoneCss.indexOf('@media (max-width: 767px)'));

        expect(marker).toBeGreaterThan(-1);
        expect(endMarker).toBeGreaterThan(marker);
        expect(mobileCss).toContain('.trip-gear-overall-readiness');
        expect(mobileCss).toContain('.gear-mobile-brief');
        expect(mobileCss).toContain('.gear-checklist-item__pack');
        expect(milestoneCss).not.toContain('@media (min-width:');
        expect(milestoneCss).not.toContain(':has(');
    });
});
