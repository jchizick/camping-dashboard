// @vitest-environment jsdom

import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TripWorkspaceValue } from './TripWorkspaceProvider';

const mocks = vi.hoisted(() => ({
  pathname: '/trips/trip-1/plan',
  signOut: vi.fn(),
  trip: {
    tripId: 'trip-1',
    role: 'owner',
    canEdit: true,
    isOwner: true,
    isLoading: false,
    error: null as string | null,
  },
  workspace: null as TripWorkspaceValue | null,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock('@/lib/authContext', () => ({
  useAuth: () => ({ signOut: mocks.signOut }),
}));

vi.mock('@/lib/tripContext', () => ({
  useTrip: () => mocks.trip,
}));

vi.mock('./TripWorkspaceProvider', () => ({
  useTripWorkspace: () => mocks.workspace,
}));

vi.mock('@/components/ui/MissionBriefModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div role="dialog" aria-label="Mission Brief dialog">
        Mission Brief dialog
        <button type="button" onClick={onClose}>Close Mission Brief dialog</button>
      </div>
    ) : null,
}));

vi.mock('@/components/ui/ProjectIntelModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div role="dialog" aria-label="About dialog">
        Project Intel dialog
        <button type="button" onClick={onClose}>Close About dialog</button>
      </div>
    ) : null,
}));

import TripAppShell from './TripAppShell';

function workspaceValue(): TripWorkspaceValue {
  return {
    data: {
      settings: {},
    },
    trip: {
      id: 'trip-1',
      name: 'Maple Lake Weekend',
      park_name: 'Algonquin Park',
    },
    isLoading: false,
    error: null,
  } as unknown as TripWorkspaceValue;
}

beforeEach(() => {
  mocks.pathname = '/trips/trip-1/plan';
  mocks.trip.role = 'owner';
  mocks.trip.isOwner = true;
  mocks.trip.isLoading = false;
  mocks.trip.error = null;
  mocks.workspace = workspaceValue();
  mocks.signOut.mockReset();
});

afterEach(cleanup);

