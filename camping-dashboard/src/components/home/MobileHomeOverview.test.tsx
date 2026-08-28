// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  Alert,
  GearItem,
  Meal,
  TimelineEvent,
  TripDashboard,
  WeatherCurrent,
} from '@/types';
import { evaluateReadiness, type EvaluateReadinessInput } from '@/lib/readiness';
import type { HomeViewModel } from './homeViewModel';
import MobileHomeOverview from './MobileHomeOverview';
import ReadinessGauge from './ReadinessGauge';

vi.mock('@/components/cards/MapRouteCard', () => ({
  default: () => <div data-testid="mobile-map">Map context</div>,
}));

const trip = {
  id: 'trip-1',
  name: 'Maple Lake Weekend',
  park_name: 'Algonquin Park',
  lake_name: 'Maple Lake',
  site_name: 'Site 4',
  start_date: '2026-08-24',
  end_date: '2026-08-26',
} as TripDashboard;

function gearItem(overrides: Partial<GearItem> = {}): GearItem {
  return {
    id: 'gear-1',
    trip_id: 'trip-1',
    name: 'Rain shell',
    priority: 'critical',
    acquired: true,
    packed: true,
    ...overrides,
  } as GearItem;
}

function completeMeals(): Meal[] {
  return (['breakfast', 'lunch', 'dinner'] as const).map((mealType) => ({
    id: `meal-${mealType}`,
    trip_id: 'trip-1',
    day_number: 1,
    meal_type: mealType,
    title: mealType,
    prep_type: 'fresh',
  } as Meal));
}

function event(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'event-1',
    trip_id: 'trip-1',
    day_number: 1,
    event_time: '09:00',
    title: 'Launch',
    details: '',
    sort_order: 10,
    phase: 'Travel',
    ...overrides,
  } as TimelineEvent;
}

function readiness(overrides: Partial<EvaluateReadinessInput> = {}) {
  return evaluateReadiness({
    tripId: 'trip-1',
    tripDays: 1,
    gear: [gearItem()],
    meals: [],
    timeline: [],
    currentWeather: null,
    forecast: [],
    offlineStatus: null,
    modules: { mealsEnabled: false, offlineEnabled: false },
    ...overrides,
  });
}

function homeModel(
  readinessResult = readiness(),
  overrides: Partial<HomeViewModel> = {}
): HomeViewModel {
  return {
    trip,
    readiness: readinessResult,
    setup: null,
    schedule: { label: 'Today', dayNumber: 1, events: [] },
    nextEvent: null,
    laterEvents: [],
    notice: null,
    conditions: {
      currentWeather: null,
      weatherRefresh: null,
      forecast: [],
      astro: null,
    },
    hrefs: {
      gear: '/trips/trip-1/gear',
      plan: '/trips/trip-1/plan',
      field: '/trips/trip-1/guide',
    },
    hasCampsiteContext: true,
    ...overrides,
  };
}

afterEach(cleanup);

