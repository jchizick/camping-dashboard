// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { GearItem, TimelineEvent, WeatherCurrent } from '@/types';
import { evaluateReadiness } from '@/lib/readiness';
import TripSituationRail from './TripSituationRail';

const readiness = evaluateReadiness({
  tripId: 'trip-1',
  tripDays: 1,
  gear: [{
    id: 'gear-1',
    name: 'Tent',
    priority: 'critical',
    acquired: true,
    packed: true,
  } as GearItem],
  meals: [],
  timeline: [],
  currentWeather: null,
  forecast: [],
  offlineStatus: null,
  modules: { mealsEnabled: false, offlineEnabled: false },
});
const unavailableReadiness = evaluateReadiness({
  tripId: 'trip-1',
  tripDays: 1,
  gear: [],
  meals: [],
  timeline: [],
  currentWeather: null,
  forecast: [],
  offlineStatus: null,
  modules: { mealsEnabled: false, offlineEnabled: false },
});

const weather = {
  trip_id: 'trip-1',
  temperature_c: 16,
  condition_label: 'Clear',
  sunset_time: '20:49',
  icon: 'clear',
  updated_at: '2026-07-28T12:00:00Z',
} as WeatherCurrent;

const event = {
  id: 'event-1',
  trip_id: 'trip-1',
  day_number: 2,
  event_time: '10:30',
  title: 'Arrive at access point',
  sort_order: 10,
  phase: null,
} as TimelineEvent;

afterEach(cleanup);

describe('TripSituationRail', () => {
  it('renders exactly the four canonical situation metrics', () => {
    render(
      <TripSituationRail
        weather={weather}
        readiness={readiness}
        schedule={{ label: 'Today', dayNumber: 2, events: [event] }}
      />
    );

    const rail = screen.getByRole('region', { name: 'Current trip situation' });
    for (const label of ['Weather', 'Readiness', 'Sunset', 'Next event']) {
      expect(within(rail).getByText(label)).toBeTruthy();
    }
    expect(within(rail).getByText('16°C')).toBeTruthy();
    expect(within(rail).getByText('100%')).toBeTruthy();
    expect(within(rail).getByText('20:49')).toBeTruthy();
    expect(within(rail).getByText('10:30')).toBeTruthy();
    expect(within(rail).getByText('Arrive at access point')).toBeTruthy();
  });

  it('shows restrained unavailable states without inventing values', () => {
    render(
      <TripSituationRail
        weather={null}
        readiness={unavailableReadiness}
        schedule={{ label: 'Next up', dayNumber: 1, events: [] }}
      />
    );

    expect(screen.getAllByText('Unavailable')).toHaveLength(4);
    expect(screen.queryByRole('progressbar', { name: 'Current trip readiness' })).toBeNull();
    expect(screen.getByText('No event scheduled')).toBeTruthy();
  });
});
