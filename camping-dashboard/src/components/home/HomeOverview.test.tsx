// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Alert,
  CrewMember,
  GearItem,
  OfflineStatus,
  PrepFeedItem,
  TimelineEvent,
} from '@/types';
import type { TripWorkspaceValue } from '@/components/trip/TripWorkspaceProvider';

const workspace = vi.hoisted(() => ({
  value: null as TripWorkspaceValue | null,
}));

vi.mock('@/components/trip/TripWorkspaceProvider', () => ({
  useTripWorkspace: () => workspace.value,
}));
vi.mock('@/lib/themeContext', () => ({
  useTheme: () => ({ themeMode: 'day' }),
}));
vi.mock('@/components/cards/HeroHeader', () => ({
  default: () => (
    <header>
      <h1>Maple Lake Weekend</h1>
      <span>Hero Header</span>
    </header>
  ),
}));
vi.mock('@/components/cards/MapRouteCard', () => ({
  default: ({ onSaveLocation }: { onSaveLocation?: unknown }) => (
    <div data-testid="map" data-editable={String(Boolean(onSaveLocation))}>
      Map Card
    </div>
  ),
}));
vi.mock('@/components/cards/WeatherCard', () => ({
  default: () => <div data-testid="weather">Weather Card</div>,
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

function workspaceValue(editable = true): TripWorkspaceValue {
  return {
    data: {
      currentWeather: null,
      weatherRefresh: null,
      forecast: [],
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
    readiness: {
      overall: 62,
      label: 'Needs Attention',
      gear: 50,
      meals: 100,
      weather: 80,
      offline: 17,
      timeline: 50,
    },
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
  vi.useRealTimers();
});

describe('HomeOverview', () => {
  it('renders the focused Home hierarchy without legacy full modules', () => {
    render(<HomeOverview />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Hero Header')).toBeTruthy();
    expect(screen.getByTestId('map')).toBeTruthy();
    expect(screen.getByTestId('weather')).toBeTruthy();
    expect(screen.getByText('Forecast unavailable.')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Overall trip readiness' })).toBeTruthy();
    expect(screen.getByText('Today · Day 1')).toBeTruthy();
    expect(screen.getByText('Wind advisory')).toBeTruthy();
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

    for (const label of ['Plan', 'Gear', 'Crew', 'Field Guide', 'Field Log']) {
      expect(screen.getByRole('link', { name: `Open ${label}` })).toBeTruthy();
    }
    expect(screen.getByRole('link', { name: 'Open Plan' }).getAttribute('href')).toBe(
      '/trips/trip-1/plan'
    );
    expect(screen.getByRole('link', { name: 'Open Gear' }).getAttribute('href')).toBe(
      '/trips/trip-1/gear'
    );
    expect(
      screen.getByRole('link', { name: 'Open Field Guide' }).getAttribute('href')
    ).toBe('/trips/trip-1/guide');
  });

  it('keeps viewer Home readable and the retained map read-only', () => {
    workspace.value = workspaceValue(false);
    render(<HomeOverview />);

    expect(screen.getByTestId('map').getAttribute('data-editable')).toBe('false');
    expect(screen.getByRole('link', { name: 'Open Gear' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /add|edit|delete/i })).toBeNull();
  });

  it('renders hidden and empty summary combinations without losing navigation', () => {
    const value = workspaceValue();
    value.data!.settings.show_meals = false;
    value.data!.settings.show_crew = false;
    value.data!.settings.show_offline = false;
    value.data!.settings.show_astro = false;
    value.alerts = [];
    workspace.value = value;
    render(<HomeOverview />);

    expect(screen.getByText('0/0 packed')).toBeTruthy();
    expect(screen.getByText('Hidden for this trip')).toBeTruthy();
    expect(screen.getByText('No preparation photos yet')).toBeTruthy();
    expect(screen.getByText('No active notices')).toBeTruthy();
    expect(screen.queryByText(/meals$/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Open Crew' })).toBeTruthy();
  });

  it('links an empty schedule to Plan and exposes complete readiness accessibly', () => {
    const value = workspaceValue();
    value.timeline = [];
    value.readiness = {
      ...value.readiness!,
      overall: 100,
      label: 'Locked In',
      gear: 100,
      meals: 100,
      weather: 100,
      offline: 100,
      timeline: 100,
    };
    workspace.value = value;
    render(<HomeOverview />);

    expect(screen.getByText('No events are planned for this day yet.')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Open Plan' })).toHaveLength(2);
    expect(
      screen.getByRole('progressbar', { name: 'Overall trip readiness' }).getAttribute(
        'aria-valuenow'
      )
    ).toBe('100');
    expect(screen.getByText('Locked In')).toBeTruthy();
  });

  it('reflects canonical section state immediately without calling reload', () => {
    const value = workspaceValue();
    workspace.value = value;
    const view = render(<HomeOverview />);

    value.gear = [
      {
        id: 'gear-1',
        acquired: true,
        packed: true,
        priority: 'critical',
      } as GearItem,
    ];
    value.timeline = [
      timelineEvent({ id: 'event-2', title: 'Portage', event_time: '10:30' }),
    ];
    value.crew = [
      { id: 'crew-1', name: 'Jordan', role: 'Paddler', load_weight_kg: 12.5 } as CrewMember,
    ];
    value.alerts = [
      activeAlert({ id: 'dismissed', severity: 'critical', dismissed_at: '2026-07-27T13:00:00Z' }),
      activeAlert({ id: 'watch', title: 'Rain watch', severity: 'watch' }),
    ];
    value.offlineStatus = {
      trip_id: 'trip-1',
      maps_cached: true,
    } as OfflineStatus;
    value.prepFeed = [
      {
        id: 'prep-1',
        trip_id: 'trip-1',
        category: 'Gear',
        caption: 'Canoe packed',
        uploaded_by: 'Jordan',
        created_at: '2026-07-27T13:00:00Z',
      } as PrepFeedItem,
    ];
    value.readiness = {
      ...value.readiness!,
      overall: 88,
      label: 'Nearly Ready',
      gear: 100,
      offline: 67,
    };

    view.rerender(<HomeOverview />);

    expect(screen.getByText('1/1 packed')).toBeTruthy();
    expect(screen.getByText('Portage')).toBeTruthy();
    expect(screen.getByText('1 member')).toBeTruthy();
    expect(screen.getByText('Rain watch')).toBeTruthy();
    expect(screen.queryByText('Wind advisory')).toBeNull();
    expect(screen.getByText('Offline checklist started')).toBeTruthy();
    expect(screen.getByText('Canoe packed')).toBeTruthy();
    expect(screen.getByText('88%')).toBeTruthy();
    expect(value.reload).not.toHaveBeenCalled();
  });
});
