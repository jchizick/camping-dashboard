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
  updateThemeVariant: vi.fn(),
  reload: vi.fn(),
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

vi.mock('./TripAppearanceDialog', () => ({
  default: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label="Appearance dialog">
        Appearance dialog
        <button type="button" onClick={onClose}>Close Appearance dialog</button>
      </div>
    ) : null,
}));

import TripAppShell from './TripAppShell';

function workspaceValue(): TripWorkspaceValue {
  return {
    data: {
      settings: { theme_variant: 'expedition' },
    },
    trip: {
      id: 'trip-1',
      name: 'Maple Lake Weekend',
      park_name: 'Algonquin Park',
    },
    isLoading: false,
    error: null,
    source: 'online',
    connectivity: 'online',
    isReloading: false,
    lastOnlineVerifiedAt: '2026-08-24T12:00:00.000Z',
    reload: mocks.reload,
    editableActions: {
      updateThemeVariant: mocks.updateThemeVariant,
    },
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
  mocks.updateThemeVariant.mockReset();
  mocks.reload.mockReset();
});

afterEach(cleanup);

describe('TripAppShell', () => {
  it('uses explicit 768px and 1280px navigation presentation contracts', () => {
    const { container } = render(
      <TripAppShell>
        <h1>Plan</h1>
      </TripAppShell>
    );

    const desktopNavShell = screen.getByTestId('desktop-trip-navigation-shell');
    const desktopMoreShell = screen.getByTestId('desktop-trip-more-shell');
    const mobileNav = screen.getByTestId('mobile-trip-navigation');
    const mobileMoreShell = screen.getByTestId('mobile-trip-more-shell');
    const sidebarShell = screen.getByTestId('wide-trip-sidebar-shell');

    expect(desktopNavShell.classList.contains('trip-navigation-desktop')).toBe(true);
    expect(desktopMoreShell.classList.contains('trip-navigation-desktop')).toBe(true);
    expect(mobileNav.classList.contains('trip-navigation-mobile-bar')).toBe(true);
    expect(mobileMoreShell.classList.contains('trip-navigation-mobile-more')).toBe(true);
    expect(sidebarShell.classList.contains('trip-workspace-sidebar')).toBe(true);
    expect(container.querySelector('[data-testid="desktop-trip-navigation"]')?.classList.contains('hidden'))
      .toBe(false);

    const css = readFileSync(
      resolve(process.cwd(), 'src/app/globals.css'),
      'utf8'
    );
    expect(css).toMatch(/\.trip-navigation-desktop\s*\{\s*display:\s*none;/);
    expect(css).toMatch(/\.trip-navigation-mobile-more\s*\{\s*display:\s*block;/);
    expect(css).toMatch(/\.trip-navigation-mobile-bar\s*\{\s*display:\s*grid;/);
    expect(css).toContain(
      '.theme-expedition [data-trip-app-shell] .trip-mobile-nav,'
    );
    expect(css).toContain(
      '.theme-expedition [data-trip-app-shell] .trip-mobile-nav__link,'
    );
    expect(css).toContain(
      '.theme-expedition [data-trip-app-shell] .trip-mobile-nav__link--active,'
    );
    expect(css).toContain(
      '--trip-mobile-nav-surface: var(--color-bg-surface, #17221c);'
    );
    expect(css).toContain(
      'background: color-mix(in srgb, var(--trip-mobile-nav-surface) 96%, transparent);'
    );

    const sharedHandoff = css.slice(
      css.indexOf('@media (min-width: 768px)'),
      css.indexOf('@media (max-width: 1023px)')
    );
    expect(sharedHandoff).toMatch(/\.trip-navigation-desktop\s*\{\s*display:\s*flex;/);
    expect(sharedHandoff).toMatch(
      /\.trip-navigation-mobile-more,\s*\.trip-navigation-mobile-bar\s*\{\s*display:\s*none;/
    );
    expect(sharedHandoff).toMatch(/\.trip-app-main\s*\{\s*padding-bottom:\s*0;/);

    const wideHandoffStart = css.indexOf(
      '@media (min-width: 1280px) {',
      css.indexOf('@media (min-width: 768px)')
    );
    const wideHandoff = css.slice(
      wideHandoffStart,
      css.indexOf('@supports ((backdrop-filter', wideHandoffStart)
    );
    expect(wideHandoff).toMatch(/\.trip-workspace-sidebar\s*{[\s\S]*display:\s*block;/);
    expect(wideHandoff).toMatch(/\.trip-app-header,[\s\S]*display:\s*none;/);
    expect(wideHandoff).toMatch(/grid-template-columns:\s*11rem minmax\(0, 1fr\)/);
    expect(wideHandoff).not.toMatch(/overflow-y:\s*auto/);
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
    expect(screen.getByRole('link', { name: 'Skip to trip content' }).getAttribute('href'))
      .toBe('#trip-main');
    expect(screen.getByRole('link', { name: 'Back to trips' }).getAttribute('href')).toBe(
      '/trips'
    );

    const expectedOrder = ['Home', 'Plan', 'Gear', 'Crew', 'Field'];
    for (const testId of ['desktop-trip-navigation', 'mobile-trip-navigation']) {
      const nav = within(screen.getByTestId(testId));
      expect(nav.getAllByRole('link').map((link) => link.textContent?.replace('(current)', '')))
        .toEqual(expectedOrder);
      expect(nav.getByRole('link', { name: 'Field' }).getAttribute('href')).toBe(
        '/trips/trip-1/guide'
      );
    }

    const activePlanLinks = screen
      .getAllByRole('link', { name: /Plan/ })
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(activePlanLinks).toHaveLength(3);

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

  it('shows one compact read-only source banner for a saved workspace', () => {
    mocks.workspace = {
      ...workspaceValue(),
      source: 'cache',
      connectivity: 'offline',
      editableActions: null,
    };

    render(<TripAppShell><h1>Plan</h1></TripAppShell>);

    const status = screen.getByRole('status', { name: 'Workspace connection status' });
    expect(status.textContent).toContain('Offline · Read-only');
    expect(status.textContent).toContain('Reconnect to make changes.');
    fireEvent.click(within(status).getByRole('button', { name: 'Try again' }));
    expect(mocks.reload).toHaveBeenCalledOnce();
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
    expect(screen.getByRole('menuitem', { name: 'Appearance' })).toBeTruthy();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Appearance' }));
    expect(screen.getByText('Appearance dialog')).toBeTruthy();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close Appearance dialog' }));
    fireEvent.click(screen.getAllByRole('button', { name: /More/ })[0]);

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

  it('hides Appearance from read-only members in every More placement', () => {
    mocks.trip.role = 'viewer';
    mocks.trip.canEdit = false;
    mocks.trip.isOwner = false;
    mocks.workspace = {
      ...workspaceValue(),
      editableActions: null,
    } as TripWorkspaceValue;
    render(
      <TripAppShell>
        <h1>Plan</h1>
      </TripAppShell>
    );

    for (const trigger of screen.getAllByRole('button', { name: /More/ })) {
      fireEvent.click(trigger);
      expect(screen.queryByRole('menuitem', { name: 'Appearance' })).toBeNull();
      fireEvent.keyDown(document, { key: 'Escape' });
    }
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
    expect(screen.queryByText('Maple Lake Weekend')).toBeNull();
    expect(document.querySelector('.trip-workspace-background img')).toBeNull();
  });

  it('keeps loading and initialization retry states on the atmospheric fallback', () => {
    mocks.trip.isLoading = true;
    const view = render(
      <TripAppShell>
        <h1>Secret section</h1>
      </TripAppShell>
    );
    expect(screen.getByRole('status').textContent).toContain('Loading Trip Dashboard');
    expect(document.querySelector('[data-background-state="fallback"]')).toBeTruthy();

    mocks.trip.isLoading = false;
    const reload = vi.fn();
    mocks.workspace = {
      ...workspaceValue(),
      data: null,
      trip: null,
      error: 'We could not load this trip workspace. Please try again.',
      reload,
    } as unknown as TripWorkspaceValue;
    view.rerender(
      <TripAppShell>
        <h1>Secret section</h1>
      </TripAppShell>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-background-state="fallback"]')).toBeTruthy();
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
