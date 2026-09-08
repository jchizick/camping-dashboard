// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { CrewMember, GearItem, Meal } from '@/types';
import type { TripWorkspaceValue } from '@/components/trip/TripWorkspaceProvider';
import { evaluateReadiness } from '@/lib/readiness';
import { PhoneLayoutProvider, PHONE_LAYOUT_MEDIA_QUERY } from '@/components/trip/PhoneLayoutProvider';
import { TripDraftGuardProvider } from '@/components/trip/TripDraftGuardProvider';
import { TripWorkspaceStatusProvider } from '@/components/trip/TripWorkspaceStatus';
import GuardedTripLink from '@/components/trip/GuardedTripLink';
import DesktopWorkspaceDocument from '@/components/trip/DesktopWorkspaceDocument';
import TripCrewPage from '@/app/trips/[tripId]/crew/page';
import DesktopWorkspaceCrewSection from './DesktopWorkspaceCrewSection';
import { getCrewLoadBalance, getCrewLoadRows } from './crewViewModel';

const mocks = vi.hoisted(() => ({ value: null as TripWorkspaceValue | null, push: vi.fn(), replace: vi.fn() }));
vi.mock('@/components/trip/TripWorkspaceProvider', () => ({ useTripWorkspace: () => mocks.value }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => '/trips/trip-1/crew', useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/lib/themeContext', () => ({ useTheme: () => ({ labels: { crew: 'Crew' } }) }));

function fixture(editable = true): TripWorkspaceValue {
  const crew = [
    { id: 'jordan', name: 'Jordan', role: 'Expedition Lead · Navigation', load_weight_kg: 25, load_item: 'SHELTER + COOK KIT + WATER + NAVIGATION + SAFETY', notes: 'Keeps the route card close.' },
    { id: 'liz', name: 'Liz', role: 'Support · Systems Apprentice', load_weight_kg: 12, load_item: 'Personal Gear + Food + Headlamps + Hygiene + Shared Items', notes: '' },
  ].map(member => ({ ...member, trip_id: 'trip-1', trip_member_id: null, canoe_number: 1 } as CrewMember));
  const gear = [{ id: 'tent', name: 'Tent', priority: 'critical', category: 'Shelter', weight_kg: 0, acquired: true, packed: false, responsible_crew_member_id: 'jordan', owner: null, notes: '' },
    { id: 'map', name: 'Map', priority: 'critical', category: 'Navigation', weight_kg: 0.1, acquired: true, packed: true, responsible_crew_member_id: null, owner: 'Jordan', notes: '' }].map(item => ({ ...item, trip_id: 'trip-1' } as GearItem));
  const meals = [{ id: 'meal', trip_id: 'trip-1', day_number: 1, meal_type: 'lunch', title: 'Trail wraps', calories: 650, prep_type: 'fresh', prep_crew_member_id: 'jordan', assigned_to: null, notes: '' } as Meal];
  return {
    trip: { id: 'trip-1', name: 'Maple Lake Weekend', park_name: 'Algonquin Park', lake_name: 'Maple Lake', site_name: 'Site 4', start_date: '2026-07-27', end_date: '2026-07-29' },
    data: { settings: { show_crew: true, show_meals: true }, currentWeather: null, weatherRefresh: null, forecast: [], astro: null },
    crew, gear, meals, timeline: [], alerts: [], tripDays: 3, source: editable ? 'online' : 'cache',
    readiness: evaluateReadiness({ tripId: 'trip-1', tripDays: 3, gear, meals, timeline: [], currentWeather: null, forecast: [], offlineStatus: null, modules: { mealsEnabled: true, offlineEnabled: true } }),
    editableActions: editable ? { addCrewMember: vi.fn(), updateCrewMember: vi.fn(), deleteCrewMember: vi.fn() } : null,
  } as unknown as TripWorkspaceValue;
}

beforeEach(() => { mocks.value = fixture(); mocks.push.mockReset(); mocks.replace.mockReset(); HTMLElement.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.removeAttribute('data-phone-layout'); });

describe('compact desktop Crew', () => {
  it('renders recorded loads, responsibilities and precise bar ratios without the legacy cards', () => {
    render(<DesktopWorkspaceCrewSection navigationPath="/trips/trip-1/crew" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Crew' })).toBeTruthy();
    expect(screen.getByText('2 members')).toBeTruthy();
    expect(screen.getByText('37 kg')).toBeTruthy();
    expect(screen.getByText('25 kg')).toBeTruthy();
    expect(screen.getByText('68% of group load')).toBeTruthy();
    expect(screen.getByText('32% of group load')).toBeTruthy();
    expect(screen.getByText('Slight Imbalance')).toBeTruthy();
    expect(screen.getByText('Shelter · Cook Kit · Water · Navigation · Safety')).toBeTruthy();
    expect(screen.getByText(/1 Required gear item has no linked crew member/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Review gear' }).getAttribute('href')).toBe('/trips/trip-1/gear');
    const bar = screen.getByRole('img', { name: 'Jordan: 25 kg, 68% of group load' }).firstElementChild as HTMLElement;
    expect(parseFloat(bar.style.width)).toBeCloseTo(25 / 37 * 100, 10);
    expect(screen.getByText('Notes for Jordan').closest('details')?.open).toBe(false);
    expect(document.querySelector('.crew-member-card')).toBeNull();
    expect(document.querySelector('.crew-load-card')).toBeNull();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it.each([
    { weights: [], label: 'No Load Data' }, { weights: [0, 0], label: 'No Load Data' },
    { weights: [18], label: 'Optimal Balance' }, { weights: [50, 50], label: 'Optimal Balance' },
    { weights: [59, 41], label: 'Optimal Balance' }, { weights: [60, 40], label: 'Slight Imbalance' },
    { weights: [69, 31], label: 'Slight Imbalance' }, { weights: [70, 30], label: 'Major Imbalance' },
    { weights: [10, 0], label: 'Major Imbalance' },
  ])('preserves the balance thresholds for $weights', ({ weights, label }) => {
    mocks.value!.crew = weights.map((load_weight_kg, i) => ({ ...fixture().crew[i % 2], id: `crew-${i}`, load_weight_kg }));
    const load = getCrewLoadRows(mocks.value!.crew);
    expect(getCrewLoadBalance(load).label).toBe(label);
    render(<DesktopWorkspaceCrewSection navigationPath="/trips/trip-1/crew" />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getAllByText(`${Math.round(load.totalLoad)} kg`).length).toBeGreaterThan(0);
  });

  it('keeps empty assigned systems and hidden modules truthful', () => {
    mocks.value!.crew[0].load_item = '';
    const view = render(<DesktopWorkspaceCrewSection navigationPath="/trips/trip-1/crew" />);
    expect(screen.getByText('No system assigned')).toBeTruthy();
    mocks.value!.data!.settings.show_crew = false;
    view.rerender(<DesktopWorkspaceCrewSection navigationPath="/trips/trip-1/crew" />);
    expect(screen.getByText('The crew module is hidden for this trip.')).toBeTruthy();
    expect(screen.queryByText('Jordan')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add crew member' })).toBeNull();
  });

  it('adds and edits through the real Crew sheet and existing actions', async () => {
    render(<DesktopWorkspaceCrewSection navigationPath="/trips/trip-1/crew" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add crew member' }));
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Sam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Member' }));
    await waitFor(() => expect(mocks.value!.editableActions!.addCrewMember).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sam' })));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Edit Jordan' }));
    fireEvent.change(screen.getByLabelText('Load Item'), { target: { value: 'Navigation + Water' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(mocks.value!.editableActions!.updateCrewMember).toHaveBeenCalledWith('jordan', expect.objectContaining({ load_item: 'Navigation + Water' })));
  });

  it('explains unassignment and retains confirmation when deletion fails', async () => {
    const remove = vi.mocked(mocks.value!.editableActions!.deleteCrewMember);
    remove.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    render(<DesktopWorkspaceCrewSection navigationPath="/trips/trip-1/crew" />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Jordan' }));
    expect(screen.getByRole('alert').textContent).toContain('1 Gear item and 1 meal will become unassigned');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }));
    await waitFor(() => expect(screen.getByText('Could not remove this member. Please try again.')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(remove).toHaveBeenLastCalledWith('jordan');
  });

  it('keeps dirty drafts on Stay and closes the sheet after guarded route navigation', async () => {
    function App({ path }: { path: string }) {
      return <TripDraftGuardProvider><GuardedTripLink href="/trips/trip-1/gear">Gear destination</GuardedTripLink><DesktopWorkspaceCrewSection navigationPath={path} /></TripDraftGuardProvider>;
    }
    const view = render(<App path="/trips/trip-1/crew" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Jordan' }));
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'Unsaved role' } });
    fireEvent.click(screen.getByRole('link', { name: 'Gear destination' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stay and continue editing' }));
    expect((screen.getByLabelText('Role') as HTMLInputElement).value).toBe('Unsaved role');
    expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: 'Gear destination' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes and continue' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/trips/trip-1/gear'));
    view.rerender(<App path="/trips/trip-1/gear" />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each(['', '/plan', '/gear', '/crew'])('renders four sections in order from cached data on %s', suffix => {
    mocks.value = fixture(false);
    render(<TripWorkspaceStatusProvider value={{ source: 'cache', connectivity: 'offline', cachedAt: null, lastOnlineVerifiedAt: null, reload: vi.fn() }}>
      <PhoneLayoutProvider><div data-desktop-trip-workspace><DesktopWorkspaceDocument tripId="trip-1" pathname={`/trips/trip-1${suffix}`} /></div></PhoneLayoutProvider>
    </TripWorkspaceStatusProvider>);
    const sections = [screen.getByRole('heading', { level: 1 }), ...['Plan', 'Gear', 'Crew'].map(name => screen.getByRole('heading', { level: 2, name }))];
    sections.slice(1).forEach((section, i) => expect(sections[i].compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Add crew member|Edit Jordan|Remove Jordan/ })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Field' })).toBeTruthy();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it.each([390, 956])('retains the real mobile Crew composition at phone width %s', width => {
    vi.stubGlobal('innerWidth', width);
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    render(<PhoneLayoutProvider><TripCrewPage /></PhoneLayoutProvider>);
    expect(window.matchMedia).toHaveBeenCalledWith(PHONE_LAYOUT_MEDIA_QUERY);
    expect(document.querySelector('[data-crew-composition="mobile"]')).toBeTruthy();
    expect(document.querySelector('[data-crew-composition="compact-desktop"]')).toBeNull();
    expect(document.querySelectorAll('[data-crew-composition]')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Crew' })).toBeTruthy();
  });

  it('scopes styling to the desktop boundary and uses document scrolling', () => {
    const css = readFileSync('src/components/crew/desktopWorkspaceCrew.css', 'utf8');
    expect(css).toContain('@scope ([data-desktop-trip-workspace] .desktop-workspace-crew)');
    expect(css).not.toMatch(/overflow-y|\b(?:min-|max-)?height:\s*[^;]*(?:vh|dvh)/);
  });
});
