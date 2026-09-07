// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
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
import {
  PHONE_LAYOUT_MEDIA_QUERY,
  PhoneLayoutProvider,
} from '@/components/trip/PhoneLayoutProvider';

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
import { TripWorkspaceStatusProvider } from '@/components/trip/TripWorkspaceStatus';

function renderHomeOverview() {
  return render(
    <PhoneLayoutProvider>
      <HomeOverview />
    </PhoneLayoutProvider>
  );
}

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
  it('keeps unavailable readiness distinct from zero and preserves the setup intent', () => {
    const value = workspaceValue();
    value.readiness = evaluateReadiness({
      tripId: 'trip-1', tripDays: 1, gear: [], meals: [], timeline: [],
      currentWeather: null, forecast: [], offlineStatus: null,
      modules: { mealsEnabled: false, offlineEnabled: false },
    });
    value.trip = { ...value.trip!, park_name: null, lake_name: null, site_name: null };
    workspace.value = value;
    renderHomeOverview();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText('Not enough information to assess readiness.')).toBeTruthy();
    expect(screen.getByText('Campsite unavailable')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Identify Required Gear' }).getAttribute('href'))
      .toBe('/trips/trip-1/gear?intent=add-required');
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('labels saved conditions and notices without treating old sunset data as current', () => {
    const value = workspaceValue(false);
    value.data!.currentWeather = {
      temperature_c: 18, condition_label: 'Mainly clear', sunset_time: '19:47',
      updated_at: '2026-07-25T12:00:00Z',
    } as NonNullable<typeof value.data>['currentWeather'];
    workspace.value = value;
    render(<TripWorkspaceStatusProvider value={{ source: 'cache', connectivity: 'offline',
      cachedAt: null, lastOnlineVerifiedAt: null, reload: vi.fn() }}>
      <PhoneLayoutProvider><HomeOverview /></PhoneLayoutProvider>
    </TripWorkspaceStatusProvider>);
    expect(document.querySelector('[data-desktop-workspace-overview]')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Previous conditions' })).toBeTruthy();
    expect(screen.getByText(/Cached · updated/)).toBeTruthy();
    expect(screen.getByText('18°C')).toBeTruthy();
    expect(screen.getByText('Sunset (saved)')).toBeTruthy();
    expect(screen.getByText('19:47')).toBeTruthy();
    expect(screen.getByText('Saved notice')).toBeTruthy();
    expect(screen.getByText('Cached · may have changed')).toBeTruthy();
    expect(screen.getByTestId('map').getAttribute('data-editable')).toBe('false');
  });

  it('exposes refresh failure and partial coverage without implying full readiness', () => {
    const value = workspaceValue();
    value.readiness = { ...value.readiness!, assessmentCoverage: 'partial', statusLabel: 'Readiness Incomplete' };
    value.data!.weatherRefresh = { status: 'failed' } as NonNullable<typeof value.data>['weatherRefresh'];
    workspace.value = value;
    renderHomeOverview();
    expect(screen.getByText('Readiness Incomplete')).toBeTruthy();
    expect(screen.getByText(/Partial assessment/)).toBeTruthy();
    expect(screen.getByText('Weather unavailable · refresh needs attention')).toBeTruthy();
  });

  it('refreshes trip status at local midnight without a domain context update', () => {
    vi.setSystemTime(new Date(2026, 6, 26, 23, 59, 59));
    const domainValue = workspace.value;
    renderHomeOverview();
    expect(screen.getByText('Trip is approaching')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1000));
    expect(workspace.value).toBe(domainValue);
    expect(screen.getByText('Trip is underway')).toBeTruthy();
  });

  it('renders a compact desktop summary using canonical readiness and guarded destinations', () => {
    renderHomeOverview();
    expect(document.querySelector('[data-desktop-workspace-overview]')).toBeTruthy();
    expect(document.querySelector('[data-home-composition="mobile"]')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Maple Lake Weekend' })).toBeTruthy();
    expect(screen.getByText('Algonquin Park · Maple Lake · Site 4')).toBeTruthy();
    expect(screen.getByText(/3 days · 2 nights/)).toBeTruthy();
    expect(screen.getAllByTestId('map')).toHaveLength(1);
    expect(screen.queryByTestId('weather')).toBeNull();
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow'))
      .toBe(String(workspace.value!.readiness!.score));
    expect(document.querySelectorAll('[data-readiness-segment]')).toHaveLength(20);
    const priority = workspace.value!.readiness!.primaryPriority!;
    expect(screen.getByRole('heading', { name: priority.title })).toBeTruthy();
    expect(screen.getByRole('link', { name: priority.action!.label }).getAttribute('href'))
      .toBe(priority.action!.href);
    expect(screen.getByRole('link', { name: 'Open Plan' }).getAttribute('href')).toBe('/trips/trip-1/plan');
    expect(screen.getByRole('link', { name: 'Review in Field' }).getAttribute('href')).toBe('/trips/trip-1/guide');
    expect(screen.getByText('Today · Day 1 · planner order')).toBeTruthy();
    expect(screen.getAllByText('Launch')).toHaveLength(1);
    expect(screen.getAllByText('09:00')).toHaveLength(1);
    expect(screen.queryByText('Next')).toBeNull();
    expect(screen.getByText('Weather unavailable')).toBeTruthy();
    expect(document.querySelector('.home-overview--desktop')).toBeNull();
  });
  it('keeps viewer Home readable and the retained map read-only', () => {
    workspace.value = workspaceValue(false);
    renderHomeOverview();

    expect(screen.getByTestId('map').getAttribute('data-editable')).toBe('false');
    expect(screen.getByRole('link', { name: 'Pack critical gear' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /add|edit|delete/i })).toBeNull();
  });

  it('uses the readiness-first mobile composition without duplicate signals', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: query === PHONE_LAYOUT_MEDIA_QUERY,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    renderHomeOverview();

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
      media: PHONE_LAYOUT_MEDIA_QUERY,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    renderHomeOverview();

    expect(document.querySelector('[data-home-composition="desktop"]')).toBeTruthy();
    expect(document.querySelector('[data-home-composition="mobile"]')).toBeNull();
    expect(document.querySelector('[data-desktop-workspace-overview]')).toBeTruthy();
  });

  it('renders empty operational states without restoring removed workspace summaries', () => {
    const value = workspaceValue();
    value.data!.settings.show_meals = false;
    value.data!.settings.show_crew = false;
    value.data!.settings.show_offline = false;
    value.data!.settings.show_astro = false;
    value.alerts = [];
    workspace.value = value;
    renderHomeOverview();

    expect(screen.queryByRole('complementary', { name: 'Trip notice' })).toBeNull();
    expect(document.querySelector('.home-workspaces')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open Crew' })).toBeNull();
  });

  it('links an empty schedule to Plan and exposes complete readiness accessibly', () => {
    const value = workspaceValue();
    value.timeline = [];
    value.readiness = readinessResult(true);
    workspace.value = value;
    renderHomeOverview();

    expect(screen.getByText('No events are planned for this day yet.')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Open Plan' })).toHaveLength(1);
    expect(
      screen.getByRole('progressbar', { name: 'Overall trip readiness' }).getAttribute(
        'aria-valuenow'
      )
    ).toBe('100');
    expect(screen.getAllByText('Locked In')).toHaveLength(1);
  });

  it('reflects canonical operational state immediately without calling reload', () => {
    const value = workspaceValue();
    workspace.value = value;
    const view = renderHomeOverview();

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

    view.rerender(
      <PhoneLayoutProvider>
        <HomeOverview />
      </PhoneLayoutProvider>
    );

    expect(screen.getAllByText('Portage')).toHaveLength(1);
    expect(screen.getByText('Rain watch')).toBeTruthy();
    expect(screen.queryByText('Wind advisory')).toBeNull();
    expect(screen.getAllByText('88%').length).toBeGreaterThan(0);
    expect(value.reload).not.toHaveBeenCalled();
  });
});
