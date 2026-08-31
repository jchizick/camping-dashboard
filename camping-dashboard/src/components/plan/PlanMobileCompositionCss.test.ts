import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(
  path.join(process.cwd(), 'src', 'app', 'globals.css'),
  'utf8'
);
const page = fs.readFileSync(
  path.join(process.cwd(), 'src', 'app', 'trips', '[tripId]', 'plan', 'page.tsx'),
  'utf8'
);

describe('Mobile Plan composition boundary', () => {
  it('keeps Plan restructuring scoped to semantic phone layout and does not target Gear', () => {
    const marker = css.indexOf('/* Mobile v1 Plan consolidation.');
    const endMarker = css.indexOf('/* End Mobile v1 Plan consolidation. */', marker);
    const milestoneCss = css.slice(marker, endMarker);

    expect(marker).toBeGreaterThan(-1);
    expect(endMarker).toBeGreaterThan(marker);
    expect(milestoneCss).toContain('@scope (html[data-phone-layout="true"])');
    expect(milestoneCss).toContain('.mobile-plan-overview');
    expect(milestoneCss).toContain('[data-trip-section="plan"]');
    expect(milestoneCss).not.toContain('[data-trip-section="gear"]');
    expect(milestoneCss).not.toContain('@media (min-width:');
  });

  it('mounts one responsive composition instead of hiding duplicate controls', () => {
    expect(page).toContain("import { usePhoneLayout } from '@/components/trip/PhoneLayoutProvider'");
    expect(page).toContain('const usesMobilePlanComposition = usePhoneLayout()');
    expect(page).not.toContain('matchMedia(');
    expect(page).toContain('usesMobilePlanComposition ? (');
    expect(page).toContain('<MobilePlanOverview');
    expect(page).toContain('data-plan-composition="desktop"');
    expect(page).not.toContain('hidden md:');
  });
});
