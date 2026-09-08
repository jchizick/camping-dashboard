// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TripMemberRole } from '@/types';
import { evaluateReadiness } from '@/lib/readiness';
import type {
  TripWorkspaceEditableActions,
  TripWorkspaceValue,
} from './TripWorkspaceProvider';
import {
  PHONE_LAYOUT_MEDIA_QUERY,
  PhoneLayoutProvider,
} from './PhoneLayoutProvider';

const workspace = vi.hoisted(() => ({
  value: null as TripWorkspaceValue | null,
}));

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParams: { get: vi.fn(() => null) },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => '/trips/trip-1/gear',
  useSearchParams: () => navigation.searchParams,
}));

vi.mock('./TripWorkspaceProvider', () => ({
  useTripWorkspace: () => workspace.value,
}));

vi.mock('@/components/plan/MobilePlanOverview', () => ({
  default: ({ onAddEvent, tripDays, showMeals }: { onAddEvent?: unknown; tripDays: number; showMeals: boolean }) => <div data-testid="mobile-plan" data-plan-composition="mobile" data-editable={String(Boolean(onAddEvent))} data-days={tripDays} data-meals={String(showMeals)} />,
}));
vi.mock('@/components/field/MobileFieldOverview', () => ({
  default: ({ actions }: { actions?: unknown }) => <div data-testid="mobile-field" data-field-composition="mobile" data-editable={String(Boolean(actions))} />,
}));
vi.mock('@/components/cards/GearChecklistCard', () => ({
  default: ({ onAdd }: { onAdd?: unknown }) => (
    <div data-testid="gear" data-editable={String(Boolean(onAdd))} />
  ),
}));
vi.mock('@/components/cards/ReadinessScoreCard', () => ({
  default: () => <div data-testid="readiness" />,
}));
vi.mock('@/components/cards/FieldPrepFeedCard', () => ({
  default: ({ onAdd }: { onAdd?: unknown }) => (
    <div data-testid="field-log" data-editable={String(Boolean(onAdd))} />
  ),
}));

vi.mock('@/components/crew/MobileCrewOverview', () => ({
  default: ({ onAdd }: { onAdd?: unknown }) => <div data-testid="mobile-crew" data-editable={String(Boolean(onAdd))} />,
}));

import TripPlanPage from '@/app/trips/[tripId]/plan/page';
import TripGearPage from '@/app/trips/[tripId]/gear/page';
import TripCrewPage from '@/app/trips/[tripId]/crew/page';
import TripGuidePage from '@/app/trips/[tripId]/guide/page';
import TripFieldLogPage from '@/app/trips/[tripId]/field-log/page';
import DesktopTripWorkspaceBoundary from './DesktopTripWorkspaceBoundary';

