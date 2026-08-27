// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewTripContent } from './page';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock('@/lib/authContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ user: { id: 'user-1' }, isLoading: false }),
}));

vi.mock('@/components/maps/CampsiteMapSelector', () => ({
  default: ({
    className,
    onChange,
    onManualEntry,
  }: {
    className?: string;
    onChange: (selection: {
      latitude: number;
      longitude: number;
      label: string;
      source: 'manual_map_selection';
      osmId: null;
    }) => void;
    onManualEntry?: () => void;
  }) => (
    <div className={className} data-testid="campsite-map">
      <button
        type="button"
        onClick={() => onChange({
          latitude: 45.653,
          longitude: -78.426,
          label: 'Maple Lake · Site 4',
          source: 'manual_map_selection',
          osmId: null,
        })}
      >
        Choose campsite
      </button>
      <button type="button" onClick={onManualEntry}>Map fallback coordinates</button>
    </div>
  ),
}));

beforeEach(() => {
  push.mockReset();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('authenticated Create Trip entry flow', () => {
  it('uses the authenticated layout hook while preserving native form semantics', () => {
    const { container } = render(<NewTripContent />);

    expect(container.querySelector('[data-entry-flow="create-trip"]')).toBeTruthy();
    const heading = screen.getByRole('heading', { level: 1, name: 'Create Trip' });
    expect(heading.getAttribute('data-mobile-type-role')).toBe('page-title');
    expect(screen.getByRole('button', { name: 'Back to Trips' })).toBeTruthy();
    expect(screen.getByLabelText('Trip Name *').getAttribute('required')).not.toBeNull();
    expect(screen.getByLabelText('Start Date *').getAttribute('type')).toBe('date');
    expect(screen.getByLabelText('End Date *').getAttribute('type')).toBe('date');

    const submit = screen.getByRole('button', { name: 'Create Trip' });
    expect(submit.getAttribute('aria-describedby')).toBe('create-trip-requirements');
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/trip name, start date, end date, campsite location/i)).toBeTruthy();
  });

  it('keeps manual coordinates available and enables the unchanged create action once requirements are met', () => {
    const { container } = render(<NewTripContent />);

    fireEvent.click(screen.getByRole('button', { name: 'Enter coordinates manually' }));
    expect(screen.getByRole('region', { name: 'Enter coordinates manually' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Trip Name *'), { target: { value: 'Algonquin Backcountry' } });
    fireEvent.change(screen.getByLabelText('Start Date *'), { target: { value: '2026-09-12' } });
    fireEvent.change(screen.getByLabelText('End Date *'), { target: { value: '2026-09-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Choose campsite' }));

    const submit = screen.getByRole('button', { name: 'Create Trip' });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    expect(submit.getAttribute('aria-describedby')).toBeNull();
    expect(container.querySelector('.trip-create__location-summary')?.textContent).toContain('45.653000');
  });
});
