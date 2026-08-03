// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/trips/trip-1/field-log' }));

import TripMoreMenu from './TripMoreMenu';

afterEach(cleanup);

function renderMenu() {
  return render(
    <TripMoreMenu
      id="test-more"
      tripId="trip-1"
      onMissionBrief={vi.fn()}
      onProjectIntel={vi.fn()}
      onSignOut={vi.fn()}
    />
  );
}

describe('TripMoreMenu', () => {
  it('preserves the existing items, roles, routes, and Field Log current state', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('menu', { name: 'More trip actions' })).toBeTruthy();
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Field Log',
      'Mission Brief',
      'About this app',
      'Sign out',
    ]);
    const fieldLog = screen.getByRole('menuitem', { name: 'Field Log' });
    expect(fieldLog.getAttribute('href')).toBe('/trips/trip-1/field-log');
    expect(fieldLog.getAttribute('aria-current')).toBe('page');
  });

  it('closes on Escape and restores focus to the trigger', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'More' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on an outside pointer interaction', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
