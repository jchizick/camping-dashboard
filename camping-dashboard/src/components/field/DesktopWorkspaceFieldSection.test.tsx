// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Alert, AlertRefreshState, OfflineStatus, ParkIntel } from '@/types';
import type { TripWorkspaceValue } from '@/components/trip/TripWorkspaceProvider';
import { evaluateReadiness } from '@/lib/readiness';
import { PhoneLayoutProvider, PHONE_LAYOUT_MEDIA_QUERY } from '@/components/trip/PhoneLayoutProvider';
import { TripDraftGuardProvider } from '@/components/trip/TripDraftGuardProvider';
import { TripWorkspaceStatusProvider } from '@/components/trip/TripWorkspaceStatus';
import GuardedTripLink from '@/components/trip/GuardedTripLink';
import DesktopWorkspaceDocument from '@/components/trip/DesktopWorkspaceDocument';
import { desktopSectionHeading } from '@/components/trip/desktopSectionNavigation';
import TripGuidePage from '@/app/trips/[tripId]/guide/page';
import DesktopWorkspaceFieldSection from './DesktopWorkspaceFieldSection';
import { FIELD_PREP_CHECKS } from './fieldPrepChecklist';
import { createFieldViewModel } from './fieldViewModel';

const mocks = vi.hoisted(() => ({ value: null as TripWorkspaceValue | null, push: vi.fn(), replace: vi.fn() }));
vi.mock('@/components/trip/TripWorkspaceProvider', () => ({ useTripWorkspace: () => mocks.value }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => '/trips/trip-1/guide', useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));

function fixture(editable = true): TripWorkspaceValue {
  const alerts = [
    { title: 'Highway 60 campground assistance', severity: 'critical', body: 'Contact park staff if you need assistance. ' },
    { title: 'Highland Falls bridge closure', severity: 'warning', body: 'The bridge is closed until repairs are complete. ' },
    { title: 'Backcountry low water advisory', severity: 'warning', body: 'Low water levels may affect backcountry routes. ' },
    { title: 'Meet at West Gate', severity: 'info', body: 'Meet the group before entering the park. ', provider: 'manual' },
  ].map((notice, i) => ({
    id: `notice-${i}`, trip_id: 'trip-1', provider: 'ontario-parks', source: 'Ontario Parks',
    is_active: true, dismissed_at: null, source_url: 'https://www.ontarioparks.ca/park/algonquin/alerts',
    updated_at: '2026-07-27T12:00:00Z', ...notice,
    body: notice.body + 'Full original source details remain available here. '.repeat(60) + `End of notice ${i}.`,
  } as Alert));
  const offlineStatus: OfflineStatus = { trip_id: 'trip-1', maps_cached: true, permit_saved: true, route_downloaded: true,
    emergency_contact_ready: true, daily_vehicle_permit_saved: false, satellite_device_connected: false, satellite_device_name: '', updated_at: '2026-07-27T12:00:00Z' };
  const parkIntel: ParkIntel = { trip_id: 'trip-1', fire_restriction: 'Level 1 · Low', water_notes: 'Filter or boil lake water.',
    firewood_percent: 70, ranger_station: 'Algonquin Park West Gate · (705) 633-5572',
    wildlife_notes: 'Store food safely away from wildlife. ' + 'Long reference details. '.repeat(30),
    custom_notes: 'Site 4 has excellent swimming and rocky scenic views.', updated_at: '2026-07-27T12:00:00Z' };
  return {
    trip: { id: 'trip-1', name: 'Maple Lake Weekend', park_name: 'Algonquin Park', lake_name: 'Maple Lake', site_name: 'Site 4', start_date: '2026-07-27', end_date: '2026-07-29' },
    data: { settings: { show_crew: true, show_meals: true, show_offline: true }, currentWeather: null, weatherRefresh: null, forecast: [], astro: null,
      alertRefresh: [{ status: 'success', last_success_at: '2026-07-27T12:00:00Z' }] },
    alerts, offlineStatus, parkIntel, crew: [], gear: [], meals: [], timeline: [], tripDays: 3, source: editable ? 'online' : 'cache',
    readiness: evaluateReadiness({ tripId: 'trip-1', tripDays: 3, gear: [], meals: [], timeline: [], currentWeather: null, forecast: [], offlineStatus, modules: { mealsEnabled: true, offlineEnabled: true } }),
    editableActions: editable ? { toggleOfflineStatus: vi.fn(), initializeFieldPrep: vi.fn(), addAlert: vi.fn(), deleteAlert: vi.fn(), dismissAlert: vi.fn(), refreshAlerts: vi.fn(), updateParkIntel: vi.fn() } : null,
  } as unknown as TripWorkspaceValue;
}
beforeEach(() => { mocks.value = fixture(); mocks.push.mockReset(); mocks.replace.mockReset(); HTMLElement.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); document.documentElement.removeAttribute('data-phone-layout'); });

