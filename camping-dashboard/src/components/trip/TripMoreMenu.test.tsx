// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/authContext', () => ({ useAuth: () => ({ user: null, identity: null }) }));

vi.mock('next/navigation', () => ({ usePathname: () => '/trips/trip-1/field-log' }));
import TripMoreMenu from './TripMoreMenu';
afterEach(cleanup);
const mount = (mobile = false) => render(<TripMoreMenu id="extras" tripId="trip-1" onProjectIntel={vi.fn()} onSignOut={vi.fn()} mobile={mobile} />);
describe('Trip extras', () => {
  it('exposes only guarded Field Log on desktop', () => {
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Trip Extras' }));
    expect(screen.getByRole('dialog', { name: 'Trip Extras' })).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Field Log' });
    expect(link.getAttribute('href')).toBe('/trips/trip-1/field-log');
    expect(link.getAttribute('aria-current')).toBe('page');
    for (const label of ['Appearance', 'Mission Brief', 'About Field Protocol', 'Sign out']) expect(screen.queryByText(label)).toBeNull();
  });
  it('focuses the dialog, closes on Escape and returns focus', async () => {
    mount(); const trigger = screen.getByRole('button', { name: 'Trip Extras' }); trigger.focus(); fireEvent.click(trigger);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close Trip Extras' })));
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger);
  });
  it('dismisses on outside pointer interaction', () => {
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Trip Extras' }));
    fireEvent.pointerDown(document.querySelector('.workspace-popover-overlay')!); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('groups phone extras and account in the existing sheet', () => {
    mount(true); fireEvent.click(screen.getByRole('button', { name: 'More trip actions' }));
    expect(screen.getByRole('dialog', { name: 'More' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Account' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'About Field Protocol' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.queryByText('Appearance')).toBeNull();
    expect(document.querySelector('.workspace-popover')).toBeNull();
  });
});
