// @vitest-environment jsdom

import React, { useState } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Alert,
  CrewMember,
  DashboardData,
  GearItem,
  OfflineStatus,
  PrepFeedItem,
  ThemeMode,
  ThemeOverride,
  ThemeVariant,
  TimelineEvent,
  TripMemberRole,
} from '@/types';

const mocks = vi.hoisted(() => ({
  trip: {
    tripId: 'trip-1',
    role: 'owner' as TripMemberRole | null,
    canEdit: true,
    isOwner: true,
    isLoading: false,
    error: null as string | null,
  },
  user: {
    email: 'owner@example.com',
    user_metadata: { full_name: 'Test Owner' },
  },
  fetchDashboardData: vi.fn(),
  createGearItem: vi.fn(),
  createTimelineEvent: vi.fn(),
  createCrewMember: vi.fn(),
  createAlert: vi.fn(),
  updateOfflineStatus: vi.fn(),
  toggleGearAcquired: vi.fn(),
  toggleGearPacked: vi.fn(),
}));

vi.mock('@/lib/tripContext', () => ({
  useTrip: () => mocks.trip,
}));

vi.mock('@/lib/authContext', () => ({
  useAuth: () => ({
    user: mocks.user,
    isLoading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('@/lib/fetchDashboard', () => ({
  fetchDashboardData: mocks.fetchDashboardData,
}));

vi.mock('@/lib/dashboardMapper', () => ({
  parsePrepFeedItem: (value: unknown) => value,
  readApiError: () => null,
  readApiItem: (value: unknown) =>
    (value as { data?: unknown })?.data ?? value,
  toAlert: (value: unknown) => value,
  toCrewMember: (value: unknown) => value,
  toGearItem: (value: unknown) => value,
  toMeal: (value: unknown) => value,
  toOfflineStatus: (value: unknown) => value,
  toParkIntel: (value: unknown) => value,
  toTimelineEvent: (value: unknown) => value,
  toTripDashboard: (value: unknown) => value,
}));

vi.mock('@/lib/mutations', () => ({
  createAlert: mocks.createAlert,
  createCrewMember: mocks.createCrewMember,
  createGearItem: mocks.createGearItem,
  createMeal: vi.fn(),
  createTimelineEvent: mocks.createTimelineEvent,
  deleteAlert: vi.fn(),
  deleteCrewMember: vi.fn(),
  deleteGearItem: vi.fn(),
  deleteMeal: vi.fn(),
  deleteTimelineEvent: vi.fn(),
  dismissAlert: vi.fn(),
  toggleGearAcquired: mocks.toggleGearAcquired,
  toggleGearPacked: mocks.toggleGearPacked,
  updateCrewMember: vi.fn(),
  updateGearItem: vi.fn(),
  updateMeal: vi.fn(),
  updateOfflineStatus: mocks.updateOfflineStatus,
  updateParkIntel: vi.fn(),
  updateTimelineEvent: vi.fn(),
  updateTripCampsite: vi.fn(),
}));

import {
  TripWorkspaceProvider,
  useTripWorkspace,
} from './TripWorkspaceProvider';
import { useTheme } from '@/lib/themeContext';

function gearItem(overrides: Partial<GearItem> = {}): GearItem {
  return {
    id: 'gear-1',
    trip_id: 'trip-1',
    name: 'Tent',
    category: 'Shelter',
    acquired: false,
    packed: false,
    owner: '',
    priority: 'critical',
    notes: '',
    weight_kg: 2,
    ...overrides,
  } as GearItem;
}

function dashboardData(
  overrides: {
    gear?: GearItem[];
    themeVariant?: ThemeVariant;
    themeOverride?: ThemeOverride;
  } = {}
): DashboardData {
  return {
    trip: {
      id: 'trip-1',
      name: 'Algonquin',
      park_name: 'Algonquin Park',
      lake_name: 'Maple Lake',
      site_name: 'Site 4',
      start_date: '2026-08-01',
      end_date: '2026-08-03',
      map_style: null,
      theme_mode: null,
    },
    currentWeather: null,
    forecast: [],
    weatherRefresh: null,
    gear: overrides.gear ?? [gearItem()],
    timeline: [
      {
        id: 'event-1',
        trip_id: 'trip-1',
        day_number: 2,
        event_time: '08:30',
        title: 'Launch',
        details: '',
        sort_order: 20,
        phase: null,
      },
    ],
    meals: [],
    crew: [],
    parkIntel: null,
    offlineStatus: null,
    astro: null,
    alerts: [],
    alertRefresh: null,
    prepFeed: [],
    settings: {
      trip_id: 'trip-1',
      manual_theme_override: overrides.themeOverride ?? 'day',
      preferred_units: 'metric',
      show_astro: false,
      show_crew: false,
      show_meals: false,
      show_offline: false,
      theme_variant: overrides.themeVariant ?? 'expedition',
    },
  } as unknown as DashboardData;
}

function WorkspaceProbe() {
  const workspace = useTripWorkspace();
  const [, forceChildRender] = useState(0);
  return (
    <div>
      <span data-testid="loading">{String(workspace.isLoading)}</span>
      <span data-testid="name">{workspace.trip?.name ?? ''}</span>
      <span data-testid="gear-count">{workspace.gear.length}</span>
      <span data-testid="gear-readiness">
        {workspace.readinessCategories.gear}
      </span>
      <span data-testid="overall">{workspace.readiness?.overall ?? ''}</span>
      <span data-testid="role">{workspace.permissions.role ?? ''}</span>
      <span data-testid="owner">{String(workspace.permissions.isOwner)}</span>
      <span data-testid="editable">
        {workspace.editableActions ? 'yes' : 'no'}
      </span>
      <span data-testid="error">{workspace.error ?? ''}</span>
      <button onClick={() => forceChildRender((current) => current + 1)}>
        Child rerender
      </button>
      <button onClick={() => workspace.reload()}>Reload</button>
      <button
        disabled={!workspace.editableActions}
        onClick={() =>
          workspace.editableActions?.addGearItem({
            name: 'Paddle',
            category: 'Gear',
            acquired: false,
            packed: false,
            owner: '',
            priority: 'high',
            notes: '',
            weight_kg: 1,
          } as Omit<GearItem, 'id' | 'trip_id'>)
        }
      >
        Add gear
      </button>
    </div>
  );
}

function ThemeProbe() {
  const { themeVariant, themeMode } = useTheme();
  return (
    <span data-testid="theme">
      {themeVariant}:{themeMode}
    </span>
  );
}

function CrossRouteStateProbe() {
  const workspace = useTripWorkspace();
  const [route, setRoute] = useState('gear');

  return (
    <div>
      <span data-testid="route">{route}</span>
      <span data-testid="shared-gear-count">{workspace.gear.length}</span>
      <span data-testid="shared-timeline-count">{workspace.timeline.length}</span>
      <span data-testid="shared-crew-count">{workspace.crew.length}</span>
      <span data-testid="shared-alert-count">{workspace.alerts.length}</span>
      <span data-testid="shared-offline">
        {String(workspace.offlineStatus?.maps_cached ?? false)}
      </span>
      <span data-testid="shared-prep-count">{workspace.prepFeed.length}</span>

      <button
        onClick={() =>
          workspace.editableActions?.addGearItem({
            name: 'Paddle',
            category: 'Gear',
          } as Omit<GearItem, 'id' | 'trip_id'>)
        }
      >
        Route add gear
      </button>
      <button
        onClick={() =>
          workspace.editableActions?.addTimelineEvent({
            day_number: 1,
            event_time: '09:00',
            title: 'Portage',
            details: '',
            sort_order: 30,
            phase: null,
          } as Omit<TimelineEvent, 'id' | 'trip_id'>)
        }
      >
        Route add timeline
      </button>
      <button
        onClick={() =>
          workspace.editableActions?.addCrewMember({
            name: 'Jordan',
            role: 'Paddler',
          } as Omit<CrewMember, 'id' | 'trip_id'>)
        }
      >
        Route add crew
      </button>
      <button
        onClick={() =>
          workspace.editableActions?.addAlert({
            title: 'Wind advisory',
            body: 'Strong gusts',
            severity: 'warning',
            source: 'manual',
            is_active: true,
          })
        }
      >
        Route add alert
      </button>
      <button
        onClick={() => workspace.editableActions?.toggleOfflineStatus('maps_cached')}
      >
        Route toggle offline
      </button>
      <button
        onClick={() =>
          workspace.editableActions?.addPrepFeedItem({
            file: new File(['photo'], 'prep.jpg', { type: 'image/jpeg' }),
            caption: 'Packed canoe',
            category: 'Gear',
            uploaded_by: 'Test Owner',
          })
        }
      >
        Route add prep
      </button>
      <button
        onClick={() =>
          workspace.prepFeed[0] &&
          workspace.editableActions?.deletePrepFeedItem(workspace.prepFeed[0].id)
        }
      >
        Route delete prep
      </button>
      <button onClick={() => setRoute('home')}>Navigate Home</button>
    </div>
  );
}

function renderProvider(child: React.ReactNode = <WorkspaceProbe />) {
  return render(
    <TripWorkspaceProvider>
      {child}
    </TripWorkspaceProvider>
  );
}

beforeEach(() => {
  mocks.trip.tripId = 'trip-1';
  mocks.trip.role = 'owner';
  mocks.trip.canEdit = true;
  mocks.trip.isOwner = true;
  mocks.trip.isLoading = false;
  mocks.trip.error = null;
  mocks.fetchDashboardData.mockReset();
  mocks.createGearItem.mockReset();
  mocks.createTimelineEvent.mockReset();
  mocks.createCrewMember.mockReset();
  mocks.createAlert.mockReset();
  mocks.updateOfflineStatus.mockReset();
  mocks.toggleGearAcquired.mockReset();
  mocks.toggleGearPacked.mockReset();
  document.documentElement.classList.remove(
    'theme-expedition',
    'theme-clean',
    'dark'
  );
});

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove(
    'theme-expedition',
    'theme-clean',
    'dark'
  );
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TripWorkspaceProvider loading and state', () => {
  it('waits for membership, then loads once despite child rerenders', async () => {
    mocks.trip.isLoading = true;
    mocks.fetchDashboardData.mockResolvedValue(dashboardData());
    const view = renderProvider();

    expect(mocks.fetchDashboardData).not.toHaveBeenCalled();

    mocks.trip.isLoading = false;
    view.rerender(
      <TripWorkspaceProvider>
        <WorkspaceProbe />
      </TripWorkspaceProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('name').textContent).toContain('Algonquin')
    );
    expect(mocks.fetchDashboardData).toHaveBeenCalledTimes(1);
    expect(mocks.fetchDashboardData).toHaveBeenCalledWith('trip-1');

    fireEvent.click(screen.getByRole('button', { name: 'Child rerender' }));
    expect(mocks.fetchDashboardData).toHaveBeenCalledTimes(1);
  });

  it('exposes loaded data and category and overall readiness', async () => {
    mocks.fetchDashboardData.mockResolvedValue(
      dashboardData({ gear: [gearItem({ acquired: true })] })
    );
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId('gear-readiness').textContent).toContain('100')
    );
    expect(screen.getByTestId('gear-count').textContent).toContain('1');
    expect(Number(screen.getByTestId('overall').textContent)).toBeGreaterThan(0);
  });

  it('reconciles successful editable mutations into workspace state', async () => {
    mocks.fetchDashboardData.mockResolvedValue(dashboardData({ gear: [] }));
    mocks.createGearItem.mockResolvedValue({
      data: gearItem({ id: 'gear-2', name: 'Paddle' }),
      error: null,
    });
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toContain('false')
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add gear' }));

    await waitFor(() =>
      expect(screen.getByTestId('gear-count').textContent).toContain('1')
    );
    expect(mocks.createGearItem).toHaveBeenCalledTimes(1);
  });

  it('reloads canonical data in place without browser navigation', async () => {
    mocks.fetchDashboardData
      .mockResolvedValueOnce(dashboardData({ gear: [] }))
      .mockResolvedValueOnce(
        dashboardData({ gear: [gearItem({ id: 'gear-2' })] })
      );
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId('gear-count').textContent).toContain('0')
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    await waitFor(() =>
      expect(screen.getByTestId('gear-count').textContent).toContain('1')
    );
    expect(mocks.fetchDashboardData).toHaveBeenCalledTimes(2);
  });

  it('preserves every section mutation when navigating back Home without refetching', async () => {
    const offlineStatus = {
      trip_id: 'trip-1',
      maps_cached: false,
      updated_at: '',
    } as OfflineStatus;
    const loaded = dashboardData({ gear: [] });
    loaded.timeline = [];
    loaded.crew = [];
    loaded.alerts = [];
    loaded.offlineStatus = offlineStatus;
    loaded.prepFeed = [];
    mocks.fetchDashboardData.mockResolvedValue(loaded);

    mocks.createGearItem.mockResolvedValue({
      data: gearItem({ id: 'gear-2', name: 'Paddle' }),
      error: null,
    });
    mocks.createTimelineEvent.mockResolvedValue({
      data: {
        id: 'timeline-2',
        trip_id: 'trip-1',
        day_number: 1,
        event_time: '09:00',
        title: 'Portage',
        details: '',
        sort_order: 30,
        phase: null,
      } as TimelineEvent,
      error: null,
    });
    mocks.createCrewMember.mockResolvedValue({
      data: {
        id: 'crew-2',
        trip_id: 'trip-1',
        name: 'Jordan',
        role: 'Paddler',
      } as CrewMember,
      error: null,
    });
    mocks.createAlert.mockResolvedValue({
      data: {
        id: 'alert-2',
        trip_id: 'trip-1',
        title: 'Wind advisory',
        body: 'Strong gusts',
        severity: 'warning',
        source: 'manual',
        is_active: true,
      } as Alert,
      error: null,
    });
    mocks.updateOfflineStatus.mockResolvedValue({
      data: { ...offlineStatus, maps_cached: true },
      error: null,
    });

    const prepItem = {
      id: 'prep-2',
      trip_id: 'trip-1',
      caption: 'Packed canoe',
      category: 'Gear',
      uploaded_by: 'Test Owner',
      image_url: '/prep.jpg',
      created_at: '2026-07-27T12:00:00Z',
    } as PrepFeedItem;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => ({
        ok: true,
        json: async () => (init?.method === 'POST' ? { data: prepItem } : {}),
      }))
    );

    renderProvider(<CrossRouteStateProbe />);
    await waitFor(() => expect(mocks.fetchDashboardData).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Route add gear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Route add timeline' }));
    fireEvent.click(screen.getByRole('button', { name: 'Route add crew' }));
    fireEvent.click(screen.getByRole('button', { name: 'Route add alert' }));
    fireEvent.click(screen.getByRole('button', { name: 'Route toggle offline' }));
    fireEvent.click(screen.getByRole('button', { name: 'Route add prep' }));

    await waitFor(() => {
      expect(screen.getByTestId('shared-gear-count').textContent).toBe('1');
      expect(screen.getByTestId('shared-timeline-count').textContent).toBe('1');
      expect(screen.getByTestId('shared-crew-count').textContent).toBe('1');
      expect(screen.getByTestId('shared-alert-count').textContent).toBe('1');
      expect(screen.getByTestId('shared-offline').textContent).toBe('true');
      expect(screen.getByTestId('shared-prep-count').textContent).toBe('1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Route delete prep' }));
    await waitFor(() =>
      expect(screen.getByTestId('shared-prep-count').textContent).toBe('0')
    );

    fireEvent.click(screen.getByRole('button', { name: 'Navigate Home' }));
    expect(screen.getByTestId('route').textContent).toBe('home');
    expect(screen.getByTestId('shared-gear-count').textContent).toBe('1');
    expect(screen.getByTestId('shared-timeline-count').textContent).toBe('1');
    expect(screen.getByTestId('shared-crew-count').textContent).toBe('1');
    expect(screen.getByTestId('shared-alert-count').textContent).toBe('1');
    expect(screen.getByTestId('shared-offline').textContent).toBe('true');
    expect(screen.getByTestId('shared-prep-count').textContent).toBe('0');
    expect(mocks.fetchDashboardData).toHaveBeenCalledTimes(1);
  });

  it('exposes a sanitized controlled load failure message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.fetchDashboardData.mockRejectedValue(
      new Error('[fetchDashboard] Failed to fetch trip details: denied')
    );
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId('error').textContent).toContain(
        'We could not load this trip workspace. Please try again.'
      )
    );
    expect(screen.getByTestId('error').textContent).not.toContain('denied');
  });
});