describe('TripAppShell', () => {
  it('uses one shared 768px handoff for desktop and mobile navigation', () => {
    const { container } = render(
      <TripAppShell>
        <h1>Plan</h1>
      </TripAppShell>
    );

    const desktopNavShell = screen.getByTestId('desktop-trip-navigation-shell');
    const desktopMoreShell = screen.getByTestId('desktop-trip-more-shell');
    const mobileNav = screen.getByTestId('mobile-trip-navigation');
    const mobileMoreShell = screen.getByTestId('mobile-trip-more-shell');

    expect(desktopNavShell.classList.contains('trip-navigation-desktop')).toBe(true);
    expect(desktopMoreShell.classList.contains('trip-navigation-desktop')).toBe(true);
    expect(mobileNav.classList.contains('trip-navigation-mobile-bar')).toBe(true);
    expect(mobileMoreShell.classList.contains('trip-navigation-mobile-more')).toBe(true);
    expect(container.querySelector('[data-testid="desktop-trip-navigation"]')?.classList.contains('hidden'))
      .toBe(false);

    const css = readFileSync(
      resolve(process.cwd(), 'src/app/globals.css'),
      'utf8'
    );
    expect(css).toMatch(/\.trip-navigation-desktop\s*\{\s*display:\s*none;/);
    expect(css).toMatch(/\.trip-navigation-mobile-more\s*\{\s*display:\s*block;/);
    expect(css).toMatch(/\.trip-navigation-mobile-bar\s*\{\s*display:\s*grid;/);

    const sharedHandoff = css.slice(
      css.indexOf('@media (min-width: 768px)'),
      css.indexOf('@media (max-width: 1023px)')
    );
    expect(sharedHandoff).toMatch(/\.trip-navigation-desktop\s*\{\s*display:\s*flex;/);
    expect(sharedHandoff).toMatch(
      /\.trip-navigation-mobile-more,\s*\.trip-navigation-mobile-bar\s*\{\s*display:\s*none;/
    );
    expect(sharedHandoff).toMatch(/\.trip-app-main\s*\{\s*padding-bottom:\s*0;/);
  });

  it('renders one shared header, one main landmark, and canonical navigation', () => {
    render(
      <TripAppShell>
        <h1>Plan</h1>
      </TripAppShell>
    );

    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Plan' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to trips' }).getAttribute('href')).toBe(
      '/trips'
    );

    const expectedOrder = ['Home', 'Plan', 'Gear', 'Crew', 'Guide'];
    for (const testId of ['desktop-trip-navigation', 'mobile-trip-navigation']) {
      const nav = within(screen.getByTestId(testId));
      expect(nav.getAllByRole('link').map((link) => link.textContent?.replace('(current)', '')))
        .toEqual(expectedOrder);
    }

    const activePlanLinks = screen
      .getAllByRole('link', { name: /Plan/ })
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(activePlanLinks).toHaveLength(2);

    for (const href of [
      '/trips/trip-1',
      '/trips/trip-1/plan',
      '/trips/trip-1/gear',
      '/trips/trip-1/crew',
      '/trips/trip-1/guide',
    ]) {
      expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === href))
        .toBe(true);
    }
  });

  it('keeps Field Log and all existing secondary actions in More', () => {
    render(
      <TripAppShell>
        <h1>Plan</h1>
      </TripAppShell>
    );

    fireEvent.click(screen.getAllByRole('button', { name: /More/ })[0]);
    expect(screen.getByRole('menuitem', { name: 'Field Log' }).getAttribute('href')).toBe(
      '/trips/trip-1/field-log'
    );
    expect(screen.queryByRole('menuitem', { name: /Settings/i })).toBeNull();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Mission Brief' }));
    expect(screen.getByText('Mission Brief dialog')).toBeTruthy();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close Mission Brief dialog' }));
    fireEvent.click(screen.getAllByRole('button', { name: /More/ })[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'About this app' }));
    expect(screen.getByText('Project Intel dialog')).toBeTruthy();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close About dialog' }));
    fireEvent.click(screen.getAllByRole('button', { name: /More/ })[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('clears the active information dialog when the route changes', async () => {
    const view = render(
      <TripAppShell>
        <h1>Plan</h1>
      </TripAppShell>
    );

    fireEvent.click(screen.getAllByRole('button', { name: /More/ })[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mission Brief' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    mocks.pathname = '/trips/trip-1/gear';
    view.rerender(
      <TripAppShell>
        <h1>Gear</h1>
      </TripAppShell>
    );

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows the same membership denial before any nested section content', () => {
    mocks.trip.error = 'You are not a member of this trip';
    render(
      <TripAppShell>
        <h1>Secret section</h1>
      </TripAppShell>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Access Denied' })).toBeTruthy();
    expect(screen.queryByText('Secret section')).toBeNull();
    expect(screen.getByRole('link', { name: /Back to Trips/ }).getAttribute('href')).toBe(
      '/trips'
    );
  });

  it('marks Field Log as current inside the secondary menu', () => {
    mocks.pathname = '/trips/trip-1/field-log';
    render(
      <TripAppShell>
        <h1>Field Log</h1>
      </TripAppShell>
    );

    fireEvent.click(screen.getAllByRole('button', { name: /More/ })[0]);
    expect(
      screen.getByRole('menuitem', { name: 'Field Log' }).getAttribute('aria-current')
    ).toBe('page');
  });

  it('focuses the destination heading after a client route change but not on initial load', async () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const view = render(
      <TripAppShell>
        <h1 tabIndex={-1}>Plan</h1>
      </TripAppShell>
    );

    expect(document.activeElement?.textContent).not.toBe('Plan');
    mocks.pathname = '/trips/trip-1/gear';
    view.rerender(
      <TripAppShell>
        <h1 tabIndex={-1}>Gear</h1>
      </TripAppShell>
    );

    await vi.waitFor(() =>
      expect(document.activeElement?.textContent).toBe('Gear')
    );
    await vi.waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Gear loaded')
    );
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('closes More with Escape and restores focus to its trigger', () => {
    render(
      <TripAppShell>
        <h1>Plan</h1>
      </TripAppShell>
    );

    const trigger = screen.getAllByRole('button', { name: /More/ })[0];
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps a long trip identity accessible while applying visual truncation', () => {
    const value = workspaceValue();
    value.trip!.name =
      'A deliberately long Algonquin backcountry expedition name for responsive testing';
    value.trip!.lake_name = 'Maple Lake';
    value.trip!.site_name = 'Site 4';
    mocks.workspace = value;

    const { container } = render(
      <TripAppShell>
        <h1>Plan</h1>
      </TripAppShell>
    );

    const identity = container.querySelector('.trip-shell-identity');
    expect(identity?.getAttribute('title')).toContain(value.trip!.name);
    expect(identity?.querySelector('p')?.classList.contains('truncate')).toBe(true);
    expect(identity?.textContent).toContain(value.trip!.name);
  });
});