describe('MobileHomeOverview readiness command centre', () => {
  it('renders the exact comparable score as a measured instrument gauge', () => {
    const result = {
      ...readiness({
        gear: [gearItem({ acquired: false, packed: false })],
      }),
      score: 43,
      scoreStatus: 'not-ready' as const,
      status: 'not-ready' as const,
      statusLabel: 'Not Ready',
    };
    render(<MobileHomeOverview model={homeModel(result)} />);

    expect(screen.getByText('43')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Not Ready' })).toBeTruthy();

    const gauge = screen.getByRole('progressbar', {
      name: 'Overall trip readiness',
    });
    expect(gauge.getAttribute('aria-valuenow')).toBe('43');
    expect(gauge.getAttribute('aria-valuetext')).toBe('43% · Not Ready');
    expect(gauge.querySelector('[data-readiness-fill]')?.getAttribute('style'))
      .toContain('clip-path: inset(0 57% 0 0)');
    expect(gauge.querySelector('[data-readiness-marker]')?.getAttribute('style'))
      .toContain('left: 43%');
    expect(gauge.querySelector('[data-readiness-marker-notch]')).toBeTruthy();

    for (const landmark of ['25%', '50%', '75%', '100%']) {
      expect(within(gauge).getByText(landmark)).toBeTruthy();
    }
  });

  it('leads with Required Gear setup before a fresh-trip Meal warning', () => {
    const result = readiness({
      gear: [],
      meals: [],
      modules: { mealsEnabled: true, offlineEnabled: false },
    });
    render(
      <MobileHomeOverview
        model={homeModel(result, {
          setup: {
            need: 'identify-required-gear',
            title: 'Identify Required Gear',
            description: 'Mark the items this trip must have so readiness can assess what still needs attention.',
            action: {
              href: '/trips/trip-1/gear?intent=add-required',
              label: 'Identify Required Gear',
            },
          },
        })}
        canSetupRequiredGear
      />
    );

    expect(screen.getByText('Assessment setup')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'Identify Required Gear' })).toBeTruthy();
    expect(screen.queryByText('Meal plan has open slots')).toBeNull();
    expect(screen.getByRole('link', { name: 'Identify Required Gear' }).getAttribute('href'))
      .toBe('/trips/trip-1/gear?intent=add-required');
    expect(screen.getByRole('heading', { level: 2, name: 'Not Ready' })).toBeTruthy();
  });

  it('keeps the derived setup truth read-only for viewers', () => {
    const result = readiness({
      gear: [],
      modules: { mealsEnabled: true, offlineEnabled: false },
    });
    render(
      <MobileHomeOverview
        model={homeModel(result, {
          setup: {
            need: 'identify-required-gear',
            title: 'Identify Required Gear',
            description: 'Mark the items this trip must have so readiness can assess what still needs attention.',
            action: {
              href: '/trips/trip-1/gear?intent=add-required',
              label: 'Identify Required Gear',
            },
          },
        })}
      />
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Identify Required Gear' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Identify Required Gear' })).toBeNull();
  });

  it('renders the complete high-readiness state without fabricating work', () => {
    render(<MobileHomeOverview model={homeModel()} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Locked In' })).toBeTruthy();
    expect(screen.getByText('Required preparation is complete.')).toBeTruthy();
    expect(
      screen.getByRole('progressbar', { name: 'Overall trip readiness' }).getAttribute(
        'aria-valuenow'
      )
    ).toBe('100');
    expect(screen.queryByText('Next action')).toBeNull();
  });

  it('surfaces the domain blocker and its existing Gear action', () => {
    const result = readiness({
      gear: [gearItem({ acquired: false, packed: false })],
    });
    render(<MobileHomeOverview model={homeModel(result)} />);

    expect(screen.getByText('1 blocker')).toBeTruthy();
    expect(screen.getByText('Rain shell is not acquired')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Review gear' }).getAttribute('href'))
      .toBe('/trips/trip-1/gear');
  });

  it('distinguishes a warning from a blocker and preserves its action', () => {
    const result = readiness({
      gear: [gearItem({ acquired: true, packed: false })],
    });
    render(<MobileHomeOverview model={homeModel(result)} />);

    expect(screen.getByText('1 warning')).toBeTruthy();
    expect(screen.queryByText('1 blocker')).toBeNull();
    expect(screen.getByText('Rain shell is not packed')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Pack critical gear' }).getAttribute('href')
    ).toBe('/trips/trip-1/gear');
  });

  it('treats a 100% partial assessment as incomplete and offers the coverage action', () => {
    const result = readiness({
      gear: [gearItem({ priority: 'low' })],
      meals: completeMeals(),
      modules: { mealsEnabled: true, offlineEnabled: false },
    });
    render(<MobileHomeOverview model={homeModel(result)} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Readiness Incomplete' })
    ).toBeTruthy();
    expect(screen.getByText("Required gear hasn't been identified yet.")).toBeTruthy();
    expect(screen.getByText('100% of assessed preparation is complete.')).toBeTruthy();
    expect(screen.queryByText('Locked In')).toBeNull();
    expect(screen.queryByRole('progressbar', { name: 'Overall trip readiness' }))
      .toBeNull();
    expect(document.querySelector('[data-readiness-gauge]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Review gear' }).getAttribute('href'))
      .toBe('/trips/trip-1/gear');
  });

  it('does not manufacture a percentage when readiness is unavailable', () => {
    const result = readiness({ gear: [] });
    render(<MobileHomeOverview model={homeModel(result)} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Readiness Unavailable' })
    ).toBeTruthy();
    expect(screen.getByText('No readiness score is available.')).toBeTruthy();
    expect(screen.queryByRole('progressbar', { name: 'Overall trip readiness' }))
      .toBeNull();
    expect(document.querySelector('[data-readiness-gauge]')).toBeNull();
  });
});