describe('TripWorkspaceProvider permissions', () => {
  it.each([
    ['owner', true, true, 'yes'],
    ['editor', true, false, 'yes'],
    ['viewer', false, false, 'no'],
  ] as const)(
    'preserves the %s permission surface',
    async (role, canEdit, isOwner, editable) => {
      mocks.trip.role = role;
      mocks.trip.canEdit = canEdit;
      mocks.trip.isOwner = isOwner;
      mocks.fetchDashboardData.mockResolvedValue(dashboardData());
      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId('role').textContent).toContain(role)
      );
      expect(screen.getByTestId('owner').textContent).toContain(String(isOwner));
      expect(screen.getByTestId('editable').textContent).toContain(editable);
    }
  );
});

describe('TripWorkspaceProvider theme ownership', () => {
  it.each([
    ['expedition', 'day'],
    ['expedition', 'night'],
    ['clean', 'day'],
    ['clean', 'night'],
  ] as const)(
    'applies %s %s above trip content',
    async (themeVariant: ThemeVariant, themeMode: ThemeMode) => {
      mocks.fetchDashboardData.mockResolvedValue(
        dashboardData({
          themeVariant,
          themeOverride: themeMode,
        })
      );
      renderProvider(<ThemeProbe />);

      await waitFor(() =>
        expect(screen.getByTestId('theme').textContent).toContain(
          `${themeVariant}:${themeMode}`
        )
      );
      expect(
        document.documentElement.classList.contains(`theme-${themeVariant}`)
      ).toBe(true);
      if (themeMode === 'night') {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      } else {
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      }
    }
  );
});
