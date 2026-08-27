// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Alert,
  GearItem,
  Meal,
  OfflineStatus,
  TimelineEvent,
  WeatherForecast,
} from '@/types';
import type { TripWorkspaceValue } from '@/components/trip/TripWorkspaceProvider';
import { evaluateReadiness } from '@/lib/readiness';

const workspace = vi.hoisted(() => ({
  value: null as TripWorkspaceValue | null,
}));

vi.mock('@/components/trip/TripWorkspaceProvider', () => ({
  useTripWorkspace: () => workspace.value,
}));
vi.mock('@/components/cards/MapRouteCard', () => ({
  default: ({ onSaveLocation }: { onSaveLocation?: unknown }) => (
    <div data-testid="map" data-editable={String(Boolean(onSaveLocation))}>
      Map Card
    </div>
  ),
}));
vi.mock('@/components/cards/WeatherCard', () => ({
  default: ({ forecast }: { forecast?: WeatherForecast[] }) => (
    <div data-testid="weather" data-forecast-count={forecast?.length ?? 0}>
      Weather Card
      <span>5-day forecast</span>
    </div>
  ),
}));
vi.mock('@/components/ui/MissionBriefModal', () => ({
  default: () => null,
}));

import HomeOverview from './HomeOverview';

function timelineEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'event-1',
    trip_id: 'trip-1',
    day_number: 1,
    event_time: '09:00',
    title: 'Launch',
    details: '',
    sort_order: 10,
    phase: null,
    ...overrides,
  } as TimelineEvent;
}

function activeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alert-1',
    trip_id: 'trip-1',
    title: 'Wind advisory',
    body: 'Strong wind expected.',
    severity: 'warning',
    is_active: true,
    dismissed_at: null,
    created_at: '2026-07-27T12:00:00Z',
    ...overrides,
  } as Alert;
}

function readinessResult(complete = false) {
  const gear = [{
    id: 'gear-1',
    trip_id: 'trip-1',
    name: 'Tent',
    priority: 'critical',
    acquired: true,
    packed: complete,
  } as GearItem];
  const meals = (['breakfast', 'lunch', 'dinner'] as const).map((mealType) => ({
    id: `meal-${mealType}`,
    trip_id: 'trip-1',
    day_number: 1,
    meal_type: mealType,
    title: mealType,
    prep_type: 'fresh',
  } as Meal));
  const offlineStatus = {
    trip_id: 'trip-1',
    maps_cached: true,
    permit_saved: complete,
    daily_vehicle_permit_saved: complete,
    route_downloaded: complete,
    satellite_device_connected: complete,
    emergency_contact_ready: complete,
  } as OfflineStatus;

  return evaluateReadiness({
    tripId: 'trip-1',
    tripDays: 1,
    gear,
    meals,
    timeline: [timelineEvent()],
    currentWeather: null,
    forecast: [],
    offlineStatus,
    modules: { mealsEnabled: true, offlineEnabled: true },
  });
}

