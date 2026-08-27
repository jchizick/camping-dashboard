// @vitest-environment jsdom

import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt ?? ''} {...props} />,
}));

import { SignedOutLanding } from './SignedOutLanding';

afterEach(cleanup);

describe('SignedOutLanding', () => {
  it('renders the approved marketing and expedition preview content', () => {
    const { container } = render(<SignedOutLanding error={null} onSignIn={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Plan the trip.Pack with confidence.Get outside.'
    );
    const googleButton = screen.getByRole('button', { name: 'Continue with Google' });
    expect(googleButton).toBeTruthy();
    expect(googleButton.querySelector('img')?.getAttribute('src')).toBe('/google-g-logo.png');
    expect(container.textContent).toContain('ALGONQUIN CANOE TRIP');
    expect(container.textContent).toContain('3 nights');
    expect(container.textContent).toContain('23 km');
    expect(container.textContent).toContain('Packing status');
    expect(container.textContent).toContain('Weather');
    expect(screen.getByRole('region', { name: 'Plan, pack and prepare' })).toBeTruthy();

    for (const item of ['Campsite', 'Gear', 'Crew', 'Weather']) {
      expect(screen.getByRole('region', { name: 'Plan, pack and prepare' }).textContent).toContain(item);
    }

    for (const item of ['Tent', 'Sleeping Bag', 'Camp Stove', 'Headlamp', 'Water Filter', 'First Aid Kit']) {
      expect(container.textContent).toContain(item);
    }
    expect(container.textContent).not.toContain('Today');
    expect(container.textContent).not.toContain('Route Summary');
  });

  it('exposes the editorial, operational-display and UI typography boundaries', () => {
    const { container } = render(<SignedOutLanding error={null} onSignIn={vi.fn()} />);
    const landing = container.querySelector('[data-signed-out-landing]');

    expect(landing?.getAttribute('data-signed-out-type-system')).toBe('editorial-operational-bridge');
    expect(screen.getByRole('heading', { level: 1 }).getAttribute('data-marketing-type-role')).toBe('editorial-hero');
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
    expect(css).toContain('--landing-topography: url("/topo-map-bg.svg")');
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