describe('ReadinessGauge score marker edges', () => {
  it.each([
    { score: 0, edge: 'start', clip: 'inset(0 100% 0 0)' },
    { score: 100, edge: 'end', clip: 'inset(0 0% 0 0)' },
  ])('keeps the $score% marker notch inside the $edge edge', ({ score, edge, clip }) => {
    render(<ReadinessGauge score={score} statusLabel="Not Ready" />);

    const marker = document.querySelector('[data-readiness-marker]');
    expect(marker?.getAttribute('data-edge')).toBe(edge);
    expect(marker?.querySelector('[data-readiness-marker-notch]')).toBeTruthy();
    expect(document.querySelector('[data-readiness-fill]')?.getAttribute('style'))
      .toContain(`clip-path: ${clip}`);
  });
});

describe('MobileHomeOverview supporting context', () => {
  it('renders the next event once and reserves the schedule preview for later events', () => {
    const nextEvent = event();
    const laterEvent = event({
      id: 'event-2',
      event_time: '13:00',
      title: 'Make camp',
      sort_order: 20,
    });
    const model = homeModel(readiness(), {
      schedule: {
        label: 'Today',
        dayNumber: 1,
        events: [nextEvent, laterEvent],
      },
      nextEvent,
      laterEvents: [laterEvent],
    });
    render(<MobileHomeOverview model={model} />);

    expect(screen.getAllByText('Launch')).toHaveLength(1);
    expect(document.body.textContent?.match(/09:00/g)).toHaveLength(1);
    expect(screen.getAllByText('Make camp')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'View full trip plan' }).getAttribute('href'))
      .toBe('/trips/trip-1/plan');
  });

  it('keeps weather contextual and handles missing weather without an empty card', () => {
    const nextEvent = event();
    const noWeather = homeModel(readiness(), { nextEvent });
    const view = render(<MobileHomeOverview model={noWeather} />);

    const context = screen.getByRole('region', { name: 'Trip context' });
    expect(within(context).getByText('Conditions unavailable')).toBeTruthy();

    const weather = {
      trip_id: 'trip-1',
      temperature_c: 17,
      condition_label: 'Light rain',
      rain_chance: 40,
      sunset_time: '20:31',
    } as WeatherCurrent;
    view.rerender(
      <MobileHomeOverview
        model={homeModel(readiness(), {
          nextEvent,
          conditions: {
            currentWeather: weather,
            weatherRefresh: null,
            forecast: [],
            astro: null,
          },
        })}
      />
    );

    expect(screen.getByText('17°C · Light rain')).toBeTruthy();
    expect(screen.getByText('40% rain chance')).toBeTruthy();
    expect(screen.getByText('Sunset 20:31')).toBeTruthy();
  });

  it('omits empty context, schedule, and notice surfaces', () => {
    render(
      <MobileHomeOverview
        model={homeModel(readiness(), { hasCampsiteContext: false })}
      />
    );

    expect(screen.queryByRole('region', { name: 'Trip context' })).toBeNull();
    expect(document.querySelector('[data-home-module="day-plan"]')).toBeNull();
    expect(document.querySelector('[data-home-module="trip-notice"]')).toBeNull();
    expect(document.querySelector('[data-home-module="map"]')).toBeNull();
  });

  it('presents external alerts as a Trip notice with the existing Field route', () => {
    const notice = {
      id: 'alert-1',
      trip_id: 'trip-1',
      title: 'Wind watch',
      body: 'Secure loose equipment before the wind arrives.',
      severity: 'watch',
      is_active: true,
      dismissed_at: null,
      created_at: '2026-08-24T12:00:00Z',
      updated_at: '2026-08-24T12:00:00Z',
    } as Alert;
    render(<MobileHomeOverview model={homeModel(readiness(), { notice })} />);

    expect(screen.getByText('Trip notice')).toBeTruthy();
    expect(screen.queryByText('Priority notice')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'View trip notice in Field' }).getAttribute(
        'href'
      )
    ).toBe('/trips/trip-1/guide');
  });
});
