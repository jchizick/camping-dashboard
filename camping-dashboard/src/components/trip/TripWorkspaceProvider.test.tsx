// @vitest-environment jsdom

import React, { useEffect, useRef, useState } from 'react';
import {
  act,
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
  Meal,
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
    verificationSource: 'online' as 'online' | 'cache' | null,
    cachedWorkspace: null as unknown,
    revalidateAccess: vi.fn(),
  },
  user: {
    id: 'user-1',
    email: 'owner@example.com',
    user_metadata: { full_name: 'Test Owner' },
  },
  loadOnlineTrip: vi.fn(),
  readOfflineTrip: vi.fn(),
  markShellPrepared: vi.fn(),
  clearCachedTrip: vi.fn(),
  prepareOfflineShell: vi.fn(),
  fetchDashboardData: vi.fn(),
  createGearItem: vi.fn(),
  createTimelineEvent: vi.fn(),
  createCrewMember: vi.fn(),
  deleteCrewMember: vi.fn(),
  createAlert: vi.fn(),
  updateOfflineStatus: vi.fn(),
  toggleGearAcquired: vi.fn(),
  toggleGearPacked: vi.fn(),
  updateTripDetails: vi.fn(),
  updateThemeVariant: vi.fn(),
}));

vi.mock('@/lib/tripContext', () => ({
  useTrip: () => mocks.trip,
}));

