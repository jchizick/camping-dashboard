// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserTrip } from '@/lib/fetchDashboard';
const mocks = vi.hoisted(() => ({ fetchList: vi.fn(), push: vi.fn(), replace: vi.fn(), phone: false, source: 'online', connectivity: 'online' }));
vi.mock('@/lib/authContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/lib/fetchDashboard', () => ({ fetchUserTrips: mocks.fetchList }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }), usePathname: () => '/trips/current' }));
vi.mock('@/components/trip/PhoneLayoutProvider', () => ({ usePhoneLayout: () => mocks.phone }));
vi.mock('@/components/trip/TripWorkspaceStatus', () => ({ useOptionalTripWorkspaceStatus: () => ({ source: mocks.source, connectivity: mocks.connectivity }) }));
import { TripListProvider } from './TripListProvider';
import TripSwitcher from './TripSwitcher';
import { TripDraftGuardProvider, useTripDraftGuard } from '@/components/trip/TripDraftGuardProvider';
const trip = (id: string, role = 'owner', start = '2026-07-05', end = '2026-07-09') => ({ id, name: id, role, start_date: start, end_date: end, lake_name: 'Maple Lake', site_name: 'Site 4' }) as UserTrip;
function DirtyDraft() {
  const { registerDraft, setDraftDirty } = useTripDraftGuard();
  useEffect(() => { const unregister = registerDraft('draft'); setDraftDirty('draft', true); return unregister; }, [registerDraft, setDraftDirty]);
  return <input aria-label="Workspace draft" defaultValue="Unsaved" />;
}
function mount(dirty = false) {
  return render(<TripListProvider><TripDraftGuardProvider>{dirty && <DirtyDraft />}<input aria-label="Persistent workspace" defaultValue="Keep me" /><TripSwitcher tripId="current" tripName="Current expedition" tripLocation="Maple Lake · Site 4" /></TripDraftGuardProvider></TripListProvider>);
}
async function open() { fireEvent.click(screen.getByRole('button', { name: 'Switch trip: Current expedition' })); await screen.findByRole('dialog'); }
async function manage() { await open(); fireEvent.click(await screen.findByRole('button', { name: 'Manage trips' })); }
beforeEach(() => {
  mocks.phone = false; mocks.source = 'online'; mocks.connectivity = 'online';
  mocks.fetchList.mockReset(); mocks.push.mockReset(); mocks.replace.mockReset();
  mocks.fetchList.mockResolvedValue([trip('current'), trip('other')]);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('TripSwitcher', () => {
  it('shows one current trip without a navigation link and offers guarded New Trip', async () => {
    mocks.fetchList.mockResolvedValue([trip('current')]); mount(); await open();
    const row = await screen.findByText('current', { selector: 'strong' });
    expect(row.closest('[aria-current]')).toBeTruthy();
    expect(row.closest('a')).toBeNull();
    fireEvent.click(row); expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: 'New Trip' }));
    expect(mocks.push).toHaveBeenCalledWith('/trips/new');
  });
  it('orders groups canonically and retains invalid dates and full long names', async () => {
    const long = 'A very long expedition name that must remain distinguishable from every other trip in the chooser';
    mocks.fetchList.mockResolvedValue([trip('z', 'viewer', '2999-07-09', '2999-07-10'), trip(long, 'viewer', 'bad', 'bad'), trip('a', 'editor', '2999-07-06', '2999-07-07'), trip('current')]);
    mount(); await open(); await screen.findByText(long, { selector: 'strong' });
    const upcoming = screen.getByRole('region', { name: 'Upcoming' });
    expect(within(upcoming).getAllByRole('link').map((link) => link.querySelector('strong')?.textContent)).toEqual(['a', 'z']);
    expect(within(screen.getByRole('region', { name: 'Dates unavailable' })).getByRole('link').textContent).toContain(long);
  });
  it('uses the real draft guard for switching and leaves workspace mounted', async () => {
    mount(true); const input = screen.getByLabelText('Persistent workspace'); await open();
    fireEvent.click(await screen.findByRole('link', { name: /other/ }));
    expect(await screen.findByRole('alertdialog')).toBeTruthy(); expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes and continue' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/trips/other'));
    expect(screen.getByLabelText('Persistent workspace')).toBe(input);
  });
  it('keeps loading and failures local and allows retry', async () => {
    mocks.fetchList.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([trip('current')]);
    mount(); await open(); expect(await screen.findByText('Trips unavailable. Please try again.')).toBeTruthy();
    expect(screen.queryByText('No trips are available in this account.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' })); await screen.findByText('current', { selector: 'strong' });
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it('shows loading rather than a false empty state', async () => {
    mocks.fetchList.mockReturnValue(new Promise(() => {})); mount(); await open();
    expect(screen.getByText('Loading your trips…')).toBeTruthy();
    expect(screen.getByLabelText('Persistent workspace')).toBeTruthy();
  });
  it('shows a successful empty state', async () => {
    mocks.fetchList.mockResolvedValue([]); mount(); await open();
    expect(await screen.findByText('No trips are available in this account.')).toBeTruthy();
  });
  it('keeps all twelve trips available in the bounded list', async () => {
    mocks.fetchList.mockResolvedValue(Array.from({ length: 12 }, (_, index) => trip(`trip-${index}`, 'viewer')));
    mount(); await open();
    await screen.findByText('trip-11', { selector: 'strong' });
    expect(document.querySelectorAll('.trip-chooser-list .trip-chooser-trip')).toHaveLength(12);
  });
  it('uses the existing phone sheet', async () => {
    mocks.phone = true; mount(); await open();
    expect(screen.getByRole('dialog').classList.contains('crud-sheet')).toBe(true);
    expect(document.querySelector('.trip-chooser-popover')).toBeNull();
  });
  it('does not request a network list or expose unavailable offline actions', async () => {
    mocks.source = 'cache'; mocks.connectivity = 'offline'; mount(); await open();
    expect(screen.getByText(/Reconnect to switch/)).toBeTruthy();
    expect(mocks.fetchList).not.toHaveBeenCalled(); expect(screen.queryByRole('link', { name: 'New Trip' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Manage trips' })).toBeNull();
  });
  it('closes on Escape and restores trigger focus', async () => {
    mount(); const trigger = screen.getByRole('button', { name: /Switch trip/ }); trigger.focus(); await open();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it('offers deletion only for owner rows', async () => {
    mocks.fetchList.mockResolvedValue([trip('current', 'viewer'), trip('editor', 'editor'), trip('owner')]); mount(); await manage();
    expect(screen.queryByRole('button', { name: 'Delete current' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete editor' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete owner' })).toBeTruthy();
  });
  it('preserves permanent-delete confirmation and cancellation', async () => {
    vi.mocked(window.confirm).mockReturnValue(false); mount(); await manage();
    fireEvent.click(screen.getByRole('button', { name: 'Delete current' }));
    expect(window.confirm).toHaveBeenCalledWith('Delete "current"? This also permanently deletes its prep-feed photos and cannot be undone.');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('protects deletion with unsaved-draft confirmation', async () => {
    mount(true); await manage(); fireEvent.click(screen.getByRole('button', { name: 'Delete current' }));
    await screen.findByRole('alertdialog'); expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stay and continue editing' }));
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps deletion failures visible', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ error: 'Deletion denied' }) } as Response);
    mount(); await manage(); fireEvent.click(screen.getByRole('button', { name: 'Delete current' }));
    expect(await screen.findByText('Deletion denied')).toBeTruthy(); expect(mocks.replace).not.toHaveBeenCalled();
  });
  it.each([
    [[trip('next', 'viewer', '2999-01-01', '2999-01-02')], '/trips/next'],
    [[], '/trips/new'],
    [[trip('invalid', 'viewer', 'bad', 'bad')], '/trips'],
  ] as [UserTrip[], string][])('refreshes membership before recovering from current deletion to %s', async (remaining, destination) => {
    mocks.fetchList.mockResolvedValueOnce([trip('current')]).mockResolvedValueOnce(remaining);
    mount(); await manage(); fireEvent.click(screen.getByRole('button', { name: 'Delete current' }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(destination));
    expect(mocks.fetchList).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith('/api/trips/current', { method: 'DELETE' });
  });
  it('uses the existing library recovery when post-delete refresh fails', async () => {
    mocks.fetchList.mockResolvedValueOnce([trip('current')]).mockRejectedValueOnce(new Error('network'));
    mount(); await manage(); fireEvent.click(screen.getByRole('button', { name: 'Delete current' }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/trips'));
  });
  it('deleting another trip refreshes only the chooser', async () => {
    mocks.fetchList.mockResolvedValueOnce([trip('current'), trip('other')]).mockResolvedValueOnce([trip('current')]);
    mount(); const input = screen.getByLabelText('Persistent workspace'); await manage();
    fireEvent.click(screen.getByRole('button', { name: 'Delete other' }));
    await waitFor(() => expect(mocks.fetchList).toHaveBeenCalledTimes(2));
    await screen.findByText('current', { selector: 'strong' });
    expect(screen.queryByRole('link', { name: /other/ })).toBeNull();
    expect(screen.getByLabelText('Persistent workspace')).toBe(input); expect(mocks.replace).not.toHaveBeenCalled();
  });
});
