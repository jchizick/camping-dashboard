// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ManualCampsiteEntry, { validateCoordinate } from './ManualCampsiteEntry';

afterEach(cleanup);

describe('manual campsite coordinate fallback', () => {
  it('validates canonical latitude and longitude ranges', () => {
    expect(validateCoordinate('45.46836', 'latitude')).toEqual({
      value: 45.46836,
      error: null,
    });
    expect(validateCoordinate('-181', 'longitude').error).toBe(
      'Longitude must be between -180 and 180.'
    );
    expect(validateCoordinate('', 'latitude').error).toBe('Latitude is required.');
  });

  it('creates a real campsite selection from accessible decimal inputs', () => {
    const onApply = vi.fn();
    render(
      <ManualCampsiteEntry
        value={null}
        suggestedLabel="Pine Lake"
        onApply={onApply}
      />
    );

    fireEvent.change(screen.getByLabelText('Latitude'), {
      target: { value: '45.46836' },
    });
    fireEvent.change(screen.getByLabelText('Longitude'), {
      target: { value: '-78.84017' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use these coordinates' }));

    expect(onApply).toHaveBeenCalledWith({
      latitude: 45.46836,
      longitude: -78.84017,
      label: 'Pine Lake',
      source: 'manual_map_selection',
      osmId: null,
    });
    expect(screen.getByText('Location ready')).toBeTruthy();
  });

  it('reports invalid values without publishing fabricated coordinates', () => {
    const onApply = vi.fn();
    render(<ManualCampsiteEntry value={null} onApply={onApply} />);

    fireEvent.change(screen.getByLabelText('Latitude'), {
      target: { value: '91' },
    });
    fireEvent.change(screen.getByLabelText('Longitude'), {
      target: { value: 'not-a-number' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use these coordinates' }));

    expect(screen.getByText('Latitude must be between -90 and 90.')).toBeTruthy();
    expect(screen.getByText('Longitude is required.')).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });
});
