// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Alert } from '@/types';
import PriorityAlertCard, {
  priorityAlertDisplayTitle,
  priorityAlertSummary,
} from './PriorityAlertCard';

const LONG_BODY =
  'Strong winds are expected across the access corridor through the afternoon and evening. Secure loose equipment and delay exposed crossings when conditions worsen. Continue monitoring the full field guide notice for updates.';

function alert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alert-1',
    trip_id: 'trip-1',
    title: 'High wind watch for the access corridor',
    body: LONG_BODY,
    severity: 'watch',
    is_active: true,
    dismissed_at: null,
    created_at: '2026-07-27T12:00:00Z',
    updated_at: '2026-07-27T12:30:00Z',
    ...overrides,
  } as Alert;
}

afterEach(cleanup);

describe('PriorityAlertCard', () => {
  it('shows one priority notice with a presentation-limited summary and Guide link', () => {
    render(
      <PriorityAlertCard
        alert={alert()}
        href="/trips/trip-1/guide"
      />
    );

    expect(screen.getByText('watch')).toBeTruthy();
    expect(screen.getByText('High wind watch for the access corridor')).toBeTruthy();
    expect(screen.queryByText(LONG_BODY)).toBeNull();
    expect(
      screen.getByText(
        'Strong winds are expected across the access corridor through the afternoon and evening.'
      )
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'View all field guide notices' }).getAttribute(
        'href'
      )
    ).toBe('/trips/trip-1/guide');
  });

  it('truncates only the presentation copy at a word boundary', () => {
    const summary = priorityAlertSummary(LONG_BODY, 80);

    expect(summary.endsWith('…')).toBe(true);
    expect(summary.length).toBeLessThanOrEqual(81);
    expect(LONG_BODY).toContain('Continue monitoring');
  });

  it('derives concise assistance copy without mutating canonical alert data', () => {
    const canonical = alert({
      title:
        'Park Notice For Highway 60 Corridor Campgrounds: If you need assistance in a campground and would like to speak to a Park Warden',
      body:
        'If you need assistance, call or text a Park Warden using the contact details in the field guide.',
      severity: 'critical',
    });
    const canonicalTitle = canonical.title;
    const canonicalBody = canonical.body;

    render(<PriorityAlertCard alert={canonical} href="/trips/trip-1/guide" />);

    expect(screen.getByText('Highway 60 Campground Assistance')).toBeTruthy();
    expect(
      screen.getByText(
        'Park staff contact information is available for campers who need help.'
      )
    ).toBeTruthy();
    expect(screen.queryByText(canonicalTitle)).toBeNull();
    expect(screen.queryByText(canonicalBody)).toBeNull();
    expect(
      screen.getByRole('status', {
        name: 'critical priority notice: Highway 60 Campground Assistance',
      })
    ).toBeTruthy();
    expect(canonical.title).toBe(canonicalTitle);
    expect(canonical.body).toBe(canonicalBody);
  });

  it('falls back to a word-boundary title when no concise topic is derivable', () => {
    const title =
      'Notice about changing access conditions across several remote entry points and portage routes';

    expect(priorityAlertDisplayTitle(title, LONG_BODY, 52)).toBe(
      'changing access conditions across several remote…'
    );
  });

  it('preserves the no-notice state', () => {
    render(<PriorityAlertCard alert={null} href="/trips/trip-1/guide" />);

    expect(screen.getByText('No active notices')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
