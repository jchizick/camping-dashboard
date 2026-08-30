// @vitest-environment jsdom

import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import AuthenticatedTripsLoader from './AuthenticatedTripsLoader';

afterEach(cleanup);

describe('AuthenticatedTripsLoader', () => {
  it('renders the canonical logo geometry inline with one accessible loading status', () => {
    const { container } = render(<AuthenticatedTripsLoader />);

    const status = screen.getByRole('status');
    expect(status.textContent).toBe('PREPARING BASE CAMP…');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-atomic')).toBe('true');
    expect(container.querySelector('main')?.getAttribute('aria-busy')).toBe('true');

    expect(container.querySelector('use')).toBeNull();
    expect(container.querySelectorAll('[data-logo-part]')).toHaveLength(4);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.trip-workspace-state-panel')).toBeNull();
  });

  it('matches the canonical asset paths exactly and keeps the route directly animatable', () => {
    const { container } = render(<AuthenticatedTripsLoader />);
    const logo = readFileSync(resolve(process.cwd(), 'public/logo.svg'), 'utf8');
    const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
    const canonicalLogo = new DOMParser().parseFromString(logo, 'image/svg+xml');
    const normalizePath = (path: string | null | undefined) => path?.replace(/\s+/g, '') ?? '';

    const canonicalShield = canonicalLogo.querySelector('#waypoint-shield');
    const canonicalRoute = canonicalLogo.querySelector('#waypoint-route');
    const canonicalPin = canonicalLogo.querySelector('#waypoint-pin');
    const inlineShield = container.querySelector('[data-logo-part="shield"]');
    const inlineRoute = container.querySelector('[data-logo-part="route"]');
    const inlinePin = container.querySelector('[data-logo-part="waypoint"]');
    const inlineGlow = container.querySelector('[data-logo-part="waypoint-glow"]');

    expect(logo).toContain('id="waypoint-shield"');
    expect(logo).toContain('id="waypoint-route"');
    expect(logo).toContain('pathLength="1"');
    expect(logo).toContain('id="waypoint-pin"');
    expect(normalizePath(inlineShield?.getAttribute('d'))).toBe(
      normalizePath(canonicalShield?.getAttribute('d') ?? null)
    );
    expect(normalizePath(inlineRoute?.getAttribute('d'))).toBe(
      normalizePath(canonicalRoute?.getAttribute('d') ?? null)
    );
    expect(normalizePath(inlinePin?.getAttribute('d'))).toBe(
      normalizePath(canonicalPin?.getAttribute('d') ?? null)
    );
    expect(inlineGlow?.getAttribute('d')).toBe(inlinePin?.getAttribute('d'));
    expect(inlineRoute?.getAttribute('pathLength')).toBe('1');
    expect(inlineRoute?.getAttribute('stroke')).toBe('#E4A83D');
    expect(inlineRoute?.getAttribute('fill')).toBe('none');

    const entryFlowCss = css.slice(css.indexOf('/* Authenticated entry flow'));
    expect(entryFlowCss).toMatch(
      /\.trips-landing::before,\s*\.authenticated-trips-loader::before\s*{[\s\S]*?url\("\/topo-map-bg\.svg"\)[\s\S]*?background-position: top right, top center;[\s\S]*?background-size: auto, 38rem auto;/
    );
    expect(entryFlowCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.trips-landing::before,\s*\.authenticated-trips-loader::before,[\s\S]*?background-position: center;[\s\S]*?background-repeat: no-repeat;[\s\S]*?background-size: cover;[\s\S]*?opacity: 0\.46;/
    );
    expect(css).toContain('width: clamp(6.25rem, 24vw, 7.5rem);');
    expect(css).toContain('animation: authenticated-trip-route-draw 2.4s');
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.authenticated-trips-loader__route\s*{[\s\S]*?stroke-dashoffset: 0;[\s\S]*?animation: none;/
    );
  });
});
