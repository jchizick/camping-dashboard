// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { GearItem } from '@/types';
import type { TripWorkspaceValue } from '@/components/trip/TripWorkspaceProvider';
import { evaluateGearCategory, evaluateReadiness } from '@/lib/readiness';
import { calculateEstimatedGearWeight, formatEstimatedGearWeight } from '@/lib/helpers';
import { PhoneLayoutProvider } from '@/components/trip/PhoneLayoutProvider';
import { TripDraftGuardProvider } from '@/components/trip/TripDraftGuardProvider';
import { TripWorkspaceStatusProvider } from '@/components/trip/TripWorkspaceStatus';
import GuardedTripLink from '@/components/trip/GuardedTripLink';
import DesktopWorkspaceDocument from '@/components/trip/DesktopWorkspaceDocument';
import DesktopWorkspaceGearSection from './DesktopWorkspaceGearSection';
import { getGearCategories } from './gearViewModel';

const mocks = vi.hoisted(() => ({ value: null as TripWorkspaceValue | null, search: new URLSearchParams(), replace: vi.fn(), push: vi.fn() }));
vi.mock('@/components/trip/TripWorkspaceProvider', () => ({ useTripWorkspace: () => mocks.value }));
vi.mock('next/navigation', () => ({ useSearchParams: () => mocks.search, usePathname: () => '/trips/trip-1/gear', useRouter: () => ({ replace: mocks.replace, push: mocks.push }) }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));