describe('compact desktop Field', () => {
  it('uses canonical prep state and existing toggle actions without a second checklist', async () => {
    const view = render(<DesktopWorkspaceFieldSection navigationPath="/trips/trip-1/guide" />);
    expect(screen.getByText('4 / 6 complete')).toBeTruthy();
    const prep = screen.getByRole('region', { name: 'Field Prep' });
    expect(within(prep).getAllByRole('button', { pressed: true })).toHaveLength(4);
    expect(within(prep).getAllByRole('button', { pressed: false })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Daily Vehicle Permit' }));
    await waitFor(() => expect(mocks.value!.editableActions!.toggleOfflineStatus).toHaveBeenCalledWith('daily_vehicle_permit_saved'));
    mocks.value!.offlineStatus = { ...mocks.value!.offlineStatus!, daily_vehicle_permit_saved: true };
    view.rerender(<DesktopWorkspaceFieldSection navigationPath="/trips/trip-1/guide" />);
    expect(screen.getByText('5 / 6 complete')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Daily Vehicle Permit' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('preserves missing prep setup and module visibility', async () => {
    mocks.value!.offlineStatus = null;
    const view = render(<DesktopWorkspaceFieldSection navigationPath="/trips/trip-1/guide" />);
    expect(screen.queryByText('0 / 6 complete')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Maps Cached' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Set up Field Prep' }));
    await waitFor(() => expect(mocks.value!.editableActions!.initializeFieldPrep).toHaveBeenCalledWith());
    mocks.value!.data!.settings.show_offline = false;
    view.rerender(<DesktopWorkspaceFieldSection navigationPath="/trips/trip-1/guide" />);
    expect(screen.queryByRole('region', { name: 'Field Prep' })).toBeNull();
  });

  it('preserves model order and severities while progressively rendering notice bodies', () => {
    render(<DesktopWorkspaceFieldSection navigationPath="/trips/trip-1/guide" />);
    expect(document.querySelectorAll('[data-field-notice]')).toHaveLength(3);
    expect(document.querySelectorAll('[data-field-notice-body]')).toHaveLength(0);
    expect(document.querySelector('[data-field-notice="notice-0"]')?.getAttribute('data-severity')).toBe('critical');
    expect(document.querySelector('[data-field-notice="notice-1"]')?.getAttribute('data-severity')).toBe('warning');
    const button = screen.getByRole('button', { name: 'View notice: Highland Falls bridge closure' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(button.getAttribute('aria-controls')!)?.textContent).toContain('End of notice 1.');
    expect(document.querySelectorAll('[data-field-notice-body]')).toHaveLength(1);
    fireEvent.click(button);
    expect(document.querySelectorAll('[data-field-notice-body]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 4 notices' }));
    expect([...document.querySelectorAll('[data-field-notice]')].map(node => node.getAttribute('data-field-notice'))).toEqual(['notice-0', 'notice-1', 'notice-2', 'notice-3']);
    expect(document.querySelector('[data-field-notice="notice-3"]')?.getAttribute('data-severity')).toBe('info');
    expect(document.querySelectorAll('[data-field-notice-body]')).toHaveLength(0);
  });

  it('uses shared park facts, contact formatting and literal disclosed reference text', () => {
    const value = mocks.value!;
    const model = createFieldViewModel({ data: value.data!, trip: value.trip!, alerts: value.alerts, offlineStatus: value.offlineStatus, parkIntel: value.parkIntel, manualPrep: value.readiness!.categories.offline });
    render(<DesktopWorkspaceFieldSection navigationPath="/trips/trip-1/guide" />);
    expect(screen.getByText(model.essentials.fire!)).toBeTruthy();
    expect(screen.getByText(model.essentials.water!)).toBeTruthy();
    expect(screen.getByText('70%')).toBeTruthy();
    expect(screen.getByRole('link', { name: model.essentials.ranger! }).getAttribute('href')).toBe(model.essentials.rangerHref);
    expect(screen.getByText(model.essentials.site!.notes!)).toBeTruthy();
    expect(screen.queryByText(value.parkIntel!.wildlife_notes.trim())).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Read wildlife notes' }));
    expect(screen.getByText(value.parkIntel!.wildlife_notes.trim())).toBeTruthy();
  });

  it('does not present missing park intelligence or contact details as known values', () => {
    mocks.value!.parkIntel = null;
    render(<DesktopWorkspaceFieldSection navigationPath="/trips/trip-1/guide" />);
    expect(screen.getAllByText('Not recorded')).toHaveLength(6);
    expect(screen.queryByText('0%')).toBeNull();
    expect(document.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it('uses existing refresh, manual notice, dismissal and delete mutations', async () => {
    render(<DesktopWorkspaceFieldSection navigationPath="/trips/trip-1/guide" />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh notices' }));
    await waitFor(() => expect(mocks.value!.editableActions!.refreshAlerts).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Add manual notice' }));
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Meet at the gate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Notice' }));
    await waitFor(() => expect(mocks.value!.editableActions!.addAlert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Meet at the gate', source: 'manual' })));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'View notice: Highland Falls bridge closure' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }));
    await waitFor(() => expect(mocks.value!.editableActions!.dismissAlert).toHaveBeenCalledWith('notice-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Show all 4 notices' }));
    fireEvent.click(screen.getByRole('button', { name: 'View notice: Meet at West Gate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Delete note' }));
    await waitFor(() => expect(mocks.value!.editableActions!.deleteAlert).toHaveBeenCalledWith('notice-3'));
  });

  it('edits site notes through the real park sheet and protects dirty navigation', async () => {
    render(<TripDraftGuardProvider><GuardedTripLink href="/trips/trip-1/crew">Crew destination</GuardedTripLink><DesktopWorkspaceFieldSection navigationPath="/trips/trip-1/guide" /></TripDraftGuardProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Edit park intelligence' }));
    fireEvent.change(screen.getByLabelText(/Site Notes/), { target: { value: 'Unsaved campsite note' } });
    fireEvent.click(screen.getByRole('link', { name: 'Crew destination' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stay and continue editing' }));
    expect((screen.getByLabelText(/Site Notes/) as HTMLTextAreaElement).value).toBe('Unsaved campsite note');
    expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(mocks.value!.editableActions!.updateParkIntel).toHaveBeenCalledWith(expect.objectContaining({ custom_notes: 'Unsaved campsite note' })));
  });

  it('preserves stale and unknown notice-source states', () => {
    mocks.value!.data!.alertRefresh = [{ status: 'failed', last_success_at: '2026-07-27T12:00:00Z' } as AlertRefreshState];
    const view = render(<DesktopWorkspaceFieldSection navigationPath="/trips/trip-1/guide" />);
    expect(screen.getByText(/previously confirmed notices are retained and may be stale/)).toBeTruthy();
    mocks.value!.data!.alertRefresh = null;
    mocks.value!.alerts = [];
    view.rerender(<DesktopWorkspaceFieldSection navigationPath="/trips/trip-1/guide" />);
    expect(screen.getByText('Notice synchronization status could not be loaded.')).toBeTruthy();
  });

  it('updates cached age locally and prevents cached edits', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-27T12:00:59Z'));
    mocks.value = fixture(false);
    render(<TripWorkspaceStatusProvider value={{ source: 'cache', connectivity: 'offline', cachedAt: null, lastOnlineVerifiedAt: null, reload: vi.fn() }}>
      <DesktopWorkspaceFieldSection navigationPath="/trips/trip-1/guide" />
    </TripWorkspaceStatusProvider>);
    expect(screen.getByText('Cached · last checked just now')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('Cached · last checked 1m ago')).toBeTruthy();
    for (const { label } of FIELD_PREP_CHECKS) expect((screen.getByRole('button', { name: label }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Edit park|Add manual|Refresh notices/ })).toBeNull();
  });

  it.each(['', '/plan', '/gear', '/crew', '/guide'])('composes five domains for %s and leaves auxiliary Field Log separate', suffix => {
    mocks.value = fixture(false);
    render(<PhoneLayoutProvider><div data-desktop-trip-workspace><DesktopWorkspaceDocument tripId="trip-1" pathname={`/trips/trip-1${suffix}`} /></div></PhoneLayoutProvider>);
    const headings = [screen.getByRole('heading', { level: 1 }), ...['Plan', 'Gear', 'Crew', 'Field'].map(name => screen.getByRole('heading', { level: 2, name }))];
    headings.slice(1).forEach((heading, index) => expect(headings[index].compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(desktopSectionHeading('/trips/trip-1/field-log', 'trip-1')).toBeNull();
    expect(document.querySelector('[data-field-composition="desktop"]')).toBeNull();
    expect(document.querySelectorAll('[data-field-composition="compact-desktop"]')).toHaveLength(1);
  });

  it.each([390, 956])('keeps real mobile Field at phone width %s', width => {
    vi.stubGlobal('innerWidth', width);
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    render(<PhoneLayoutProvider><TripGuidePage /></PhoneLayoutProvider>);
    expect(window.matchMedia).toHaveBeenCalledWith(PHONE_LAYOUT_MEDIA_QUERY);
    expect(document.querySelector('[data-field-composition="mobile"]')).toBeTruthy();
    expect(document.querySelector('[data-field-composition="compact-desktop"]')).toBeNull();
  });

  it('keeps Field in document flow with scoped styles', () => {
    const css = readFileSync('src/components/field/desktopWorkspaceField.css', 'utf8');
    expect(css).toContain('@scope ([data-desktop-trip-workspace] .desktop-workspace-field)');
    expect(css).not.toMatch(/overflow-y|\b(?:min-|max-)?height:\s*[^;]*(?:vh|dvh)/);
  });
});
