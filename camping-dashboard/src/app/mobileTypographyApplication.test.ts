import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const globalCss = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');
const tripPageHeader = readFileSync(
  new URL('../components/trip/TripPageHeader.tsx', import.meta.url),
  'utf8'
);
const tripHero = readFileSync(
  new URL('../components/home/TripHero.tsx', import.meta.url),
  'utf8'
);
const mobileHome = readFileSync(
  new URL('../components/home/MobileHomeOverview.tsx', import.meta.url),
  'utf8'
);
const mobilePlan = readFileSync(
  new URL('../components/plan/MobilePlanOverview.tsx', import.meta.url),
  'utf8'
);
const mobileGear = readFileSync(
  new URL('../components/cards/GearChecklistCard.tsx', import.meta.url),
  'utf8'
);
const mobileField = readFileSync(
  new URL('../components/field/MobileFieldOverview.tsx', import.meta.url),
  'utf8'
);

const phaseStart = globalCss.indexOf(
  '/* Visual Phase 2: authenticated mobile typography application. */'
);
const phaseEnd = globalCss.indexOf(
  '/* End Visual Phase 2 typography application. */'
);
const phaseCss = globalCss.slice(phaseStart, phaseEnd);
const mobileCss = phaseCss.slice(phaseCss.indexOf('@media (max-width: 767px)'));

describe('Field Protocol mobile typography application', () => {
  it('marks the approved short-form display moments without changing source copy', () => {
    expect(tripPageHeader).toContain('data-mobile-type-role="page-title"');
    expect(tripHero).toContain('data-mobile-type-role="trip-title"');
    expect(mobileHome).toContain('data-mobile-type-role="readiness-score"');
    expect(mobileHome).toContain('data-mobile-type-role="readiness-state"');
    expect(mobilePlan).toContain('data-mobile-type-role="selected-day"');
    expect(mobileGear).toContain('data-mobile-type-role="packing-metric"');
    expect(mobileField).toContain('data-mobile-type-role="field-temperature"');
    expect(mobileField).toContain('data-mobile-type-role="field-completion"');
    expect(tripHero).toContain('{trip.name}');
  });

  it('keeps Barlow application below the mobile boundary and presentation-only', () => {
    expect(phaseStart).toBeGreaterThanOrEqual(0);
    expect(phaseEnd).toBeGreaterThan(phaseStart);
    expect(mobileCss).toContain('[data-mobile-type-role="page-title"]');
    expect(mobileCss).toContain('font-family: var(--font-display)');
    expect(mobileCss).toContain('text-transform: uppercase');
    expect(mobileCss).not.toContain('@media (min-width:');
  });

  it('moves the authenticated mobile UI and navigation voice to DM Sans', () => {
    expect(mobileCss).toMatch(
      /\[data-trip-app-shell\],[\s\S]*?font-family: var\(--font-ui\)/
    );
    expect(mobileCss).toContain('[data-trip-app-shell] .trip-mobile-nav');
    expect(mobileCss).toContain('[data-trip-app-shell] .trip-shell-identity');
    expect(mobileCss).toContain('[data-trip-app-shell] .trip-source-status');
    expect(mobileCss).toContain('[data-trip-app-shell] .font-mono');
  });

  it('keeps workspace forms conventional and readable', () => {
    expect(phaseCss).toMatch(
      /\.crud-sheet__panel--workspace \{\s*font-family: var\(--font-ui\)/
    );
    expect(phaseCss).toMatch(
      /\.crud-sheet__panel--workspace \.crud-sheet__title[\s\S]*?text-transform: none;/
    );
    expect(phaseCss).toMatch(
      /\.crud-sheet__panel--workspace \.crud-form__btn[\s\S]*?text-transform: none;/
    );
    expect(mobileCss).toMatch(
      /\.crud-sheet__panel--workspace :is\([\s\S]*?font-size: 1rem;/
    );
  });

  it('preserves the signed-out editorial family and a deliberate technical role', () => {
    expect(globalCss).toMatch(
      /\.signed-out-intro h1 \{[^}]*font-family: var\(--font-trip-display\)/
    );
    expect(globalCss).toMatch(
      /@media \(max-width: 767px\) \{[\s\S]*?\.signed-out-intro h1 \{[^}]*font-family: var\(--font-display\)/
    );
    expect(globalCss).toMatch(
      /\.type-technical \{[^}]*font-family: var\(--font-technical\)/
    );
  });
});