vi.mock('@/lib/authContext', () => ({
  useAuth: () => ({
    user: mocks.user,
    identity: { userId: mocks.user.id, source: 'online' as const },
    isLoading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('@/lib/tripRepository', () => ({
  tripRepository: {
    loadOnlineTrip: mocks.loadOnlineTrip,
    readOfflineTrip: mocks.readOfflineTrip,
    markShellPrepared: mocks.markShellPrepared,
    clearCachedTrip: mocks.clearCachedTrip,
  },
}));

vi.mock('@/lib/offlineShell', () => ({
  prepareOfflineShell: mocks.prepareOfflineShell,
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
  toSettings: (value: unknown) => value,
}));

vi.mock('@/lib/mutations', () => ({
  createAlert: mocks.createAlert,
  createCrewMember: mocks.createCrewMember,
  createGearItem: mocks.createGearItem,
  createMeal: vi.fn(),
  createTimelineEvent: mocks.createTimelineEvent,
  deleteAlert: vi.fn(),
  deleteCrewMember: mocks.deleteCrewMember,
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
  updateTripDetails: mocks.updateTripDetails,
  updateThemeVariant: mocks.updateThemeVariant,
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
      <span data-testid="trip-days">{workspace.tripDays}</span>
      <span data-testid="gear-readiness">
        {workspace.readiness?.categories.gear.score ?? ''}
      </span>
      <span data-testid="overall">{workspace.readiness?.score ?? ''}</span>
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

function StaleMutationProbe() {
  const workspace = useTripWorkspace();
  const capturedActions = useRef(workspace.editableActions);
  const [result, setResult] = useState('idle');

  useEffect(() => {
    if (workspace.editableActions && !capturedActions.current) {
      capturedActions.current = workspace.editableActions;
    }
  }, [workspace.editableActions]);

  return (
    <div>
      <span data-testid="mutation-trip">{workspace.trip?.name ?? ''}</span>
      <span data-testid="mutation-source">{workspace.source}</span>
      <span data-testid="mutation-capability">
        {workspace.canMutateWorkspace ? 'enabled' : 'disabled'}
      </span>
      <span data-testid="mutation-result">{result}</span>
      <button
        type="button"
        onClick={() => {
          void capturedActions.current?.addGearItem({
            name: 'Paddle',
            category: 'Gear',
            acquired: false,
            packed: false,
            owner: '',
            priority: 'high',
            notes: '',
            weight_kg: 1,
          } as Omit<GearItem, 'id' | 'trip_id'>).then(
            () => setResult('mutated'),
            (error: unknown) =>
              setResult(error instanceof Error ? error.message : 'rejected')
          );
        }}
      >
        Invoke captured action
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

function TripDetailsProbe() {
  const workspace = useTripWorkspace();
  return (
    <div>
      <span data-testid="trip-location">{workspace.trip?.lake_name}</span>
      <span data-testid="data-location">{workspace.data?.trip.lake_name}</span>
      <span data-testid="details-days">{workspace.tripDays}</span>
      <button
        type="button"
        onClick={() => workspace.editableActions?.updateTripDetails({
          park_name: 'Algonquin Park',
          lake_name: 'Opeongo Lake',
          site_name: 'Site 7',
          start_date: '2026-08-01',
          end_date: '2026-08-05',
        })}
      >
        Save trip details
      </button>
      <button
        type="button"
        onClick={() => workspace.editableActions?.updateTripDetails({
          park_name: 'Algonquin Park',
          lake_name: 'Maple Lake',
          site_name: 'Site 4',
          start_date: '2026-08-01',
          end_date: '2026-08-01',
        }).catch(() => undefined)}
      >
        Shorten trip unsafely
      </button>
    </div>
  );
}

function ThemeActionProbe() {
  const workspace = useTripWorkspace();
  const { themeVariant } = useTheme();
  const [error, setError] = useState('');

  return (
    <div>
      <span data-testid="theme-action">
        {themeVariant}:{workspace.data?.settings.theme_variant}
      </span>
      {error ? <span role="alert">{error}</span> : null}
      <button
        type="button"
        onClick={() =>
          workspace.editableActions
            ?.updateThemeVariant('clean')
            .catch((reason: unknown) =>
              setError(reason instanceof Error ? reason.message : 'Save failed')
            )
        }
      >
        Use Clean
      </button>
    </div>
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

function FieldPrepInitializationProbe() {
  const workspace = useTripWorkspace();
  return (
    <div>
      <span data-testid="field-prep-record">
        {workspace.offlineStatus ? 'present' : 'missing'}
      </span>
      <button
        type="button"
        onClick={() => workspace.editableActions?.initializeFieldPrep()}
      >
        Initialize Field Prep
      </button>
    </div>
  );
}

function CrewDeleteStateProbe() {
  const workspace = useTripWorkspace();
  return (
    <div>
      <span data-testid="crew-delete-count">{workspace.crew.length}</span>
      <span data-testid="gear-responsible">{workspace.gear[0]?.responsible_crew_member_id ?? 'none'}</span>
      <span data-testid="meal-prep-lead">{workspace.meals[0]?.prep_crew_member_id ?? 'none'}</span>
      <button type="button" onClick={() => workspace.editableActions?.deleteCrewMember('crew-1')}>
        Delete responsible crew
      </button>
    </div>
  );
}

beforeEach(() => {
  mocks.trip.tripId = 'trip-1';
  mocks.trip.role = 'owner';
  mocks.trip.canEdit = true;
  mocks.trip.isOwner = true;
  mocks.trip.isLoading = false;
  mocks.trip.error = null;
  mocks.trip.verificationSource = 'online';
  mocks.trip.cachedWorkspace = null;
  mocks.trip.revalidateAccess.mockReset();
  mocks.trip.revalidateAccess.mockResolvedValue('online');
  mocks.loadOnlineTrip.mockReset();
  mocks.readOfflineTrip.mockReset();
  mocks.readOfflineTrip.mockResolvedValue({
    status: 'no-snapshot',
    identity: null,
    workspace: null,
  });
  mocks.markShellPrepared.mockReset();
  mocks.markShellPrepared.mockResolvedValue(undefined);
  mocks.clearCachedTrip.mockReset();
  mocks.clearCachedTrip.mockResolvedValue(undefined);
  mocks.prepareOfflineShell.mockReset();
  mocks.prepareOfflineShell.mockResolvedValue(false);
  mocks.fetchDashboardData.mockReset();
  mocks.loadOnlineTrip.mockImplementation(async ({ tripId }) => ({
    source: 'online',
    data: await mocks.fetchDashboardData(tripId),
    cachedAt: '2026-08-24T12:00:00.000Z',
    lastOnlineVerifiedAt: '2026-08-24T12:00:00.000Z',
    verifiedRole: mocks.trip.role,
    snapshotRevision: 'test-revision',
    cacheWriteOutcome: 'stored',
  }));
  mocks.createGearItem.mockReset();
  mocks.createTimelineEvent.mockReset();
  mocks.createCrewMember.mockReset();
  mocks.deleteCrewMember.mockReset();
  mocks.createAlert.mockReset();
  mocks.updateOfflineStatus.mockReset();
  mocks.toggleGearAcquired.mockReset();
  mocks.toggleGearPacked.mockReset();
  mocks.updateTripDetails.mockReset();
  mocks.updateThemeVariant.mockReset();
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
  it('initializes the existing Field Prep record without completing any checks', async () => {
    const loaded = dashboardData({ gear: [] });
    loaded.offlineStatus = null;
    mocks.fetchDashboardData.mockResolvedValue(loaded);
    mocks.updateOfflineStatus.mockResolvedValue({
      data: {
        trip_id: 'trip-1',
        maps_cached: false,
        permit_saved: false,
        daily_vehicle_permit_saved: false,
        route_downloaded: false,
        satellite_device_connected: false,
        satellite_device_name: '',
        emergency_contact_ready: false,
        updated_at: '2026-08-25T12:00:00Z',
      },
      error: null,
    });

    renderProvider(<FieldPrepInitializationProbe />);
    await waitFor(() => expect(screen.getByTestId('field-prep-record').textContent).toBe('missing'));

    fireEvent.click(screen.getByRole('button', { name: 'Initialize Field Prep' }));

    await waitFor(() => expect(screen.getByTestId('field-prep-record').textContent).toBe('present'));
    expect(mocks.updateOfflineStatus).toHaveBeenCalledWith('trip-1', {});
  });

  it('keeps Gear and Meals while clearing deleted Crew relationship IDs in shared state', async () => {
    const loaded = dashboardData({
      gear: [gearItem({ responsible_crew_member_id: 'crew-1' })],
    });
    loaded.crew = [{
      id: 'crew-1', trip_id: 'trip-1', trip_member_id: null, name: 'Jordan',
      role: 'Lead', load_item: '', load_weight_kg: 0, canoe_number: 1, notes: '',
    }];
    loaded.meals = [{
      id: 'meal-1', trip_id: 'trip-1', day_number: 1, meal_type: 'dinner',
      title: 'Chili', prep_type: 'fresh', calories: 600, assigned_to: null,
      prep_crew_member_id: 'crew-1', notes: '',
    } satisfies Meal];
    mocks.fetchDashboardData.mockResolvedValue(loaded);
    mocks.deleteCrewMember.mockResolvedValue({ error: null });

    renderProvider(<CrewDeleteStateProbe />);
    await waitFor(() => expect(screen.getByTestId('crew-delete-count').textContent).toBe('1'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete responsible crew' }));

    await waitFor(() => {
      expect(screen.getByTestId('crew-delete-count').textContent).toBe('0');
      expect(screen.getByTestId('gear-responsible').textContent).toBe('none');
      expect(screen.getByTestId('meal-prep-lead').textContent).toBe('none');
    });
    expect(mocks.deleteCrewMember).toHaveBeenCalledWith('crew-1');
  });

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
    expect(mocks.loadOnlineTrip).toHaveBeenCalledWith({
      tripId: 'trip-1',
      userId: 'user-1',
      verifiedRole: 'owner',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Child rerender' }));
    expect(mocks.fetchDashboardData).toHaveBeenCalledTimes(1);
  });

  it('exposes loaded data and category and overall readiness', async () => {
    mocks.fetchDashboardData.mockResolvedValue(
      dashboardData({ gear: [gearItem({ acquired: true, packed: true })] })
    );
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId('gear-readiness').textContent).toContain('100')
    );
    expect(screen.getByTestId('gear-count').textContent).toContain('1');
    expect(screen.getByTestId('trip-days').textContent).toBe('3');
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

  it('blocks a captured mutation action after the workspace becomes read-only', async () => {
    mocks.fetchDashboardData.mockResolvedValue(dashboardData());
    mocks.createGearItem.mockResolvedValue({
      data: gearItem({ id: 'gear-stale' }),
      error: null,
    });

    renderProvider(<StaleMutationProbe />);
    await waitFor(() => {
      expect(screen.getByTestId('mutation-trip').textContent).toContain('Algonquin');
      expect(screen.getByTestId('mutation-capability').textContent).toBe('enabled');
    });

    act(() => window.dispatchEvent(new Event('offline')));
    await waitFor(() => {
      expect(screen.getByTestId('mutation-source').textContent).toBe('cache');
      expect(screen.getByTestId('mutation-capability').textContent).toBe('disabled');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Invoke captured action' }));
    await waitFor(() =>
      expect(screen.getByTestId('mutation-result').textContent).toContain('read-only')
    );
    expect(mocks.createGearItem).not.toHaveBeenCalled();
  });

  it('does not restore mutation capability when an online load resolves after signal loss', async () => {
    let resolveLoad!: (value: DashboardData) => void;
    mocks.fetchDashboardData.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      })
    );

    renderProvider(<StaleMutationProbe />);
    await waitFor(() => expect(mocks.fetchDashboardData).toHaveBeenCalledOnce());

    act(() => window.dispatchEvent(new Event('offline')));
    await act(async () => resolveLoad(dashboardData()));

    await waitFor(() =>
      expect(screen.getByTestId('mutation-trip').textContent).toContain('Algonquin')
    );
    expect(screen.getByTestId('mutation-source').textContent).toBe('cache');
    expect(screen.getByTestId('mutation-capability').textContent).toBe('disabled');
  });

  it('coalesces repeated reconnect signals into one access revalidation', async () => {
    mocks.fetchDashboardData.mockResolvedValue(dashboardData());
    let resolveAccess!: (value: 'online') => void;
    mocks.trip.revalidateAccess.mockReturnValue(
      new Promise((resolve) => {
        resolveAccess = resolve;
      })
    );

    renderProvider(<StaleMutationProbe />);
    await waitFor(() =>
      expect(screen.getByTestId('mutation-trip').textContent).toContain('Algonquin')
    );
    act(() => window.dispatchEvent(new Event('offline')));
    await waitFor(() =>
      expect(screen.getByTestId('mutation-source').textContent).toBe('cache')
    );

    act(() => {
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(mocks.trip.revalidateAccess).toHaveBeenCalledOnce());

    await act(async () => resolveAccess('online'));
  });

  it('updates canonical trip details and duration without orphaning later plans', async () => {
    mocks.fetchDashboardData.mockResolvedValue(dashboardData());
    mocks.updateTripDetails.mockResolvedValue({
      data: {
        ...dashboardData().trip,
        lake_name: 'Opeongo Lake',
        site_name: 'Site 7',
        end_date: '2026-08-05',
      },
      error: null,
    });
    renderProvider(<TripDetailsProbe />);

    await waitFor(() =>
      expect(screen.getByTestId('trip-location').textContent).toBe('Maple Lake')
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save trip details' }));

    await waitFor(() => {
      expect(screen.getByTestId('trip-location').textContent).toBe('Opeongo Lake');
      expect(screen.getByTestId('data-location').textContent).toBe('Opeongo Lake');
      expect(screen.getByTestId('details-days').textContent).toBe('5');
    });
    expect(mocks.updateTripDetails).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Shorten trip unsafely' }));
    await waitFor(() => expect(mocks.updateTripDetails).toHaveBeenCalledTimes(1));
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

  it('optimistically switches the shared variant and commits the returned settings', async () => {
    mocks.fetchDashboardData.mockResolvedValue(dashboardData());
    let resolveUpdate!: (value: {
      data: DashboardData['settings'];
      error: null;
    }) => void;
    mocks.updateThemeVariant.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );
    renderProvider(<ThemeActionProbe />);

    await waitFor(() =>
      expect(screen.getByTestId('theme-action').textContent).toBe(
        'expedition:expedition'
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use Clean' }));

    await waitFor(() =>
      expect(screen.getByTestId('theme-action').textContent).toBe('clean:clean')
    );
    expect(mocks.updateThemeVariant).toHaveBeenCalledWith('trip-1', 'clean');

    await act(async () => {
      resolveUpdate({
        data: { ...dashboardData().settings, theme_variant: 'clean' },
        error: null,
      });
    });
    await waitFor(() =>
      expect(screen.getByTestId('theme-action').textContent).toBe('clean:clean')
    );
  });

  it('restores the prior variant and exposes the persistence error on failure', async () => {
    mocks.fetchDashboardData.mockResolvedValue(dashboardData());
    let resolveUpdate!: (value: {
      data: null;
      error: { message: string };
    }) => void;
    mocks.updateThemeVariant.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );
    renderProvider(<ThemeActionProbe />);

    await waitFor(() =>
      expect(screen.getByTestId('theme-action').textContent).toBe(
        'expedition:expedition'
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use Clean' }));
    await waitFor(() =>
      expect(screen.getByTestId('theme-action').textContent).toBe('clean:clean')
    );

    await act(async () => {
      resolveUpdate({
        data: null,
        error: { message: 'Theme save failed' },
      });
    });
    await waitFor(() =>
      expect(screen.getByTestId('theme-action').textContent).toBe(
        'expedition:expedition'
      )
    );
    expect(screen.getByRole('alert').textContent).toContain('Theme save failed');
  });
});