function workspaceValue(editable = true): TripWorkspaceValue {
  return {
    data: {
      currentWeather: null,
      weatherRefresh: null,
      forecast: [
        {
          id: 'forecast-1',
          trip_id: 'trip-1',
          forecast_date: '2026-07-28',
          high_c: 24,
          low_c: 14,
          condition_label: 'Light rain',
          rain_chance: 30,
        } as WeatherForecast,
      ],
      astro: null,
      settings: {
        show_meals: true,
        show_crew: true,
        show_offline: true,
        show_astro: true,
      },
    },
    trip: {
      id: 'trip-1',
      name: 'Maple Lake Weekend',
      park_name: 'Algonquin Park',
      lake_name: 'Maple Lake',
      site_name: 'Site 4',
      start_date: '2026-07-27',
      end_date: '2026-07-29',
    },
    gear: [],
    meals: [],
    timeline: [timelineEvent()],
    crew: [],
    alerts: [activeAlert()],
    offlineStatus: null,
    parkIntel: null,
    prepFeed: [],
    tripDays: 3,
    countdown: {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isPast: true,
    },
    readiness: readinessResult(),
    editableActions: editable ? { saveCampsite: vi.fn() } : null,
    permissions: {
      role: editable ? 'owner' : 'viewer',
      canEdit: editable,
      isOwner: editable,
    },
    reload: vi.fn(),
  } as unknown as TripWorkspaceValue;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 27, 12));
  workspace.value = workspaceValue();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('HomeOverview', () => {
  it('renders the focused Home hierarchy without legacy full modules', () => {
    render(<HomeOverview />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Maple Lake Weekend' })).toBeTruthy();
    expect(document.querySelector('.home-heading-region img')).toBeNull();
    expect(screen.getByText('Trip is underway')).toBeTruthy();
    const headingRegion = document.querySelector('.home-heading-region');
    const hero = headingRegion?.querySelector('.trip-hero');
    const situation = screen.getByRole('region', { name: 'Current trip situation' });
    expect(headingRegion).toBeTruthy();
    expect(hero).toBeTruthy();
    expect(headingRegion?.contains(situation)).toBe(true);
    expect(hero!.compareDocumentPosition(situation) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(
      Array.from(document.querySelectorAll('[data-home-module]')).map((module) =>
        module.getAttribute('data-home-module')
      )
    ).toEqual(['map', 'weather', 'readiness', 'day-plan', 'trip-notice']);
    expect(screen.getByTestId('map')).toBeTruthy();
    const weatherSurface = within(
      screen.getByRole('region', { name: 'Weather and forecast' })
    );
    expect(weatherSurface.getByTestId('weather').getAttribute('data-forecast-count')).toBe('1');
    expect(weatherSurface.getAllByText('5-day forecast')).toHaveLength(1);
    expect(weatherSurface.queryByRole('heading', { name: 'Forecast' })).toBeNull();
    expect(screen.getByRole('progressbar', { name: 'Overall trip readiness' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View gear' }).getAttribute('href')).toBe(
      '/trips/trip-1/gear'
    );
    expect(screen.getByText('View gear').classList.contains(
      'home-readiness-header-action__label'
    )).toBe(true);
    for (const category of ['Manual Prep', 'Gear', 'Meals']) {
      expect(
        screen.getByRole('progressbar', { name: `${category} readiness` })
      ).toBeTruthy();
    }
    expect(screen.getByText('Today · Day 1')).toBeTruthy();
    expect(screen.getByText('View full plan').closest('a')?.getAttribute('href')).toBe(
      '/trips/trip-1/plan'
    );
    expect(screen.getByText('Wind advisory')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'Launch' })).toBeTruthy();
    expect(screen.getAllByText('09:00')).toHaveLength(2);
    for (const legacyTitle of [
      'Timeline',
      'Meals',
      'Crew Roster',
      'Park Intel',
      'Alerts',
      'Offline Vault',
      'Astronomy',
      'Prep Feed',
    ]) {
      expect(screen.queryByRole('heading', { name: legacyTitle })).toBeNull();
    }

    expect(document.querySelector('.home-workspaces')).toBeNull();
    expect(document.querySelector('.home-overview__footer')).toBeNull();
    expect(screen.queryByText(/Workspace synced/)).toBeNull();
    for (const label of ['Plan', 'Gear', 'Crew', 'Field', 'Field Log']) {
      expect(screen.queryByRole('link', { name: `Open ${label}` })).toBeNull();
    }
  });

  it('keeps viewer Home readable and the retained map read-only', () => {
    workspace.value = workspaceValue(false);
    render(<HomeOverview />);

    expect(screen.getByTestId('map').getAttribute('data-editable')).toBe('false');
    expect(screen.getByRole('link', { name: 'View gear' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /add|edit|delete/i })).toBeNull();
  });

  it('uses the readiness-first mobile composition without duplicate signals', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    render(<HomeOverview />);

    expect(document.querySelector('[data-home-composition="mobile"]')).toBeTruthy();
    expect(document.querySelector('[data-home-composition="desktop"]')).toBeNull();
    expect(
      Array.from(document.querySelectorAll('[data-home-module]')).map((module) =>
        module.getAttribute('data-home-module')
      )
    ).toEqual(['readiness-command', 'trip-context', 'trip-notice', 'map']);
    expect(screen.queryByRole('region', { name: 'Current trip situation' })).toBeNull();
    expect(screen.queryByTestId('weather')).toBeNull();
    expect(screen.getByTestId('map').getAttribute('data-editable')).toBe('false');
    expect(screen.getAllByText('Launch')).toHaveLength(1);
    expect(
      screen.getAllByRole('progressbar', { name: 'Overall trip readiness' })
    ).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Pack critical gear' }).getAttribute('href'))
      .toBe('/trips/trip-1/gear');
  });

  it('keeps the existing composition at the 768px tablet boundary', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
      matches: false,
      media: '(max-width: 767px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    render(<HomeOverview />);

    expect(document.querySelector('[data-home-composition="desktop"]')).toBeTruthy();
    expect(document.querySelector('[data-home-composition="mobile"]')).toBeNull();
    expect(screen.getByRole('region', { name: 'Current trip situation' })).toBeTruthy();
  });

  it('renders empty operational states without restoring removed workspace summaries', () => {
    const value = workspaceValue();
    value.data!.settings.show_meals = false;
    value.data!.settings.show_crew = false;
    value.data!.settings.show_offline = false;
    value.data!.settings.show_astro = false;
    value.alerts = [];
    workspace.value = value;
    render(<HomeOverview />);

    expect(screen.getByText('No active notices')).toBeTruthy();
    expect(document.querySelector('.home-workspaces')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open Crew' })).toBeNull();
  });

  it('links an empty schedule to Plan and exposes complete readiness accessibly', () => {
    const value = workspaceValue();
    value.timeline = [];
    value.readiness = readinessResult(true);
    workspace.value = value;
    render(<HomeOverview />);

    expect(screen.getByText('No events are planned for this day yet.')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Open Plan' })).toHaveLength(1);
    expect(
      screen.getByRole('progressbar', { name: 'Overall trip readiness' }).getAttribute(
        'aria-valuenow'
      )
    ).toBe('100');
    expect(screen.getAllByText('Locked In')).toHaveLength(2);
  });

  it('reflects canonical operational state immediately without calling reload', () => {
    const value = workspaceValue();
    workspace.value = value;
    const view = render(<HomeOverview />);

    value.timeline = [
      timelineEvent({ id: 'event-2', title: 'Portage', event_time: '10:30' }),
    ];
    value.alerts = [
      activeAlert({ id: 'dismissed', severity: 'critical', dismissed_at: '2026-07-27T13:00:00Z' }),
      activeAlert({ id: 'watch', title: 'Rain watch', severity: 'watch' }),
    ];
    value.readiness = {
      ...value.readiness!,
      score: 88,
      status: 'nearly-ready',
      statusLabel: 'Nearly Ready',
      categories: {
        ...value.readiness!.categories,
        gear: { ...value.readiness!.categories.gear, score: 100 },
        offline: { ...value.readiness!.categories.offline, score: 67 },
      },
    };

    view.rerender(<HomeOverview />);

    expect(screen.getAllByText('Portage')).toHaveLength(2);
    expect(screen.getByText('Rain watch')).toBeTruthy();
    expect(screen.queryByText('Wind advisory')).toBeNull();
    expect(screen.getAllByText('88%').length).toBeGreaterThan(0);
    expect(value.reload).not.toHaveBeenCalled();
  });
});
