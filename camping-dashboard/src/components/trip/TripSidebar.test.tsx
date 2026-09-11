// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRIP_PRIMARY_DESTINATIONS } from './tripNavigation';

const mocks = vi.hoisted(() => ({ pathname: '/trips/trip-1' }));

vi.mock('@/lib/authContext', () => ({ useAuth: () => ({ user: null, identity: null }) }));

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('@/components/trips/TripSwitcher', () => ({
  default: ({ tripName, tripLocation }: { tripName: string; tripLocation: string }) =>
    <button type="button">{tripName}<span>{tripLocation}</span></button>,
}));

import TripSidebar from './TripSidebar';

beforeEach(() => {
  mocks.pathname = '/trips/trip-1';
});

afterEach(cleanup);

function renderSidebar() {
  return render(
    <TripSidebar
      tripId="trip-1"
      tripName="Maple Lake Weekend"
      tripLocation="Maple Lake · Site 4"
      onProjectIntel={vi.fn()}
      onSignOut={vi.fn()}
    />
  );
}

describe('TripSidebar', () => {
  it('marks exactly one observed section current while retaining guarded route destinations', () => {
    let notify: IntersectionObserverCallback = () => {};
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        if (options) notify = callback;
      }
      observe() {} disconnect() {}
    });
    const fixture = document.createElement('div');
    fixture.setAttribute('data-desktop-workspace-document', '');
    fixture.innerHTML = ['overview', 'plan', 'gear', 'crew', 'field'].map(name => `<section><h2 id="desktop-${name}-title"></h2></section>`).join('');
    document.body.append(fixture);
    let active = 0;
    fixture.querySelectorAll('section').forEach((section, index) => {
      section.getBoundingClientRect = () => ({ top: index <= active ? 0 : 500 }) as DOMRect;
    });
    renderSidebar();
    const nav = screen.getByRole('navigation', { name: 'Trip sections' });
    for (const index of [0, 1, 2, 3, 4, 3, 2, 1, 0]) {
      active = index;
      act(() => notify([], {} as IntersectionObserver));
      const links = within(nav).getAllByRole('link');
      expect(links.filter(link => link.getAttribute('aria-current') === 'page')).toEqual([links[index]]);
      expect(links[2].getAttribute('href')).toBe('/trips/trip-1/gear');
    }
    fixture.remove();
    vi.unstubAllGlobals();
  });
  it('renders the canonical destinations in order and keeps Field Log in More', () => {
    renderSidebar();
    const sidebar = screen.getByTestId('wide-trip-sidebar-shell');
    const nav = within(sidebar).getByRole('navigation', { name: 'Trip sections' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent?.replace('(current)', '')))
      .toEqual(TRIP_PRIMARY_DESTINATIONS.map(({ label, segment }) => segment === '' ? 'Overview' : label));
    expect(within(nav).getByRole('link', { name: /Overview/ }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).queryByRole('link', { name: 'Field Log' })).toBeNull();

    fireEvent.click(within(sidebar).getByRole('button', { name: 'Trip Extras' }));
    expect(screen.getByRole('link', { name: 'Field Log' })).toBeTruthy();
  });

  it('uses the shared nested-route active-state helper', () => {
    mocks.pathname = '/trips/trip-1/guide/notices/notice-1';
    renderSidebar();
    expect(within(screen.getByRole('navigation', { name: 'Trip sections' })).getByRole('link', { name: /Field/ }).getAttribute('aria-current')).toBe('page');
    expect(within(screen.getByRole('navigation', { name: 'Trip sections' })).getByRole('link', { name: /Overview/ }).getAttribute('aria-current')).toBeNull();
  });

  it('keeps long identity text present without changing its accessible content', () => {
    render(
      <TripSidebar
        tripId="trip-1"
        tripName="A deliberately long Algonquin backcountry expedition name"
        tripLocation="A deliberately long campsite location near Maple Leaf Lake · Site 4"
        onProjectIntel={vi.fn()}
        onSignOut={vi.fn()}
      />
    );
    expect(screen.getByText(/deliberately long Algonquin/)).toBeTruthy();
    expect(screen.getByText(/deliberately long campsite/)).toBeTruthy();
  });
});