function fixture(editable = true): TripWorkspaceValue {
  const gear = Array.from({ length: 68 }, (_, i) => ({
    id: `gear-${i}`, trip_id: 'trip-1', name: i === 0 ? 'Rain shell' : i === 1 ? 'Camp shoes' : `Item ${i + 1}`,
    category: ['Shelter', 'Navigation', 'Cooking', 'Clothing'][i % 4], packed: i >= 8,
    acquired: i !== 0, priority: i % 8 === 0 ? 'critical' : 'high', weight_kg: i === 0 ? 0 : 0.2,
    owner: i === 0 ? 'Jordan' : null, responsible_crew_member_id: null, notes: '',
  } as GearItem));
  return {
    trip: { id: 'trip-1', name: 'Maple Lake Weekend', park_name: 'Algonquin Park', lake_name: 'Maple Lake', site_name: 'Site 4', start_date: '2026-07-27', end_date: '2026-07-29' },
    data: { settings: { show_meals: true }, currentWeather: null, weatherRefresh: null, forecast: [], astro: null },
    gear, crew: [], timeline: [], meals: [], alerts: [], tripDays: 3, source: editable ? 'online' : 'cache',
    readiness: evaluateReadiness({ tripId: 'trip-1', tripDays: 3, gear, timeline: [], meals: [], currentWeather: null, forecast: [], offlineStatus: null, modules: { mealsEnabled: true, offlineEnabled: true } }),
    editableActions: editable ? { addGearItem: vi.fn(), updateGearItem: vi.fn(), deleteGearItem: vi.fn(), toggleGearAcquired: vi.fn(), toggleGearPacked: vi.fn() } : null,
  } as unknown as TripWorkspaceValue;
}
beforeEach(() => { mocks.value = fixture(); mocks.search = new URLSearchParams(); mocks.replace.mockReset(); mocks.push.mockReset(); HTMLElement.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('compact desktop Gear', () => {
  it('limits packing attention styling to the selected remaining view', () => {
    render(<DesktopWorkspaceGearSection navigationPath="/trips/trip-1/gear" />);
    const remaining = screen.getByRole('button', { name: 'Needs packing' });
    expect(remaining.getAttribute('data-gear-view')).toBe('remaining');
    expect(remaining.getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById('desktop-gear-items-title')?.getAttribute('data-needs-packing')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Required' }));
    expect(remaining.getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById('desktop-gear-items-title')?.getAttribute('data-needs-packing')).toBe('false');
  });

  it('uses canonical Gear readiness, weight and separate packing/acquisition state with limited DOM', () => {
    render(<DesktopWorkspaceGearSection navigationPath="/trips/trip-1/gear" />);
    expect(document.querySelectorAll('[data-gear-item]')).toHaveLength(6);
    expect(screen.getByText('60 / 68')).toBeTruthy();
    expect(screen.getByText(`${evaluateGearCategory(mocks.value!.gear).score}%`)).toBeTruthy();
    expect(screen.getByText(formatEstimatedGearWeight(calculateEstimatedGearWeight(mocks.value!.gear)))).toBeTruthy();
    expect(screen.getByRole('heading', { name: '1 required item missing' })).toBeTruthy();
    expect(screen.getByText('Missing · Not acquired · Legacy assignment · Jordan')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rain shell — not acquired' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Rain shell — not packed' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('reveals remaining, packed and category items through one detail list', () => {
    render(<DesktopWorkspaceGearSection navigationPath="/trips/trip-1/gear" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 8 items' }));
    expect(document.querySelectorAll('[data-gear-item]')).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Show fewer items' }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(screen.getByRole('group', { name: 'Gear views' })).getByRole('button', { name: 'Packed' }));
    expect(document.querySelectorAll('[data-gear-item]')).toHaveLength(6);
    const system = screen.getByRole('button', { name: /Shelter.*packed/ });
    fireEvent.click(system);
    expect(system.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelectorAll('#desktop-gear-items')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Show all 17 items' })).toBeTruthy();
    expect(getGearCategories(mocks.value!.gear).map(([name]) => name)).toEqual(['Shelter', 'Navigation', 'Cooking', 'Clothing']);
  });

  it('uses existing mutations and the real Gear sheet', async () => {
    render(<DesktopWorkspaceGearSection navigationPath="/trips/trip-1/gear" />);
    fireEvent.click(screen.getByRole('button', { name: 'Rain shell — not packed' }));
    await waitFor(() => expect(mocks.value!.editableActions!.toggleGearPacked).toHaveBeenCalledWith('gear-0'));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Rain shell — not acquired' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Rain shell — not acquired' }));
    await waitFor(() => expect(mocks.value!.editableActions!.toggleGearAcquired).toHaveBeenCalledWith('gear-0'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Rain shell' }));
    fireEvent.change(screen.getByLabelText('Item Name *'), { target: { value: 'Waterproof shell' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(mocks.value!.editableActions!.updateGearItem).toHaveBeenCalledWith('gear-0', expect.objectContaining({ name: 'Waterproof shell' })));
  });

  it('consumes a Required intent on Gear only, preserves other query values and opens a Required form', async () => {
    mocks.search = new URLSearchParams('intent=add-required&context=packing');
    const view = render(<DesktopWorkspaceGearSection navigationPath="/trips/trip-1" />);
    expect(mocks.replace).not.toHaveBeenCalled();
    view.rerender(<DesktopWorkspaceGearSection navigationPath="/trips/trip-1/gear" />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect((screen.getByRole('checkbox', { name: /Required for this trip/ }) as HTMLInputElement).checked).toBe(true);
    expect(mocks.replace).toHaveBeenCalledWith('/trips/trip-1/gear?context=packing', { scroll: false });
    fireEvent.change(screen.getByLabelText('Item Name *'), { target: { value: 'Water filter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    await waitFor(() => expect(mocks.value!.editableActions!.addGearItem).toHaveBeenCalledWith(expect.objectContaining({ name: 'Water filter', priority: 'critical' })));
    expect(mocks.replace).toHaveBeenCalledTimes(1);
  });

  it('preserves dirty editor state on Stay and closes it after approved navigation', async () => {
    function App({ path }: { path: string }) {
      return <TripDraftGuardProvider><GuardedTripLink href="/trips/trip-1/plan">Plan destination</GuardedTripLink><DesktopWorkspaceGearSection navigationPath={path} /></TripDraftGuardProvider>;
    }
    const view = render(<App path="/trips/trip-1/gear" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Rain shell' }));
    fireEvent.change(screen.getByLabelText('Item Name *'), { target: { value: 'Unsaved shell' } });
    fireEvent.click(screen.getByRole('link', { name: 'Plan destination' }));
    expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stay and continue editing' }));
    expect((screen.getByLabelText('Item Name *') as HTMLInputElement).value).toBe('Unsaved shell');
    fireEvent.click(screen.getByRole('link', { name: 'Plan destination' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes and continue' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/trips/trip-1/plan'));
    view.rerender(<App path="/trips/trip-1/plan" />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('composes all three sections from cached data without allowing mutation or consuming an intent', () => {
    mocks.value = fixture(false);
    mocks.search = new URLSearchParams('intent=add-required');
    render(<TripWorkspaceStatusProvider value={{ source: 'cache', connectivity: 'offline', cachedAt: null, lastOnlineVerifiedAt: null, reload: vi.fn() }}>
      <PhoneLayoutProvider><div data-desktop-trip-workspace><DesktopWorkspaceDocument tripId="trip-1" pathname="/trips/trip-1/gear" /></div></PhoneLayoutProvider>
    </TripWorkspaceStatusProvider>);
    const overview = screen.getByRole('heading', { level: 1 });
    const plan = screen.getByRole('heading', { level: 2, name: 'Plan' });
    const gear = screen.getByRole('heading', { level: 2, name: 'Gear' });
    expect(overview.compareDocumentPosition(plan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(plan.compareDocumentPosition(gear) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Add gear' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Rain shell — not packed' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(document.querySelector('.gear-checklist-card')).toBeNull();
  });

  it.each([{ weights: [] }, { weights: [0, 0] }, { weights: [0.5, 0] }, { weights: [0.5, 1] }])('preserves weight and unavailable readiness semantics for $weights', ({ weights }) => {
    mocks.value!.gear = weights.map((weight_kg, i) => ({ ...fixture().gear[i], priority: 'high', weight_kg }));
    mocks.value!.readiness!.categories.gear = evaluateGearCategory(mocks.value!.gear);
    render(<DesktopWorkspaceGearSection navigationPath="/trips/trip-1/gear" />);
    expect(screen.getByText(formatEstimatedGearWeight(calculateEstimatedGearWeight(mocks.value!.gear)))).toBeTruthy();
    expect(screen.getByText('Required gear not identified')).toBeTruthy();
    expect(screen.queryByText('0%')).toBeNull();
    const css = readFileSync('src/components/gear/desktopWorkspaceGear.css', 'utf8');
    expect(css).toContain('@scope ([data-desktop-trip-workspace] .desktop-workspace-gear)');
    expect(css).not.toMatch(/overflow-y|\b(?:min-|max-)?height:\s*[^;]*(?:vh|dvh)/);
  });
});
