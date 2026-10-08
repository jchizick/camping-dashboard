// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TripEssentials } from '../../../scripts/previews/workspace/adapters/TripEssentials';

afterEach(cleanup);

describe('fictional workspace module coverage', () => {
  it.each([
    ['Gear', 'Items ready', 'ready', 12, 15, '80%'],
    ['Meals', 'Days planned', 'planned', 4, 4, '100%'],
    ['Crew', 'People assigned', 'assigned', 3, 4, '75%'],
  ] as const)('keeps %s counts, annotations and progress consistent', (label, descriptor, unit, count, total, fill) => {
    render(<TripEssentials />);
    expect(screen.getByRole('heading', { name: label })).toBeTruthy();
    expect(screen.getByText(descriptor)).toBeTruthy();
    const meter = screen.getByRole('meter', { name: label + ' coverage' });
    expect(meter.getAttribute('aria-valuenow')).toBe(String(count));
    expect(meter.getAttribute('aria-valuemax')).toBe(String(total));
    expect((meter.firstElementChild as HTMLElement).style.width).toBe(fill);
    const fraction = screen.getByLabelText(count + ' of ' + total + ' ' + unit);
    expect(fraction.firstElementChild?.textContent).toBe(count + unit);
    expect(fraction.lastElementChild?.textContent).toBe(total + 'total');
  });

  it('presents one coverage rail without navigation or focusable controls', () => {
    const { container } = render(<TripEssentials />);
    expect(screen.getByRole('heading', { name: 'Trip essentials' })).toBeTruthy();
    expect(screen.getByText('COVERAGE COUNTERS')).toBeTruthy();
    expect(screen.getAllByRole('meter')).toHaveLength(3);
    expect(container.querySelector('a,button,input,select,textarea,[tabindex]')).toBeNull();
  });
});
