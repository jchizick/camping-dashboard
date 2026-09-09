// @vitest-environment jsdom

import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  act,
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
vi.mock('./TripWorkspaceStatus', () => ({
  useOptionalTripWorkspaceStatus: () => mocks.workspace,
}));
vi.mock('@/components/home/HomeOverview', () => ({
  default: () => <h1 id="desktop-overview-title" tabIndex={-1}>Home</h1>,
}));
vi.mock('@/components/plan/DesktopWorkspacePlanSection', () => ({
  default: () => <section><h2 id="desktop-plan-title" tabIndex={-1}>Plan</h2><input aria-label="Persistent day selection" defaultValue="Day 1" /></section>,
}));
vi.mock('@/components/gear/DesktopWorkspaceGearSection', () => ({
  default: () => <section><h2 id="desktop-gear-title" tabIndex={-1}>Gear</h2></section>,
}));
vi.mock('@/components/crew/DesktopWorkspaceCrewSection', () => ({
  default: () => <section><h2 id="desktop-crew-title" tabIndex={-1}>Crew</h2></section>,
}));
vi.mock('@/components/field/DesktopWorkspaceFieldSection', () => ({
  default: () => <section><h2 id="desktop-field-title" tabIndex={-1}>Field</h2></section>,
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
import { PHONE_LAYOUT_MEDIA_QUERY } from './PhoneLayoutProvider';

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

function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<() => void>();
  const mediaQuery = {
    get matches() {
      return matches;
    },
    media: '',
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: (listener: () => void) => listeners.add(listener),
    removeListener: (listener: () => void) => listeners.delete(listener),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
  vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery));
  return {
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
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

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-phone-layout');
  vi.unstubAllGlobals();
});

describe('TripAppShell', () => {
  it('isolates neutral rail states and visible focus inside the desktop boundary', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/components/trip/desktopTripWorkspace.css'), 'utf8');
    const rail = css.slice(css.indexOf('@scope'), css.indexOf('[data-desktop-trip-workspace].trip-workspace-shell .trip-workspace-sidebar {'));
    expect(rail).toContain('@scope ([data-desktop-trip-workspace] .trip-workspace-sidebar)');
    expect(rail).toContain('[aria-current="page"]');
    expect(rail).toContain('backdrop-filter: none');
    expect(rail).toContain(':focus-visible');
    expect(rail).toContain('outline: 2px solid var(--rail-foreground)');
    expect(rail).not.toMatch(/accent-sage|state-success|state-warning|state-danger|outline:\s*none/);
  });

  it('leaves initial Overview restoration alone, then targets deliberate navigation', async () => {
    installMatchMedia(false);
    mocks.pathname = '/trips/trip-1';
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    const view = render(<React.StrictMode><TripAppShell><div /></TripAppShell></React.StrictMode>);
    await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)); });
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(scroll).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
    mocks.pathname = '/trips/trip-1/gear';
    view.rerender(<React.StrictMode><TripAppShell><div /></TripAppShell></React.StrictMode>);
    await vi.waitFor(() => expect(document.activeElement?.id).toBe('desktop-gear-title'));
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    mocks.pathname = '/trips/trip-1';
    view.rerender(<React.StrictMode><TripAppShell><div /></TripAppShell></React.StrictMode>);
    await vi.waitFor(() => expect(scroll).toHaveBeenCalledWith({ top: 0, behavior: 'instant' }));
  });

  it.each(['online', 'cache'] as const)('targets sections on initial load and forward/back route changes for %s', async source => {
    installMatchMedia(false);
    mocks.workspace = { ...workspaceValue(), source };
    if (source === 'cache') mocks.workspace.navigationPath = '/trips/trip-1/plan';
    const view = render(<TripAppShell><h1>Legacy route body</h1></TripAppShell>);
    await vi.waitFor(() => expect(document.activeElement?.id).toBe('desktop-plan-title'));
    expect(screen.queryByText('Legacy route body')).toBeNull();
    const overview = screen.getByRole('heading', { name: 'Home' });
    const plan = screen.getByRole('heading', { name: 'Plan' });
    expect(overview.compareDocumentPosition(plan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const state = screen.getByRole('textbox', { name: 'Persistent day selection' });
    fireEvent.change(state, { target: { value: 'Day 2' } });
    for (const [path, id] of [['/trips/trip-1', 'desktop-overview-title'], ['/trips/trip-1/plan', 'desktop-plan-title'], ['/trips/trip-1/gear', 'desktop-gear-title'], ['/trips/trip-1/crew', 'desktop-crew-title'], ['/trips/trip-1/guide', 'desktop-field-title'], ['/trips/trip-1/plan', 'desktop-plan-title']]) {
      if (source === 'cache') mocks.workspace.navigationPath = path;
      else mocks.pathname = path;
      view.rerender(<TripAppShell><h1>Legacy route body</h1></TripAppShell>);
      await vi.waitFor(() => expect(document.activeElement?.id).toBe(id));
      expect(screen.getByRole('heading', { name: 'Plan' })).toBe(plan);
      expect(screen.getByRole('textbox')).toBe(state);
      expect((state as HTMLInputElement).value).toBe('Day 2');
    }
  });

  it.each(['plan', 'crew', 'guide'])('waits for trip data before focusing an initial desktop %s deep link', async section => {
    const heading = section === 'guide' ? 'field' : section;
    mocks.pathname = `/trips/trip-1/${section}`;
    installMatchMedia(false);
    const ready = workspaceValue();
    mocks.workspace = { ...ready, data: null, trip: null, isLoading: true };
    const view = render(<TripAppShell><h1>Legacy route body</h1></TripAppShell>);
    expect(document.querySelector(`#desktop-${heading}-title`)).toBeNull();
    mocks.workspace = ready;
    view.rerender(<TripAppShell><h1>Legacy route body</h1></TripAppShell>);
    await vi.waitFor(() => expect(document.activeElement?.id).toBe(`desktop-${heading}-title`));
  });

  it.each([{ width: 390, route: 'crew' }, { width: 956, route: 'crew' }, { width: 390, route: 'guide' }, { width: 956, route: 'guide' }])('bypasses the desktop document for phone $route at $width px', ({ width, route }) => {
    mocks.pathname = `/trips/trip-1/${route}`;
    vi.stubGlobal('innerWidth', width);
    installMatchMedia(true);
    render(<TripAppShell><h1>Phone Crew route</h1></TripAppShell>);
    expect(screen.getAllByRole('heading', { name: 'Phone Crew route' })).toHaveLength(1);
    expect(document.querySelector('[data-desktop-workspace-document]')).toBeNull();
    expect(document.querySelector('[data-desktop-trip-workspace]')).toBeNull();
    expect(screen.getByTestId('mobile-trip-navigation')).toBeTruthy();
  });

  it.each(['online', 'cache'] as const)('keeps Field Log outside the five-domain document for %s', source => {
    installMatchMedia(false);
    mocks.pathname = '/trips/trip-1/field-log';
    mocks.workspace = { ...workspaceValue(), source };
    if (source === 'cache') mocks.workspace.navigationPath = '/trips/trip-1/field-log';
    render(<TripAppShell><h1>Existing Field Log</h1></TripAppShell>);
    expect(screen.getByRole('heading', { name: 'Existing Field Log' })).toBeTruthy();
    expect(document.querySelector('[data-desktop-workspace-document]')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Field' })).toBeNull();
  });

  it.each(['online', 'cache'] as const)(
    'keeps one stable desktop root across current routes for the %s workspace',
    (source) => {
      installMatchMedia(false);
      mocks.workspace = { ...workspaceValue(), source };
      const view = render(<TripAppShell><h1>Home</h1></TripAppShell>);
      const root = view.container.querySelector('[data-desktop-trip-workspace]');
      expect(root).toBe(view.container.firstElementChild);
      expect(root?.className).toBe('trip-workspace-shell min-h-[100dvh] text-text-main');
      const main = screen.getByRole('main');
      const rail = screen.getByTestId('wide-trip-sidebar-shell');
      expect(main.parentElement).toBe(root);

      for (const [segment, title] of [
        ['', 'Home'], ['plan', 'Plan'], ['gear', 'Gear'],
        ['crew', 'Crew'], ['guide', 'Field'],
      ]) {
        const pathname = `/trips/trip-1${segment ? `/${segment}` : ''}`;
        if (source === 'cache') mocks.workspace.navigationPath = pathname;
        else mocks.pathname = pathname;
        view.rerender(<TripAppShell><h1>{title}</h1></TripAppShell>);
        expect(view.container.querySelectorAll('[data-desktop-trip-workspace]')).toHaveLength(1);
        expect(view.container.querySelector('[data-desktop-trip-workspace]')).toBe(root);
        expect(screen.getByRole('main')).toBe(main);
        expect(screen.getByTestId('wide-trip-sidebar-shell')).toBe(rail);
        expect(main.hasAttribute('data-desktop-workspace-main')).toBe(true);
        expect(screen.getAllByRole('navigation')).toHaveLength(1);
        expect(screen.queryByTestId('mobile-trip-navigation')).toBeNull();
        expect(screen.queryByRole('banner')).toBeNull();
        const active = within(screen.getByRole('navigation')).getByRole('link', {
          name: new RegExp(title === 'Home' ? 'Overview' : title),
        });
        expect(active.getAttribute('aria-current')).toBe('page');
        expect(screen.getAllByRole('heading', { name: title })).toHaveLength(1);
        expect(main.contains(screen.getByRole('heading', { name: title }))).toBe(true);
        if (!segment || segment === 'plan' || segment === 'gear' || segment === 'crew' || segment === 'guide') {
          expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
          expect(screen.getByRole('heading', { level: 2, name: 'Plan' })).toBeTruthy();
        }
      }
    },
  );

  it('uses phone state even at landscape-phone widths without remounting shared content', () => {
    mocks.pathname = '/trips/trip-1/field-log';
    vi.stubGlobal('innerWidth', 956);
    const media = installMatchMedia(true);
    const view = render(
      <TripAppShell><input aria-label="Existing draft" defaultValue="Unsaved" /></TripAppShell>,
    );
    const root = view.container.firstElementChild;
    const draft = screen.getByRole('textbox');
    fireEvent.change(draft, { target: { value: 'Keep this draft' } });
    expect(window.matchMedia).toHaveBeenCalledWith(PHONE_LAYOUT_MEDIA_QUERY);
    expect(root?.hasAttribute('data-desktop-trip-workspace')).toBe(false);
    expect(screen.queryByTestId('wide-trip-sidebar-shell')).toBeNull();
    expect(screen.getByTestId('mobile-trip-navigation')).toBeTruthy();
    expect(document.documentElement.getAttribute('data-phone-layout')).toBe('true');

    for (const isPhone of [false, true]) {
      media.setMatches(isPhone);
      expect(view.container.firstElementChild).toBe(root);
      expect(root?.hasAttribute('data-desktop-trip-workspace')).toBe(!isPhone);
      expect(screen.getAllByRole('textbox')).toHaveLength(1);
      expect(screen.getByRole('textbox')).toBe(draft);
      expect((draft as HTMLInputElement).value).toBe('Keep this draft');
    }
  });

  it('preserves phone navigation and its existing responsive CSS contracts', () => {
    installMatchMedia(true);
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
    expect(screen.queryByTestId('wide-trip-sidebar-shell')).toBeNull();
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

    const phoneHandoffStart = css.indexOf(
      '@scope (html[data-phone-layout="true"])',
      css.indexOf('@media (min-width: 768px)')
    );
    const phoneHandoff = css.slice(
      phoneHandoffStart,
      css.indexOf('/* Base container for the background */', phoneHandoffStart)
    );
    expect(phoneHandoffStart).toBeGreaterThan(-1);
    expect(phoneHandoff).toMatch(/\.trip-navigation-desktop\s*\{\s*display:\s*none;/);
    expect(phoneHandoff).toMatch(/\.trip-navigation-mobile-more\s*\{\s*display:\s*block;/);
    expect(phoneHandoff).toMatch(/\.trip-navigation-mobile-bar\s*\{\s*display:\s*grid;/);
    expect(phoneHandoff).toContain('--trip-mobile-nav-height: 4.25rem;');

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

  it('closes the phone More menu when the semantic layout changes', async () => {
    const media = installMatchMedia(true);
    render(
      <TripAppShell>
        <h1>Plan</h1>
      </TripAppShell>
    );

    fireEvent.click(screen.getByRole('button', { name: 'More trip actions' }));
    expect(screen.getByRole('menu')).toBeTruthy();

    media.setMatches(false);
    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('renders one desktop rail, one main landmark, and canonical guarded destinations', () => {
    render(
      <TripAppShell>
        <h1>Plan</h1>
      </TripAppShell>
    );

    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Plan' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Skip to trip content' }).getAttribute('href'))
      .toBe('#trip-main');
    expect(screen.getByRole('link', { name: 'Back to Trips' }).getAttribute('href')).toBe(
      '/trips'
    );

    const expectedOrder = ['Overview', 'Plan', 'Gear', 'Crew', 'Field'];
    for (const navElement of screen.getAllByRole('navigation')) {
      const nav = within(navElement);
      expect(nav.getAllByRole('link').map((link) => link.textContent?.replace('(current)', '')))
        .toEqual(expectedOrder);
      expect(nav.getByRole('link', { name: 'Field' }).getAttribute('href')).toBe(
        '/trips/trip-1/guide'
      );
    }

    const activePlanLinks = screen
      .getAllByRole('link', { name: /Plan/ })
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(activePlanLinks).toHaveLength(1);

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

  it('uses the shared branded loader before preserving the initialization retry fallback', () => {
    mocks.trip.isLoading = true;
    const view = render(
      <TripAppShell>
        <h1>Secret section</h1>
      </TripAppShell>
    );
    expect(screen.getByRole('status').textContent).toContain('PREPARING BASE CAMP…');
    expect(document.querySelector('[data-authenticated-trips-loader]')).toBeTruthy();
    expect(document.querySelector('.trip-workspace-background')).toBeNull();

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
    mocks.pathname = '/trips/trip-1/field-log';
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

    const identity = container.querySelector('.trip-workspace-sidebar__identity');
    expect(identity?.getAttribute('title')).toContain(value.trip!.name);
    expect(identity?.querySelector('.trip-workspace-sidebar__trip-name')).toBeTruthy();
    expect(identity?.textContent).toContain(value.trip!.name);
  });
});
