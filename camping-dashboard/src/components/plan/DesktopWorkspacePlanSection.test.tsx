// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Meal, TimelineEvent } from '@/types';
import type { TripWorkspaceValue } from '@/components/trip/TripWorkspaceProvider';
import { evaluateReadiness } from '@/lib/readiness';
import { PhoneLayoutProvider } from '@/components/trip/PhoneLayoutProvider';
import { TripDraftGuardProvider } from '@/components/trip/TripDraftGuardProvider';
import { TripWorkspaceStatusProvider } from '@/components/trip/TripWorkspaceStatus';
import GuardedTripLink from '@/components/trip/GuardedTripLink';
import DesktopWorkspaceDocument from '@/components/trip/DesktopWorkspaceDocument';
import DesktopWorkspacePlanSection from './DesktopWorkspacePlanSection';

const mocks = vi.hoisted(() => ({ value: null as TripWorkspaceValue | null, push: vi.fn(), replace: vi.fn() }));
vi.mock('@/components/trip/TripWorkspaceProvider', () => ({ useTripWorkspace: () => mocks.value }));
vi.mock('next/navigation', () => ({ usePathname: () => '/trips/trip-1/plan', useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));

function fixture(editable = true): TripWorkspaceValue {
  const timeline = Array.from({ length: 7 }, (_, i) => ({
    id: `event-${i}`, trip_id: 'trip-1', day_number: 1, event_time: `${String(6 + i).padStart(2, '0')}:30`,
    title: ['Depart Kincardine', 'Fuel and final gear check', 'Arrive Algonquin', 'Permit and gear staging', 'Begin the hike', 'Reach campsite', 'Set up camp'][i],
    details: 'Meet at the access point. Check the route before departure.', sort_order: (i + 1) * 10, phase: i === 0 ? 'Travel' : null,
  } as TimelineEvent)).reverse();
  const meals = [
    { id: 'dinner', meal_type: 'dinner', title: 'Dehydrated meal', calories: 800 },
    { id: 'breakfast', meal_type: 'breakfast', title: 'Stop in town', calories: 600 },
    { id: 'lunch', meal_type: 'lunch', title: 'Pick up en-route', calories: 500 },
  ].map(meal => ({ ...meal, trip_id: 'trip-1', day_number: 1, prep_type: 'fresh', notes: 'Pack utensils and water.', assigned_to: null, prep_crew_member_id: null } as Meal));
  return {
    trip: { id: 'trip-1', name: 'Maple Lake Weekend', park_name: 'Algonquin Park', lake_name: 'Maple Lake', site_name: 'Site 4', start_date: '2026-07-27', end_date: '2026-07-29' },
    data: { settings: { show_meals: true }, currentWeather: null, weatherRefresh: null, forecast: [], astro: null },
    timeline, meals, crew: [], gear: [], alerts: [], tripDays: 3,
    readiness: evaluateReadiness({ tripId: 'trip-1', tripDays: 3, gear: [], meals, timeline,
      currentWeather: null, forecast: [], offlineStatus: null, modules: { mealsEnabled: true, offlineEnabled: true } }),
    editableActions: editable ? { addTimelineEvent: vi.fn(), updateTimelineEvent: vi.fn(), deleteTimelineEvent: vi.fn(),
      addMeal: vi.fn(), updateMeal: vi.fn(), deleteMeal: vi.fn(), updateTripDetails: vi.fn() } : null,
  } as unknown as TripWorkspaceValue;
}

beforeEach(() => { mocks.value = fixture(); mocks.push.mockReset(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('compact desktop Plan', () => {
  it('uses canonical planner order, one selected day, compact meals and disclosure', () => {
    render(<DesktopWorkspacePlanSection navigationPath="/trips/trip-1/plan" />);
    const schedule = screen.getByRole('region', { name: /Schedule/ });
    expect(within(schedule).getAllByRole('heading', { level: 4 }).map(h => h.textContent))
      .toEqual(['Depart Kincardine', 'Fuel and final gear check', 'Arrive Algonquin', 'Permit and gear staging', 'Begin the hike']);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 7 events' }));
    expect(within(schedule).getAllByRole('heading', { level: 4 })).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Show fewer events' }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Show details for Depart Kincardine' }));
    expect(screen.getByText('Meet at the access point. Check the route before departure.')).toBeTruthy();
    const meals = screen.getByRole('region', { name: 'Meals' });
    expect(within(meals).getAllByRole('heading', { level: 4 }).map(h => h.textContent)).toEqual(['Stop in town', 'Pick up en-route', 'Dehydrated meal']);
    expect(screen.getByText('1900 kcal')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Day 2' }));
    expect(screen.getByText('No events planned for this day.')).toBeTruthy();
    expect(screen.getByText('No meals planned for this day.')).toBeTruthy();
    expect(screen.queryByText('1900 kcal')).toBeNull();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('reuses real event and meal sheets for add/edit and existing mutation actions', async () => {
    render(<DesktopWorkspacePlanSection navigationPath="/trips/trip-1/plan" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Evening check-in' } });
    fireEvent.submit(screen.getByLabelText('Title *').closest('form')!);
    await waitFor(() => expect(mocks.value!.editableActions!.addTimelineEvent).toHaveBeenCalledWith(expect.objectContaining({ title: 'Evening check-in', day_number: 1, sort_order: 80 })));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Edit meal: Stop in town' }));
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Oatmeal' } });
    fireEvent.submit(screen.getByLabelText('Title *').closest('form')!);
    await waitFor(() => expect(mocks.value!.editableActions!.updateMeal).toHaveBeenCalledWith('breakfast', expect.objectContaining({ title: 'Oatmeal' })));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Edit trip details' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('keeps removal confirmation recoverable on a failed mutation', async () => {
    vi.mocked(mocks.value!.editableActions!.deleteTimelineEvent).mockRejectedValueOnce(new Error('offline'));
    render(<DesktopWorkspacePlanSection navigationPath="/trips/trip-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove event: Depart Kincardine' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }));
    await waitFor(() => expect(screen.getByText('Could not remove this item. Please try again.')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }));
    await waitFor(() => expect(screen.queryByText('Remove “Depart Kincardine”?')).toBeNull());
  });

  it('preserves dirty sheets on Stay and resets editors after approved navigation', async () => {
    function App({ path }: { path: string }) {
      return <TripDraftGuardProvider><GuardedTripLink href="/trips/trip-1">Overview</GuardedTripLink>
        <DesktopWorkspacePlanSection navigationPath={path} /></TripDraftGuardProvider>;
    }
    const view = render(<App path="/trips/trip-1/plan" />);
    fireEvent.click(screen.getByRole('button', { name: 'Day 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Unsaved event' } });
    fireEvent.click(screen.getByRole('link', { name: 'Overview' }));
    expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stay and continue editing' }));
    expect((screen.getByLabelText('Title *') as HTMLInputElement).value).toBe('Unsaved event');
    fireEvent.click(screen.getByRole('link', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes and continue' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/trips/trip-1'));
    view.rerender(<App path="/trips/trip-1" />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Day 2' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('renders the real Overview before Plan from the same cached workspace without editors', () => {
    mocks.value = fixture(false);
    render(<TripWorkspaceStatusProvider value={{ source: 'cache', connectivity: 'offline', cachedAt: null, lastOnlineVerifiedAt: null, reload: vi.fn() }}>
      <PhoneLayoutProvider><div data-desktop-trip-workspace><DesktopWorkspaceDocument tripId="trip-1" pathname="/trips/trip-1/plan" /></div></PhoneLayoutProvider>
    </TripWorkspaceStatusProvider>);
    const overview = screen.getByRole('heading', { level: 1 });
    const plan = screen.getByRole('heading', { level: 2, name: 'Plan' });
    expect(overview.compareDocumentPosition(plan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Map unavailable while using saved trip')).toBeTruthy();
    expect(screen.getByText('1900 kcal')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add event' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add meal' })).toBeNull();
    expect(document.querySelector('[data-plan-composition="mobile"]')).toBeNull();
    expect(document.querySelector('.timeline-card__events')).toBeNull();
  });

  it('keeps unknown calories truthful and respects the meals module setting', () => {
    mocks.value!.meals[0].calories = NaN;
    const view = render(<DesktopWorkspacePlanSection navigationPath="/trips/trip-1/plan" />);
    expect(screen.getByText('kcal unavailable')).toBeTruthy();
    expect(screen.getByText('Known calories')).toBeTruthy();
    mocks.value!.data!.settings.show_meals = false;
    view.rerender(<DesktopWorkspacePlanSection navigationPath="/trips/trip-1/plan" />);
    expect(screen.queryByRole('region', { name: 'Meals' })).toBeNull();
    const css = readFileSync('src/components/plan/desktopWorkspacePlan.css', 'utf8');
    expect(css).toContain('@scope ([data-desktop-trip-workspace] .desktop-workspace-plan)');
    expect(css).not.toMatch(/overflow-y|\b(?:min-|max-)?height:\s*[^;]*(?:vh|dvh)/);
  });
});
