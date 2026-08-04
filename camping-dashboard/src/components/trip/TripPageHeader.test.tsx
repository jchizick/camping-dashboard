// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Card } from '@/components/ui/Primitives';
import TripPageHeader, { TripSectionEmptyState, TripSectionPage } from './TripPageHeader';

afterEach(cleanup);

describe('TripPageHeader and section surfaces', () => {
  it('preserves one focusable primary route heading and supporting copy', () => {
    render(
      <TripSectionPage route="plan">
        <TripPageHeader title="Plan" description="Schedule and meals" />
      </TripSectionPage>
    );

    const heading = screen.getByRole('heading', { level: 1, name: 'Plan' });
    expect(heading.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByText('Schedule and meals')).toBeTruthy();
    expect(document.querySelector('[data-trip-section="plan"]')).toBeTruthy();
  });

  it('keeps empty states announced inside the scoped visual system', () => {
    render(<TripSectionEmptyState>No crew data is available.</TripSectionEmptyState>);
    expect(screen.getByRole('status').classList.contains('trip-section-empty-state')).toBe(true);
  });

  it('leaves the default shared Card primitive available without workspace classes', () => {
    const { container } = render(<Card>Unmigrated card</Card>);
    const card = container.firstElementChild;
    expect(card?.classList.contains('bg-card-bg')).toBe(true);
    expect(card?.classList.contains('trip-section-surface')).toBe(false);
    expect(card?.classList.contains('home-glass-surface')).toBe(false);
  });
});
