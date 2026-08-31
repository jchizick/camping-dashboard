// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CrewMember, TripDashboard } from '@/types';
import MobilePlanOverview from '@/components/plan/MobilePlanOverview';
import MobileCrewOverview from '@/components/crew/MobileCrewOverview';
import { PhoneLayoutProvider, usePhoneLayout } from './PhoneLayoutProvider';

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

function installStablePhoneMedia() {
  const listeners = new Set<() => void>();
  const mediaQuery = {
    matches: true,
    media: '',
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: (listener: () => void) => listeners.add(listener),
    removeListener: (listener: () => void) => listeners.delete(listener),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
  vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery));
  return {
    notifyOrientationChange() {
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

const trip = {
  id: 'trip-1',
  name: 'Maple Lake Weekend',
  park_name: 'Algonquin Park',
  lake_name: 'Maple Lake',
  site_name: 'Site 4',
  start_date: '2026-08-01',
  end_date: '2026-08-04',
} as TripDashboard;

const crewMember = {
  id: 'crew-1',
  trip_id: 'trip-1',
  trip_member_id: null,
  name: 'Jordan',
  role: 'Navigator',
  load_item: 'Route system',
  load_weight_kg: 12,
  canoe_number: 1,
  notes: 'Keeps the route card close.',
} satisfies CrewMember;

function ResponsivePlan() {
  return usePhoneLayout() ? (
    <MobilePlanOverview
      trip={trip}
      timeline={[]}
      meals={[]}
      tripDays={4}
      showMeals={false}
    />
  ) : (
    <div data-testid="desktop-plan" />
  );
}

function ResponsiveCrew() {
  return usePhoneLayout() ? (
    <MobileCrewOverview
      crew={[crewMember]}
      gear={[]}
      meals={[]}
      onUpdate={vi.fn().mockResolvedValue(undefined)}
    />
  ) : (
    <div data-testid="desktop-crew" />
  );
}

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-phone-layout');
  vi.unstubAllGlobals();
});

describe('phone orientation state retention', () => {
  it('keeps the selected Plan day while phone layout remains true', () => {
    const media = installStablePhoneMedia();
    render(
      <PhoneLayoutProvider>
        <ResponsivePlan />
      </PhoneLayoutProvider>
    );

    const plan = document.querySelector('.mobile-plan-overview');
    const selector = screen.getByRole('group', { name: 'Trip days' });
    fireEvent.click(within(selector).getByRole('button', { name: /Day 4/ }));
    expect(within(selector).getByRole('button', { name: /Day 4/ }).getAttribute('aria-pressed')).toBe('true');

    media.notifyOrientationChange();

    expect(document.querySelector('.mobile-plan-overview')).toBe(plan);
    expect(within(selector).getByRole('button', { name: /Day 4/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('desktop-plan')).toBeNull();
  });

  it('keeps an open Crew edit sheet while phone layout remains true', () => {
    const media = installStablePhoneMedia();
    render(
      <PhoneLayoutProvider>
        <ResponsiveCrew />
      </PhoneLayoutProvider>
    );

    const crew = document.querySelector('.mobile-crew-overview');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Jordan' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Crew Member' });

    media.notifyOrientationChange();

    expect(document.querySelector('.mobile-crew-overview')).toBe(crew);
    expect(screen.getByRole('dialog', { name: 'Edit Crew Member' })).toBe(dialog);
    expect(screen.queryByTestId('desktop-crew')).toBeNull();
  });
});
