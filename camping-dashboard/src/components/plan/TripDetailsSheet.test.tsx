// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TripDashboard } from '@/types';
import TripDetailsSheet from './TripDetailsSheet';

const trip = {
  id: 'trip-1',
  name: 'Maple Lake Weekend',
  park_name: 'Algonquin Park',
  lake_name: 'Maple Lake',
  site_name: 'Site 4',
  start_date: '2026-08-01',
  end_date: '2026-08-05',
  map_style: null,
  theme_mode: null,
} as TripDashboard;

afterEach(cleanup);

describe('TripDetailsSheet', () => {
  it('edits existing destination, campsite, and date fields through one mutation', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <TripDetailsSheet
        isOpen
        trip={trip}
        latestPlannedDay={3}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText('Destination'), {
      target: { value: 'Opeongo Lake' },
    });
    fireEvent.change(screen.getByLabelText('Campsite / site'), {
      target: { value: 'Site 7' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      park_name: 'Algonquin Park',
      lake_name: 'Opeongo Lake',
      site_name: 'Site 7',
      start_date: '2026-08-01',
      end_date: '2026-08-05',
    }));
  });

  it('rejects a date range that would orphan later plans', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <TripDetailsSheet
        isOpen
        trip={trip}
        latestPlannedDay={5}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-08-03' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(screen.getByRole('alert').textContent).toContain('Day 5');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects reversed dates before calling the mutation', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <TripDetailsSheet
        isOpen
        trip={trip}
        latestPlannedDay={1}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-07-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(screen.getByRole('alert').textContent).toContain(
      'End date must be on or after the start date.'
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
