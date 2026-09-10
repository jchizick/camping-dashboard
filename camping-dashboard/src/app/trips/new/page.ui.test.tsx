// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewTripContent } from './page';
import { PHONE_LAYOUT_MEDIA_QUERY } from '@/components/trip/PhoneLayoutProvider';

const push = vi.fn();
const replace = vi.fn();
const signOut = vi.fn();
const trips = vi.fn();
let search = new URLSearchParams({ from: "/trips/trip-1/gear" });
const appMocks = vi.hoisted(() => ({
  auth: {
    user: { id: 'user-1' } as { id: string } | null,
    isLoading: false,
    signOut: () => signOut(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => search,
}));

vi.mock('@/lib/fetchDashboard', () => ({ fetchUserTrips: (...args: unknown[]) => trips(...args) }));

vi.mock('@/lib/authContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => appMocks.auth,
}));

vi.mock('@/components/maps/CampsiteMapSelector', () => ({
  default: ({
    className,
    onChange,
    onManualEntry,
    mapStyle,
    desktopChrome,
  }: {
    className?: string;
    mapStyle?: string;
    desktopChrome?: boolean;
    onChange: (selection: {
      latitude: number;
      longitude: number;
      label: string;
      source: 'manual_map_selection';
      osmId: null;
    }) => void;
    onManualEntry?: () => void;
  }) => (
    <div className={className} data-testid="campsite-map" data-map-style={mapStyle} data-desktop-map-chrome={desktopChrome ? '' : undefined}>
      <button
        type="button"
        onClick={() => onChange({
          latitude: 45.653,
          longitude: -78.426,
          label: 'Maple Lake · Site 4',
          source: 'manual_map_selection',
          osmId: null,
        })}
      >
        Choose campsite
      </button>
      <button type="button" onClick={onManualEntry}>Map fallback coordinates</button>
    </div>
  ),
}));

