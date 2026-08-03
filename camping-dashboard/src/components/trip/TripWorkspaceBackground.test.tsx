// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({ fill, priority, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    void fill;
    void priority;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img {...props} alt={alt ?? ''} />
    );
  },
}));

import TripWorkspaceBackground from './TripWorkspaceBackground';

afterEach(cleanup);

describe('TripWorkspaceBackground', () => {
  it('renders the approved scene as decorative and non-interactive', () => {
    const { container } = render(
      <TripWorkspaceBackground
        trip={{ park_name: 'Algonquin Park', lake_name: 'Maple Lake' }}
      />
    );

    const background = container.querySelector('.trip-workspace-background');
    const image = container.querySelector('img');
    expect(background?.getAttribute('aria-hidden')).toBe('true');
    expect(background?.getAttribute('data-background-state')).toBe('image');
    expect(image?.getAttribute('src')).toBe('/sunset-over-the-lake.webp');
    expect(image?.getAttribute('alt')).toBe('');
  });

  it.each([
    [null, 'missing identity'],
    [{ park_name: 'Killarney Provincial Park', lake_name: 'Maple Lake' }, 'unapproved identity'],
  ])('uses the atmospheric fallback for %s', (trip, reason) => {
    void reason;
    const { container } = render(<TripWorkspaceBackground trip={trip} />);
    expect(container.querySelector('[data-background-state="fallback"]')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('falls back when the approved image fails to load', () => {
    const { container } = render(
      <TripWorkspaceBackground
        trip={{ park_name: 'Algonquin Park', lake_name: 'Maple Lake' }}
      />
    );
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('[data-background-state="fallback"]')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });
});
