// @vitest-environment jsdom

import React from 'react';
import { renderToString } from 'react-dom/server';
import { PHONE_LAYOUT_MEDIA_QUERY } from '@/components/trip/PhoneLayoutProvider';
import fs from 'node:fs';
import path from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({ alt, unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
    void unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt ?? ''} {...props} />;
  },
}));

import { SignedOutLanding } from './SignedOutLanding';
import { DesktopSignedOutLanding } from './DesktopSignedOutLanding';

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('SignedOutLanding', () => {
  it('renders both responsive hero copy contracts with one heading and one Google action', () => {
    const { container } = render(<SignedOutLanding error={null} onSignIn={vi.fn()} />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(container.querySelector('.signed-out-eyebrow .signed-out-copy--desktop')?.textContent).toBe(
      'Your outdoor command centre'
    );
    expect(container.querySelector('h1 .signed-out-copy--desktop')?.textContent).toBe(
      'Plan the trip.Pack with confidence.Get outside.'
    );
    expect(container.querySelector('.signed-out-lede .signed-out-copy--desktop')?.textContent).toBe(
      'Organize your campsite, gear, crew, weather and daily plans in one shared camping workspace.'
    );
    expect(container.querySelector('.signed-out-eyebrow .signed-out-copy--mobile')?.textContent).toBe(
      'Trip readiness, made clear'
    );
    expect(container.querySelector('h1 .signed-out-copy--mobile')?.textContent).toBe(
      'Know whatneeds attention.Then head out.'
    );
    expect(container.querySelector('.signed-out-lede .signed-out-copy--mobile')?.textContent).toBe(
      'Plan the trip, identify critical gear, coordinate preparation, and see the next action before you leave.'
    );
    expect(container.querySelectorAll('.signed-out-intro[aria-labelledby="signed-out-heading"]')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Continue with Google' })).toHaveLength(1);
    const googleButton = screen.getByRole('button', { name: 'Continue with Google' });
    expect(googleButton).toBeTruthy();
    expect(googleButton.querySelector('img')?.getAttribute('src')).toBe('/google-g-logo.png');
  });

  it('keeps the existing desktop product proof content intact', () => {
    const { container } = render(<SignedOutLanding error={null} onSignIn={vi.fn()} />);

    expect(container.textContent).toContain('ALGONQUIN CANOE TRIP');
    expect(container.textContent).toContain('3 nights');
    expect(container.textContent).toContain('23 km');
    expect(container.textContent).toContain('Packing status');
    expect(container.textContent).toContain('Weather');

    for (const item of ['Tent', 'Sleeping Bag', 'Camp Stove', 'Headlamp', 'Water Filter', 'First Aid Kit']) {
      expect(container.textContent).toContain(item);
    }
    expect(container.textContent).not.toContain('Today');
    expect(container.textContent).not.toContain('Route Summary');
  });

  it('renders the mobile readiness inputs and canonical static assessment without fabricated detail', () => {
    const { container } = render(<SignedOutLanding error={null} onSignIn={vi.fn()} />);
    const inputRegion = screen.getByRole('region', { name: 'Readiness inputs' });
    const assessment = screen.getByRole('region', { name: 'Readiness command' });
    const mobileStory = container.querySelector('.signed-out-mobile-story');

    expect(inputRegion.querySelectorAll('ol > li')).toHaveLength(4);
    for (const item of ['Plan', 'Gear', 'Field Prep', 'Conditions']) {
      expect(inputRegion.textContent).toContain(item);
    }
    expect(inputRegion.querySelector('[data-input-kind="context"]')?.textContent).toContain('Conditions');
    expect(inputRegion.querySelector('[data-input-kind="context"]')?.textContent).toContain('Context');
    expect(assessment.textContent).toContain('Example trip assessment');
    expect(mobileStory?.textContent).toContain('Every trip signal, one field view');
    expect(assessment.textContent).toContain('Readiness command');
    expect(assessment.textContent).toContain('Needs Attention');
    expect(assessment.textContent).toContain('1 blocker');
    expect(assessment.textContent).toContain('Critical gear still needs to be acquired');
    expect(assessment.textContent).toContain('Next action');
    expect(assessment.textContent).toContain('Review gear');
    expect(assessment.getAttribute('data-readiness-status')).toBe('needs-attention');
    expect(assessment.getAttribute('data-issue-severity')).toBe('blocker');
    expect(mobileStory?.textContent).not.toContain('Crew');
    expect(mobileStory?.textContent).not.toMatch(/\d+%|\d+°|ALGONQUIN CANOE TRIP/i);
    expect(assessment.querySelectorAll('button, a, input, select, textarea, [tabindex]')).toHaveLength(0);
  });

  it('exposes the editorial, operational-display and UI typography boundaries', () => {
    const { container } = render(<SignedOutLanding error={null} onSignIn={vi.fn()} />);
    const landing = container.querySelector('[data-signed-out-landing]');

    expect(landing?.getAttribute('data-signed-out-type-system')).toBe('editorial-operational-bridge');
    expect(screen.getByRole('heading', { level: 1 }).getAttribute('data-marketing-type-role')).toBe('editorial-hero');
    expect(container.querySelector('h1 .signed-out-copy--mobile')?.getAttribute('data-marketing-type-role')).toBe('operational-hero');
    expect(container.querySelector('.signed-out-brand__name')?.getAttribute('data-marketing-type-role')).toBe('editorial-brand');
    expect(container.querySelector('.signed-out-eyebrow')?.getAttribute('data-marketing-type-role')).toBe('operational-display');
    expect(container.querySelector('.signed-out-lede')?.getAttribute('data-marketing-type-role')).toBe('ui-body');
    expect(screen.getByRole('button', { name: 'Continue with Google' }).getAttribute('data-marketing-type-role')).toBe('ui-control');
    expect(container.querySelectorAll('[data-marketing-type-role="ui-label"]').length).toBe(4);
  });

  it('uses the canonical local topographic asset for the signed-out atmosphere', () => {
    const projectRoot = process.cwd();
    const css = fs.readFileSync(path.join(projectRoot, 'src/app/globals.css'), 'utf8');

    expect(fs.existsSync(path.join(projectRoot, 'public/topo-map-bg.svg'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'public/trips/signed-out-sunset-canoe-composed.webp'))).toBe(true);
    expect(css).toContain('--landing-topography: url("/topo-map-bg.svg")');
    expect(css).toContain('background-image: url("/trips/signed-out-sunset-canoe-composed.webp")');
    expect(css).toMatch(/@media \(prefers-reduced-transparency: reduce\)[\s\S]*?\.signed-out-landing__topo::before \{\s*display: none;/);
    expect(css).toMatch(/@media \(prefers-reduced-data: reduce\)[\s\S]*?\.signed-out-landing__topo::before,[\s\S]*?display: none;/);
  });

  it('preserves a visible keyboard-focus contract for the shared Google action', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');

    expect(css).toMatch(/\.signed-out-google:focus-visible \{[^}]*outline: 3px solid #8ab4f8;[^}]*outline-offset: 3px;/);
  });

  it('keeps preview and capability product labels in the UI type family', () => {
    const projectRoot = process.cwd();
    const css = fs.readFileSync(path.join(projectRoot, 'src/app/globals.css'), 'utf8');

    expect(css).toMatch(/\.signed-out-map__heading strong\s*{[^}]*font-family:\s*var\(--font-ui\)/);
    expect(css).toMatch(/\.signed-out-capability h2\s*{[^}]*font-family:\s*var\(--font-ui\)/);
    expect(css).not.toMatch(/\.signed-out-capability h2\s*{[^}]*font-family:\s*var\(--font-trip-display\)/);
  });

  it('keeps the decorative product preview hidden from assistive technology and free of focusable controls', () => {
    const { container } = render(<SignedOutLanding error={null} onSignIn={vi.fn()} />);
    const preview = container.querySelector('.signed-out-preview');

    expect(preview?.getAttribute('aria-hidden')).toBe('true');
    expect(preview?.querySelectorAll('button, a, input, select, textarea, [tabindex]').length).toBe(0);
    expect(container.querySelector('.signed-out-mobile-route')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders the expedition route without standalone directional arrows', () => {
    const { container } = render(<SignedOutLanding error={null} onSignIn={vi.fn()} />);
    const map = container.querySelector('.signed-out-map__canvas');
    const routeGeometry = 'M76 607C125 589 130 545 166 523c43-27 90 23 132 7 35-14 32-51 1-67-34-17-82-1-107-30-26-31-8-82 18-105 35-31 85-33 111-73 16-25 21-55 17-68';

    expect(map?.querySelectorAll(`path[d="${routeGeometry}"]`).length).toBe(2);
    expect(map?.querySelector('path[d="M158 505l7-12 7 12h-5v12h-4v-12Z"]')).toBeNull();
    expect(map?.querySelector('path[d="M190 420l7-12 7 12h-5v12h-4v-12Z"]')).toBeNull();
    expect(map?.querySelector('path[d="M302 257l7-12 7 12h-5v12h-4v-12Z"]')).toBeNull();
    const compassTicks = map?.querySelectorAll('.signed-out-map__compass-tick');
    expect(compassTicks?.length).toBe(2);
    expect(compassTicks?.[0].getAttribute('x1')).toBe('-30');
    expect(compassTicks?.[0].getAttribute('x2')).toBe('-24');
    expect(compassTicks?.[1].getAttribute('x1')).toBe('30');
    expect(compassTicks?.[1].getAttribute('x2')).toBe('24');
    expect(map?.textContent).toContain('Access Point');
    expect(map?.textContent).toContain('Taylor Lake');
    expect(map?.textContent).toContain('Little John Lake');
    expect(map?.textContent).toContain('Smoke Lake');
  });

  it('invokes sign-in once and exposes the pending state', async () => {
    let resolveSignIn: (() => void) | undefined;
    const onSignIn = vi.fn(() => new Promise<void>((resolve) => { resolveSignIn = resolve; }));
    render(<SignedOutLanding error={null} onSignIn={onSignIn} />);

    const button = screen.getByRole('button', { name: 'Continue with Google' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onSignIn).toHaveBeenCalledOnce();
    expect(await screen.findByRole('button', { name: 'Connecting…' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Connecting…' }).hasAttribute('disabled')).toBe(true);

    resolveSignIn?.();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy());
  });

  it('renders sign-in errors as an alert', () => {
    render(<SignedOutLanding error="Google sign-in could not start." onSignIn={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toBe('Google sign-in could not start.');
  });
});


describe('desktop signed-out composition', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });

  function googleButtonAt(container: HTMLElement, location: 'hero' | 'readiness' | 'closing') {
    const slot = container.querySelector<HTMLElement>(`[data-desktop-auth-location="${location}"]`);
    expect(slot).toBeTruthy();
    return within(slot!).getByRole('button', { name: 'Sign in with Google' });
  }

  it('renders the exact desktop hero with shared auth controls and no old preview', () => {
    const { container } = render(<SignedOutLanding error="Callback failed" onSignIn={vi.fn()} />);
    expect(screen.getByText('YOUR OUTDOOR COMMAND CENTRE')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Trip readiness, made clear.');
    expect(screen.getByText('Plan, pack, and coordinate every trip in one workspace designed for clarity before you head out.')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Sign in with Google' })).toHaveLength(3);
    expect(googleButtonAt(container, 'hero')).toBeTruthy();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert').textContent).toBe('Callback failed');
    expect(screen.getByRole('alert').closest('[data-desktop-auth-location]')?.getAttribute('data-desktop-auth-location')).toBe('hero');
    expect(container.querySelector('[data-desktop-signed-out]')).toBeTruthy();
    expect(container.querySelector('.signed-out-preview')).toBeNull();
    const preview = container.querySelector('[data-desktop-landing-preview]');
    const image = preview?.querySelector('img');
    expect(image?.getAttribute('src')).toBe('/trips/desktop-workspace-preview.webp');
    expect(image?.getAttribute('width')).toBe('2560');
    expect(image?.getAttribute('height')).toBe('1594');
    expect(image?.getAttribute('loading')).toBe('eager');
    const source = fs.readFileSync(path.join(process.cwd(), 'src/components/trips/DesktopSignedOutLanding.tsx'), 'utf8');
    expect(source).toMatch(/height=\{1594\}\s+unoptimized/);
    expect(image?.getAttribute('alt')).toContain('Field Protocol trip workspace');
    expect(preview?.querySelectorAll('img')).toHaveLength(1);
    expect(image?.getAttribute('alt')).toContain('trip essentials for gear, meals and crew');
    expect(image?.getAttribute('alt')).toContain('trip access controls');
    expect(preview?.querySelectorAll('.desktop-landing__preview-bottom, .desktop-landing__essentials, .desktop-landing__sidebar-footer')).toHaveLength(0);
    expect(preview?.querySelectorAll('[data-desktop-preview-essentials], [data-desktop-preview-sidebar-footer]')).toHaveLength(0);
    expect(preview?.querySelectorAll('button, a, input, select, textarea, [tabindex]')).toHaveLength(0);
    const instrument = container.querySelector('.desktop-landing__preview-instrument');
    expect(instrument?.textContent).toBe('SYSTEM / TRIP READINESS');
    expect(instrument?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('[data-phone-signed-out]')).toBeNull();
    expect(container.textContent).not.toContain('Email');
  });

  it('connects the desktop navigation to sections in reading order and opens only the first FAQ', () => {
    const { container } = render(<SignedOutLanding error={null} onSignIn={vi.fn()} />);
    const sectionIds = ['features', 'how-it-works', 'faq'];
    const navNames = ['Features', 'How it works', 'FAQ'];
    const sections = sectionIds.map((id, index) => {
      const section = container.querySelector<HTMLElement>(`#${id}`);
      expect(section).toBeTruthy();
      const navLinks = screen.getAllByRole('link', { name: navNames[index] });
      expect(navLinks).toHaveLength(2);
      expect(navLinks.every(link => link.getAttribute('href') === `#${id}`)).toBe(true);
      return section!;
    });
    const hero = container.querySelector('.desktop-landing__hero');
    const readiness = container.querySelector('[data-desktop-auth-location="readiness"]');
    const closing = container.querySelector('[data-desktop-auth-location="closing"]');
    expect(hero).toBeTruthy();
    expect(readiness).toBeTruthy();
    expect(closing).toBeTruthy();
    const sequence = [hero!, sections[0], readiness!, sections[1], sections[2], closing!];

    for (let index = 1; index < sequence.length; index += 1) {
      expect(sequence[index - 1].compareDocumentPosition(sequence[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }

    const details = sections[2].querySelectorAll('details');
    expect(details).toHaveLength(5);
    expect(details[0].open).toBe(true);
    expect(Array.from(details).slice(1).every(detail => !detail.open)).toBe(true);
    expect(Array.from(details).every(detail => detail.querySelector('summary'))).toBe(true);
  });

  it('keeps desktop product examples static and free of interactive controls', () => {
    const { container } = render(<SignedOutLanding error={null} onSignIn={vi.fn()} />);
    const examples = container.querySelectorAll('[data-desktop-product-example]');
    expect(examples.length).toBeGreaterThan(0);
    for (const example of examples) {
      expect(example.querySelectorAll('button, a, input, select, textarea, [tabindex]')).toHaveLength(0);
    }
  });

  it.each(['hero', 'readiness', 'closing', 'header'] as const)('shares pending protection across all desktop controls when %s starts sign-in', async (location) => {
    let finish!: () => void;
    const signIn = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const { container } = render(<SignedOutLanding error={null} onSignIn={signIn} />);
    const button = location === 'header'
      ? screen.getByRole('button', { name: 'Sign in' })
      : googleButtonAt(container, location);
    fireEvent.click(button);
    for (const authButton of screen.getAllByRole('button')) fireEvent.click(authButton);
    expect(signIn).toHaveBeenCalledOnce();
    const pendingButtons = screen.getAllByRole('button', { name: 'Connecting…' });
    expect(pendingButtons).toHaveLength(4);
    expect(pendingButtons.every(authButton => authButton.hasAttribute('disabled'))).toBe(true);
    finish();
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^Sign in(?: with Google)?$/ })).toHaveLength(4);
      expect(screen.getAllByRole('button').every(authButton => !authButton.hasAttribute('disabled'))).toBe(true);
    });
  });

  it('rejects duplicate cross-control requests before the shared pending prop updates', async () => {
    let finish!: () => void;
    const signIn = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const { container } = render(<DesktopSignedOutLanding error={null} pending={false} onSignIn={signIn} />);

    fireEvent.click(googleButtonAt(container, 'hero'));
    fireEvent.click(googleButtonAt(container, 'readiness'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(signIn).toHaveBeenCalledOnce();

    await act(async () => { finish(); });
    fireEvent.click(googleButtonAt(container, 'closing'));
    expect(signIn).toHaveBeenCalledTimes(2);
    await act(async () => { finish(); });
  });

  it.each([
    ['hero', 'hero'],
    ['readiness', 'readiness'],
    ['closing', 'closing'],
    ['header', 'hero'],
  ] as const)('renders one error at the active %s control after sign-in settles', async (location, errorLocation) => {
    const signIn = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = render(<SignedOutLanding error={null} onSignIn={signIn} />);
    const button = location === 'header'
      ? screen.getByRole('button', { name: 'Sign in' })
      : googleButtonAt(container, location);

    fireEvent.click(button);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Sign in(?: with Google)?$/ })).toHaveLength(4));
    rerender(<SignedOutLanding error="Google sign-in could not start." onSignIn={signIn} />);

    expect(signIn).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert').textContent).toBe('Google sign-in could not start.');
    expect(screen.getByRole('alert').closest('[data-desktop-auth-location]')?.getAttribute('data-desktop-auth-location')).toBe(errorLocation);
  });

  it('scopes charcoal and sans typography without clipping the document', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/components/trips/desktopSignedOutLanding.css'), 'utf8');
    expect(css).toContain('@scope ([data-desktop-signed-out])');
    expect(css).toContain('var(--font-display-face)');
    expect(css).toContain('var(--font-ui-face)');
    expect(css).not.toContain('--font-trip-display');
    expect(css).not.toContain('overflow: hidden');
    expect(css).toContain('min-height: 100svh');
    expect(css).not.toMatch(/clip-path|preview-bottom|sidebar-footer|sidebar-extras|sidebar-account|desktop-landing__essentials|\.desktop-landing__preview::before/);
    expect(css).toMatch(/\.desktop-landing__preview > img \{\s*display: block;\s*width: 100%;\s*height: auto;/);
    expect(css).toContain('.desktop-landing__preview-instrument::before { inset: 22px auto auto -10px; }');
    expect(css).toContain('.desktop-landing__preview-instrument::after { inset: auto -10px -10px auto; }');
  });
});

it('keeps the phone story singular without the new desktop landing sections', () => {
  const { container } = render(<SignedOutLanding error={null} onSignIn={vi.fn()} />);
  expect(container.querySelectorAll('.signed-out-mobile-story')).toHaveLength(1);
  expect(container.querySelectorAll('#features, #how-it-works, #faq, [data-desktop-auth-location], [data-desktop-product-example]')).toHaveLength(0);
});

it('uses the canonical query for qualifying landscape phones', () => {
  const { container } = render(<SignedOutLanding error={null} onSignIn={vi.fn()} />);
  expect(window.matchMedia).toHaveBeenCalledWith(PHONE_LAYOUT_MEDIA_QUERY);
  expect(container.querySelector('[data-phone-signed-out]')).toBeTruthy();
  expect(container.querySelector('[data-desktop-signed-out]')).toBeNull();
  expect(container.querySelector('[data-desktop-landing-preview]')).toBeNull();
  expect(container.querySelector('img[src="/trips/desktop-workspace-preview.webp"]')).toBeNull();
  expect(screen.getAllByRole('button')).toHaveLength(1);
});

it('renders the existing loader on the server rather than a guessed desktop hero', () => {
  const html = renderToString(<SignedOutLanding error={null} onSignIn={vi.fn()} />);
  expect(html).toContain('data-authenticated-trips-loader');
  expect(html).not.toContain('data-desktop-signed-out');
  expect(html).not.toContain('Sign in with Google');
});