beforeEach(() => {
  push.mockReset();
  replace.mockReset(); signOut.mockReset(); trips.mockReset();
  trips.mockResolvedValue([]);
  search = new URLSearchParams({ from: "/trips/trip-1/gear" });
  appMocks.auth.user = { id: 'user-1' };
  appMocks.auth.isLoading = false;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('authenticated Create Trip entry flow', () => {
  it('reuses the canonical authenticated trips loader while setup is loading', () => {
    appMocks.auth.isLoading = true;

    const { container } = render(<NewTripContent />);

    expect(screen.getByRole('status').textContent).toBe('PREPARING BASE CAMP…');
    expect(container.querySelector('[data-authenticated-trips-loader]')).toBeTruthy();
    expect(container.querySelector('[data-logo-part="route"]')).toBeTruthy();
    expect(container.querySelector('.animate-spin')).toBeNull();
    expect(screen.queryByText(/Preparing trip setup/i)).toBeNull();
    expect(container.querySelector('[data-entry-flow="create-trip"]')).toBeNull();
  });

  it('uses the authenticated layout hook while preserving native form semantics', () => {
    const { container } = render(<NewTripContent />);

    expect(container.querySelector('[data-entry-flow="create-trip"]')).toBeTruthy();
    const heading = screen.getByRole('heading', { level: 1, name: 'Create Trip' });
    expect(heading.getAttribute('data-mobile-type-role')).toBe('page-title');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByLabelText('Trip Name *').getAttribute('required')).not.toBeNull();
    expect(screen.getByLabelText('Start Date *').getAttribute('type')).toBe('date');
    expect(screen.getByLabelText('End Date *').getAttribute('type')).toBe('date');

    const submit = screen.getByRole('button', { name: 'Create Trip' });
    expect(submit.getAttribute('aria-describedby')).toBe('create-trip-requirements');
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/trip name, start date, end date, campsite location/i)).toBeTruthy();
  });

  it('keeps manual coordinates available and enables the unchanged create action once requirements are met', () => {
    const { container } = render(<NewTripContent />);

    fireEvent.click(screen.getByRole('button', { name: 'Enter coordinates manually' }));
    expect(screen.getByRole('region', { name: 'Enter coordinates manually' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Trip Name *'), { target: { value: 'Algonquin Backcountry' } });
    fireEvent.change(screen.getByLabelText('Start Date *'), { target: { value: '2026-09-12' } });
    fireEvent.change(screen.getByLabelText('End Date *'), { target: { value: '2026-09-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Choose campsite' }));

    const submit = screen.getByRole('button', { name: 'Create Trip' });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    expect(submit.getAttribute('aria-describedby')).toBeNull();
    expect(container.querySelector('.trip-create__location-summary')?.textContent).toContain('45.653000');
  });
});

 describe('New Trip origin and history', () => {
 it('cancels to the section with replace without loading a fallback', () => {
 render(<NewTripContent />);
 fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
 expect(replace).toHaveBeenCalledWith('/trips/trip-1/gear');
 expect(push).not.toHaveBeenCalled(); expect(trips).not.toHaveBeenCalled();
 });
 it.each(['', 'https://evil.example', '/trips/new'])('uses an authorized default for direct or rejected origin %s', async from => {
 search = new URLSearchParams({ from });
 trips.mockResolvedValue([{id:'existing',start_date:'2025-01-01',end_date:'2025-01-02'}]);
 render(<NewTripContent />);
 fireEvent.click(await screen.findByRole('button',{name:'Cancel'}));
 expect(trips).toHaveBeenCalledWith('user-1'); expect(replace).toHaveBeenCalledWith('/trips/existing');
 });
 it('has no Cancel for an empty list and permits explicit sign out', async () => {
 search = new URLSearchParams(); render(<NewTripContent />);
 await waitFor(()=>expect(trips).toHaveBeenCalled());
 expect(screen.queryByRole('button',{name:'Cancel'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Sign out'})); expect(signOut).toHaveBeenCalledOnce();
 expect(replace).not.toHaveBeenCalled();
 });
 it('distinguishes a load failure from an empty collection', async () => {
 search = new URLSearchParams(); trips.mockRejectedValue(new Error('offline'));
 render(<NewTripContent />); expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Your return trip could not be loaded. You can still create a trip or sign out.');
 expect(screen.queryByRole('button',{name:'Cancel'})).toBeNull();
 });
 it.each([true,false])('preserves submission and uses replace only on success=%s', async success => {
 const fetchMock=vi.fn().mockResolvedValue({ok:success,json:async()=>success?{tripId:'created-trip'}:{error:'Create failed'}}); vi.stubGlobal('fetch',fetchMock);
 render(<NewTripContent />);
 fireEvent.change(screen.getByLabelText('Trip Name *'),{target:{value:'Test Trip'}});
 fireEvent.change(screen.getByLabelText('Start Date *'),{target:{value:'2026-09-12'}});
 fireEvent.change(screen.getByLabelText('End Date *'),{target:{value:'2026-09-15'}});
 fireEvent.click(screen.getByRole('button',{name:'Choose campsite'}));
 fireEvent.click(screen.getByRole('button',{name:'Create Trip'}));
 await waitFor(()=>expect(fetchMock).toHaveBeenCalledOnce());
 if(success) await waitFor(()=>expect(replace).toHaveBeenCalledWith('/trips/created-trip'));
 else { expect(await screen.findByText('Create failed')).toBeTruthy(); expect(replace).not.toHaveBeenCalled(); expect(screen.getByLabelText('Trip Name *')).toHaveProperty('value','Test Trip'); }
 expect(push).not.toHaveBeenCalled();
 });
 });

it('returns unrankable direct entry to the terminating chooser route', async()=>{
 search=new URLSearchParams();trips.mockResolvedValue([{id:'existing',start_date:'invalid',end_date:'invalid'}]);render(<NewTripContent />);
 fireEvent.click(await screen.findByRole('button',{name:'Cancel'}));expect(replace).toHaveBeenCalledWith('/trips');
});

describe('standalone Create Trip responsive composition', () => {
  function phoneMedia(initial: boolean) {
    let matches = initial;
    const listeners = new Set<() => void>();
    const matchMedia = vi.fn(() => ({
      get matches() { return matches; },
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }));
    vi.stubGlobal('matchMedia', matchMedia);
    return { matchMedia, change(next: boolean) { act(() => { matches = next; listeners.forEach(listener => listener()); }); } };
  }

  it('places one map and form in the desktop panel with footer Cancel and account identity', () => {
    phoneMedia(false);
    const { container } = render(<NewTripContent />);
    expect(container.querySelector('[data-desktop-create-trip]')).toBeTruthy();
    expect(container.querySelectorAll('form')).toHaveLength(1);
    expect(screen.getAllByTestId('campsite-map')).toHaveLength(1);
    expect(screen.getByTestId('campsite-map').getAttribute('data-map-style')).toBe('expedition');
    expect(screen.getByRole('button', { name: 'Cancel' }).closest('.trip-create__submit-region')).toBeTruthy();
    expect(container.querySelector('.trip-create__account .workspace-account-identity')).toBeTruthy();
  });

  it('uses the full semantic phone predicate and preserves the phone header composition', () => {
    const media = phoneMedia(true);
    const { container } = render(<NewTripContent />);
    expect(media.matchMedia).toHaveBeenCalledWith(PHONE_LAYOUT_MEDIA_QUERY);
    expect(PHONE_LAYOUT_MEDIA_QUERY).toContain('(max-width: 956px) and (max-height: 600px) and (pointer: coarse)');
    expect(container.querySelector('[data-desktop-create-trip]')).toBeNull();
    expect(container.querySelector('.trip-create__utility')).toBeNull();
    expect(screen.getByTestId('campsite-map').getAttribute('data-map-style')).toBe('openstreetmap');
    expect(screen.getByTestId('campsite-map').hasAttribute('data-desktop-map-chrome')).toBe(false);
    expect(screen.getByRole('button', { name: 'Cancel' }).closest('header')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' }).closest('header')).toBeTruthy();
    expect(container.querySelector('.trip-create__identity > p')?.textContent).toBe('Field Protocol');
    expect(screen.getAllByTestId('campsite-map')).toHaveLength(1);
  });

  it('retains the same form, map, values and manual coordinate state when phone classification changes', () => {
    const media = phoneMedia(false);
    const { container } = render(<NewTripContent />);
    const form = container.querySelector('form');
    const map = screen.getByTestId('campsite-map');
    fireEvent.change(screen.getByLabelText('Trip Name *'), { target: { value: 'Retained trip' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter coordinates manually' }));
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '45.65' } });
    media.change(true);
    expect(map.getAttribute('data-map-style')).toBe('openstreetmap');
    expect(container.querySelector('form')).toBe(form);
    expect(screen.getByTestId('campsite-map')).toBe(map);
    expect(screen.getByLabelText('Trip Name *')).toHaveProperty('value', 'Retained trip');
    expect(screen.getByLabelText('Latitude')).toHaveProperty('value', '45.65');
    media.change(false);
    expect(map.getAttribute('data-map-style')).toBe('expedition');
    expect(screen.getByTestId('campsite-map')).toBe(map);
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(1);
  });

  it('associates the existing end-date validation error with its input', () => {
    render(<NewTripContent />);
    fireEvent.change(screen.getByLabelText('Start Date *'), { target: { value: '2026-09-15' } });
    fireEvent.change(screen.getByLabelText('End Date *'), { target: { value: '2026-09-12' } });
    const end = screen.getByLabelText('End Date *');
    expect(end.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(end.getAttribute('aria-describedby')!)?.textContent).toBe('End date cannot be before start date.');
    expect(screen.getByRole('button', { name: 'Create Trip' })).toHaveProperty('disabled', true);
    fireEvent.change(end, { target: { value: '2026-09-16' } });
    expect(end.getAttribute('aria-describedby')).toBeNull();
  });
});
