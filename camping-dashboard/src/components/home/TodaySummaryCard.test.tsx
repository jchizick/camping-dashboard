// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { TimelineEvent } from '@/types';
import TodaySummaryCard from './TodaySummaryCard';

afterEach(cleanup);

describe('TodaySummaryCard responsive event copy', () => {
  it('keeps long titles and categories in the wrapping content column', () => {
    const event = {
      id: 'long-event',
      trip_id: 'trip-1',
      day_number: 2,
      event_time: '10:30',
      title: 'Review the complete emergency evacuation and alternate portage route',
      details: '',
      sort_order: 10,
      phase: 'Safety preparation and contingency planning',
    } as TimelineEvent;

    render(
      <TodaySummaryCard
        summary={{ label: 'Today', dayNumber: 2, events: [event] }}
        href="/trips/trip-1/plan"
      />
    );

    const title = screen.getByRole('heading', { level: 3, name: event.title });
    const category = screen.getByText(event.phase!);
    const contentColumn = title.parentElement;

    expect(title.classList.contains('truncate')).toBe(false);
    expect(title.classList.contains('break-words')).toBe(true);
    expect(category.classList.contains('break-words')).toBe(true);
    expect(contentColumn?.classList.contains('min-w-0')).toBe(true);
  });
});
