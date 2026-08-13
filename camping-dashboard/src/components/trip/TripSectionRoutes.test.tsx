// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TripMemberRole } from '@/types';
import type {
  TripWorkspaceEditableActions,
  TripWorkspaceValue,
} from './TripWorkspaceProvider';

const workspace = vi.hoisted(() => ({
  value: null as TripWorkspaceValue | null,
}));

vi.mock('./TripWorkspaceProvider', () => ({
  useTripWorkspace: () => workspace.value,
}));

vi.mock('@/components/cards/TimelineCard', () => ({
  default: ({ onAdd, tripDays }: { onAdd?: unknown; tripDays: number }) => (
    <div
      data-testid="timeline"
      data-editable={String(Boolean(onAdd))}
      data-days={tripDays}
    />
  ),
}));
vi.mock('@/components/cards/MealPlannerCard', () => ({
  default: ({ onAdd, totalDays }: { onAdd?: unknown; totalDays: number }) => (
    <div
      data-testid="meals"
      data-editable={String(Boolean(onAdd))}
      data-days={totalDays}
    />
  ),
}));
vi.mock('@/components/cards/GearChecklistCard', () => ({
  default: ({ onAdd }: { onAdd?: unknown }) => (
    <div data-testid="gear" data-editable={String(Boolean(onAdd))} />
  ),
}));
vi.mock('@/components/cards/ReadinessScoreCard', () => ({
  default: () => <div data-testid="readiness" />,
}));
vi.mock('@/components/cards/CrewRosterCard', () => ({
  default: ({ onAdd }: { onAdd?: unknown }) => (
    <div data-testid="crew" data-editable={String(Boolean(onAdd))} />
  ),
}));
vi.mock('@/components/cards/ParkIntelCard', () => ({
  default: ({ onUpdate }: { onUpdate?: unknown }) => (
    <div data-testid="park" data-editable={String(Boolean(onUpdate))} />
  ),
}));
vi.mock('@/components/cards/AlertsCard', () => ({
  default: ({ onAddManual }: { onAddManual?: unknown }) => (
    <div data-testid="alerts" data-editable={String(Boolean(onAddManual))} />
  ),
}));
vi.mock('@/components/cards/OfflineVaultCard', () => ({
  default: ({ onToggle }: { onToggle?: unknown }) => (
    <div data-testid="offline" data-editable={String(Boolean(onToggle))} />
  ),
}));
vi.mock('@/components/cards/AstroCard', () => ({
  default: () => <div data-testid="astro" />,
}));
vi.mock('@/components/cards/FieldPrepFeedCard', () => ({
  default: ({ onAdd }: { onAdd?: unknown }) => (
    <div data-testid="field-log" data-editable={String(Boolean(onAdd))} />
  ),
}));

import TripPlanPage from '@/app/trips/[tripId]/plan/page';
import TripGearPage from '@/app/trips/[tripId]/gear/page';
import TripCrewPage from '@/app/trips/[tripId]/crew/page';
import TripGuidePage from '@/app/trips/[tripId]/guide/page';
import TripFieldLogPage from '@/app/trips/[tripId]/field-log/page';

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
    trip: { id: 'trip-1' },
    gear: [],
    meals: [],
    timeline: [],
    crew: [],
    alerts: [],
    offlineStatus: null,
    parkIntel: null,
    prepFeed: [],
    tripDays: 3,
    readiness: { overall: 0 },
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

afterEach(cleanup);

describe('trip section routes', () => {
  const routes = [
    ['Plan', TripPlanPage, ['timeline', 'meals']],
    ['Gear', TripGearPage, ['readiness', 'gear']],
    ['Crew', TripCrewPage, ['crew']],
    ['Field Guide', TripGuidePage, ['park', 'alerts', 'offline', 'astro']],
    ['Field Log', TripFieldLogPage, ['field-log']],
  ] as const;

  it.each(routes)('renders the canonical %s composition', (title, Page, modules) => {
    workspace.value = workspaceValue('owner');
    const { container } = render(<Page />);

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(container.querySelector('[data-trip-section]')).toBeTruthy();
    expect(container.querySelector('.trip-section-header')).toBeTruthy();
    for (const moduleId of modules) expect(screen.getByTestId(moduleId)).toBeTruthy();
    expect(container.querySelectorAll('.trip-section-surface')).toHaveLength(modules.length);
  });

  it.each(['owner', 'editor', 'viewer'] as const)(
    'passes mutation callbacks correctly for %s deep links',
    (role) => {
      workspace.value = workspaceValue(role);
      const canEdit = role !== 'viewer';

      for (const [, Page] of routes) {
        const view = render(<Page />);
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

    const plan = render(<TripPlanPage />);
    expect(screen.getByTestId('timeline')).toBeTruthy();
    expect(screen.queryByTestId('meals')).toBeNull();
    plan.unmount();

    const crew = render(<TripCrewPage />);
    expect(screen.queryByTestId('crew')).toBeNull();
    expect(screen.getByText('The crew module is hidden for this trip.')).toBeTruthy();
    crew.unmount();

    render(<TripGuidePage />);
    expect(screen.getByTestId('park')).toBeTruthy();
    expect(screen.getByTestId('alerts')).toBeTruthy();
    expect(screen.queryByTestId('offline')).toBeNull();
    expect(screen.queryByTestId('astro')).toBeNull();
  });

  it('passes every inclusive trip day to the timeline and meal planner', () => {
    workspace.value = { ...workspaceValue('owner'), tripDays: 5 };

    render(<TripPlanPage />);

    expect(screen.getByTestId('timeline').getAttribute('data-days')).toBe('5');
    expect(screen.getByTestId('meals').getAttribute('data-days')).toBe('5');
  });
});
