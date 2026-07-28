import { describe, expect, it } from 'vitest';
import type { Alert, TimelineEvent, TripDashboard } from '@/types';
import {
  getHomeScheduleSummary,
  getPriorityAlert,
} from './homeSelectors';

function event(overrides: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: 'event-1',
    trip_id: 'trip-1',
    day_number: 1,
    event_time: '09:00',
    title: 'Launch',
    details: '',
    sort_order: 10,
    phase: null,
    ...overrides,
  } as TimelineEvent;
}

function alert(overrides: Partial<Alert>): Alert {
  return {
    id: 'alert-1',
    trip_id: 'trip-1',
    title: 'Notice',
    body: 'Notice body',
    severity: 'info',
    is_active: true,
    dismissed_at: null,
    created_at: '2026-07-01T12:00:00Z',
    ...overrides,
  } as Alert;
}

const trip = {
  start_date: '2026-07-10',
  end_date: '2026-07-12',
} as TripDashboard;

describe('Home schedule selection', () => {
  it('selects the matching day_number during the trip and preserves phase values', () => {
    const nullPhase = event({ id: 'null', day_number: 2, phase: null });
    const explicitNone = event({
      id: 'none',
      day_number: 2,
      phase: 'None',
      sort_order: 20,
    });
    const summary = getHomeScheduleSummary({
      trip,
      tripDays: 3,
      timeline: [explicitNone, nullPhase],
      now: new Date(2026, 6, 11, 12),
    });

    expect(summary.label).toBe('Today');
    expect(summary.dayNumber).toBe(2);
    expect(summary.events.map((item) => item.phase)).toEqual([null, 'None']);
  });

  it('uses the first applicable event day before the trip', () => {
    const summary = getHomeScheduleSummary({
      trip,
      tripDays: 3,
      timeline: [event({ day_number: 2 })],
      now: new Date(2026, 6, 8, 12),
    });

    expect(summary.label).toBe('Next up');
    expect(summary.dayNumber).toBe(2);
  });

  it('uses day one before the trip when no events exist', () => {
    const summary = getHomeScheduleSummary({
      trip,
      tripDays: 3,
      timeline: [],
      now: new Date(2026, 6, 8, 12),
    });

    expect(summary.label).toBe('Next up');
    expect(summary.dayNumber).toBe(1);
    expect(summary.events).toEqual([]);
  });

  it('uses the final canonical trip day after the trip', () => {
    const summary = getHomeScheduleSummary({
      trip,
      tripDays: 3,
      timeline: [event({ day_number: 3, title: 'Pack out' })],
      now: new Date(2026, 6, 14, 12),
    });

    expect(summary.label).toBe('Trip complete');
    expect(summary.dayNumber).toBe(3);
    expect(summary.events[0].title).toBe('Pack out');
  });

  it('sorts by sort_order, keeps event_time, and limits the preview', () => {
    const summary = getHomeScheduleSummary({
      trip,
      tripDays: 3,
      timeline: [
        event({ id: 'third', sort_order: 30, event_time: '13:00' }),
        event({ id: 'first', sort_order: 10, event_time: '08:30' }),
        event({ id: 'second', sort_order: 20, event_time: '10:15' }),
      ],
      now: new Date(2026, 6, 10, 12),
      limit: 2,
    });

    expect(summary.events.map((item) => [item.id, item.event_time])).toEqual([
      ['first', '08:30'],
      ['second', '10:15'],
    ]);
  });
});

describe('Home priority alert selection', () => {
  it.each([
    ['critical', 'warning'],
    ['warning', 'watch'],
    ['watch', 'advisory'],
    ['advisory', 'info'],
  ] as const)('%s beats %s', (higher, lower) => {
    expect(
      getPriorityAlert([
        alert({ id: 'lower', severity: lower }),
        alert({ id: 'higher', severity: higher }),
      ])?.id
    ).toBe('higher');
  });

  it('uses the newest alert within the same severity', () => {
    expect(
      getPriorityAlert([
        alert({ id: 'older', severity: 'warning', created_at: '2026-07-01T12:00:00Z' }),
        alert({ id: 'newer', severity: 'warning', created_at: '2026-07-02T12:00:00Z' }),
      ])?.id
    ).toBe('newer');
  });

  it('excludes inactive and dismissed alerts and safely returns null', () => {
    expect(
      getPriorityAlert([
        alert({ severity: 'critical', is_active: false }),
        alert({ severity: 'warning', dismissed_at: '2026-07-02T12:00:00Z' }),
      ])
    ).toBeNull();
    expect(getPriorityAlert([])).toBeNull();
  });
});
