// @vitest-environment jsdom

import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import AuthenticatedTripsLoader from './AuthenticatedTripsLoader';

afterEach(cleanup);

describe('AuthenticatedTripsLoader', () => {
  it('renders the canonical logo fragments with one accessible loading status', () => {
    const { container } = render(<AuthenticatedTripsLoader />);

    const status = screen.getByRole('status');
    expect(status.textContent).toBe('PREPARING BASE CAMP…');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-atomic')).toBe('true');
    expect(container.querySelector('main')?.getAttribute('aria-busy')).toBe('true');

    const uses = Array.from(container.querySelectorAll('use'));
    expect(uses.map((use) => use.getAttribute('href'))).toEqual([
      '/logo.svg#waypoint-shield',
      '/logo.svg#waypoint-route',
      '/logo.svg#waypoint-pin',
      '/logo.svg#waypoint-pin',
    ]);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.trip-workspace-state-panel')).toBeNull();
  });

  it('keeps the canonical asset addressable for drawing and reduced-motion fallback', () => {
    const logo = readFileSync(resolve(process.cwd(), 'public/logo.svg'), 'utf8');
    const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');

    expect(logo).toContain('id="waypoint-shield"');
    expect(logo).toContain('id="waypoint-route"');
    expect(logo).toContain('pathLength="1"');
    expect(logo).toContain('id="waypoint-pin"');

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