function renderRoute(Page: React.ComponentType, phone = true) {
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({ matches: phone && media === PHONE_LAYOUT_MEDIA_QUERY, media, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  return render(
    <PhoneLayoutProvider>
      <DesktopTripWorkspaceBoundary><Page /></DesktopTripWorkspaceBoundary>
    </PhoneLayoutProvider>
  );
}

const editableActions = new Proxy(
  {},
  { get: () => vi.fn() }
) as TripWorkspaceEditableActions;

function workspaceValue(
  role: TripMemberRole,
  settings: Partial<{
    show_meals: boolean;
    show_crew: boolean;
    show_offline: boolean;
    show_astro: boolean;
  }> = {}
): TripWorkspaceValue {
  const canEdit = role === 'owner' || role === 'editor';
  return {
    data: {
      currentWeather: null,
      alertRefresh: null,
      astro: null,
      settings: {
        show_meals: true,
        show_crew: true,
        show_offline: true,
        show_astro: true,
        ...settings,
      },
    },
    trip: {
      id: 'trip-1',
      name: 'Test trip',
      park_name: 'Algonquin Park',
      lake_name: 'Maple Lake',
      site_name: 'Site 4',
      start_date: '2026-08-01',
      end_date: '2026-08-03',
    },
    gear: [],
    meals: [],
    timeline: [],
    crew: [],
    alerts: [],
    offlineStatus: null,
    parkIntel: null,
    prepFeed: [],
    tripDays: 3,
    readiness: evaluateReadiness({
      tripId: 'trip-1',
      tripDays: 3,
      gear: [],
      meals: [],
      timeline: [],
      currentWeather: null,
      forecast: [],
      offlineStatus: null,
      modules: { mealsEnabled: false, offlineEnabled: false },
    }),
    permissions: {
      role,
      canEdit,
      isOwner: role === 'owner',
    },
    editableActions: canEdit ? editableActions : null,
    uploaderName: 'Test User',
    isLoading: false,
    error: null,
  } as unknown as TripWorkspaceValue;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('trip section routes', () => {
  const routes = [
    ['Plan', TripPlanPage, ['mobile-plan']],
    ['Gear', TripGearPage, ['readiness', 'gear']],
    ['Crew', TripCrewPage, ['mobile-crew']],
    ['Field', TripGuidePage, ['mobile-field']],
    ['Field Log', TripFieldLogPage, ['field-log']],
  ] as const;

  it.each(routes)('renders the canonical %s composition', (title, Page, modules) => {
    workspace.value = workspaceValue('owner');
    const { container } = renderRoute(Page);

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(container.querySelector('[data-trip-section]')).toBeTruthy();
    expect(container.querySelector('[data-desktop-trip-workspace]')).toBeNull();
    expect(container.querySelector('.trip-section-header')).toBeTruthy();
    for (const moduleId of modules) expect(screen.getByTestId(moduleId)).toBeTruthy();
  });

  it.each(['owner', 'editor', 'viewer'] as const)(
    'passes mutation callbacks correctly for %s deep links',
    (role) => {
      workspace.value = workspaceValue(role);
      const canEdit = role !== 'viewer';

      for (const [, Page] of routes) {
        const view = renderRoute(Page);
        for (const editableModule of view.container.querySelectorAll('[data-editable]')) {
          expect(editableModule.getAttribute('data-editable')).toBe(String(canEdit));
        }
        view.unmount();
      }

      expect(workspace.value.permissions.isOwner).toBe(role === 'owner');
    }
  );

  it('omits hidden optional modules without exposing their actions', () => {
    workspace.value = workspaceValue('owner', {
      show_meals: false,
      show_crew: false,
      show_offline: false,
      show_astro: false,
    });

    const plan = renderRoute(TripPlanPage);
    expect(screen.getByTestId('mobile-plan').getAttribute('data-meals')).toBe('false');
    plan.unmount();

    const crew = renderRoute(TripCrewPage);
    expect(screen.queryByTestId('mobile-crew')).toBeNull();
    expect(screen.getByText('The crew module is hidden for this trip.')).toBeTruthy();
    crew.unmount();

    renderRoute(TripGuidePage);
    expect(screen.getByTestId('mobile-field')).toBeTruthy();
  });

  it('passes every inclusive trip day to the timeline and meal planner', () => {
    workspace.value = { ...workspaceValue('owner'), tripDays: 5 };

    renderRoute(TripPlanPage);

    expect(screen.getByTestId('mobile-plan').getAttribute('data-days')).toBe('5');
  });

  it('mounts only the consolidated Plan composition below 768px', () => {
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
    workspace.value = workspaceValue('owner');

    renderRoute(TripPlanPage);

    expect(screen.getByTestId('mobile-plan')).toBeTruthy();
    expect(document.querySelector('[data-desktop-trip-workspace]')).toBeNull();
    expect(screen.queryByTestId('timeline')).toBeNull();
    expect(screen.queryByTestId('meals')).toBeNull();
    expect(screen.getByText('Trip details, schedule and meals')).toBeTruthy();
  });

  it('mounts only the field-briefing composition below 768px', () => {
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
    workspace.value = workspaceValue('owner');

    renderRoute(TripGuidePage);

    expect(screen.getByTestId('mobile-field')).toBeTruthy();
    expect(document.querySelector('[data-desktop-trip-workspace]')).toBeNull();
    expect(screen.queryByTestId('park')).toBeNull();
    expect(screen.queryByTestId('alerts')).toBeNull();
    expect(screen.queryByTestId('offline')).toBeNull();
    expect(screen.queryByTestId('astro')).toBeNull();
    expect(screen.getByText('Conditions, notices and field essentials')).toBeTruthy();
  });

  it.each([TripPlanPage, TripCrewPage, TripGuidePage])('leaves non-phone composition to TripAppShell', Page => {
    workspace.value = workspaceValue('owner');
    const { container } = renderRoute(Page, false);
    expect(container.querySelector('[data-trip-section]')).toBeNull();
    expect(container.querySelector('[data-testid]')).toBeNull();
  });
});
