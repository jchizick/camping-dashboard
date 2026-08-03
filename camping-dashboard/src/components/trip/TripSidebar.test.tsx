// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRIP_PRIMARY_DESTINATIONS } from './tripNavigation';

const mocks = vi.hoisted(() => ({ pathname: '/trips/trip-1' }));

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));

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
      onMissionBrief={vi.fn()}
      onProjectIntel={vi.fn()}
      onSignOut={vi.fn()}
    />
  );
}

describe('TripSidebar', () => {
  it('renders the canonical destinations in order and keeps Field Log in More', () => {
    renderSidebar();
    const sidebar = screen.getByTestId('wide-trip-sidebar-shell');
    const nav = within(sidebar).getByRole('navigation', { name: 'Trip sections' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent?.replace('(current)', '')))
      .toEqual(TRIP_PRIMARY_DESTINATIONS.map(({ label }) => label));
    expect(within(nav).getByRole('link', { name: /Home/ }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).queryByRole('link', { name: 'Field Log' })).toBeNull();

    fireEvent.click(within(sidebar).getByRole('button', { name: 'More' }));
    expect(within(sidebar).getByRole('menuitem', { name: 'Field Log' })).toBeTruthy();
  });

  it('uses the shared nested-route active-state helper', () => {
    mocks.pathname = '/trips/trip-1/guide/notices/notice-1';
    renderSidebar();
    expect(screen.getByRole('link', { name: /Guide/ }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: /Home/ }).getAttribute('aria-current')).toBeNull();
  });

  it('keeps long identity text present without changing its accessible content', () => {
    render(
      <TripSidebar
        tripId="trip-1"
        tripName="A deliberately long Algonquin backcountry expedition name"
        tripLocation="A deliberately long campsite location near Maple Leaf Lake · Site 4"
        onMissionBrief={vi.fn()}
        onProjectIntel={vi.fn()}
        onSignOut={vi.fn()}
      />
    );
    expect(screen.getByText(/deliberately long Algonquin/)).toBeTruthy();
    expect(screen.getByText(/deliberately long campsite/)).toBeTruthy();
  });
});
