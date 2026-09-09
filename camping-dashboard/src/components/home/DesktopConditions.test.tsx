// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DesktopConditions from './DesktopConditions';
import type { HomeViewModel } from './homeViewModel';
import { TripWorkspaceStatusProvider } from '@/components/trip/TripWorkspaceStatus';
import { requestWeatherRefresh } from '@/lib/weatherPresentation';

const conditions = {
  currentWeather: { temperature_c: 18, condition_label: 'Clear', sunset_time: '19:47', updated_at: '2026-09-08T12:00:00Z' },
  weatherRefresh: null, astro: null,
  forecast: ['2026-09-09', '2026-09-10'].map((date, index) => ({ id: date, forecast_date: date, high_c: 20 + index, low_c: 10, condition_label: 'Rain', rain_chance: 30 })),
} as HomeViewModel['conditions'];
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('desktop Conditions', () => {
  it('discloses existing forecast in source order and removes it on collapse', () => {
    const { container } = render(<DesktopConditions conditions={conditions} />);
    expect(screen.getByText('18°C')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    const open = screen.getByRole('button', { name: 'View forecast' });
    expect(open.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(open);
    expect(open.getAttribute('aria-expanded')).toBe('true');
    expect([...container.querySelectorAll('time')].map(time => time.dateTime)).toEqual(['2026-09-09', '2026-09-10']);
    fireEvent.click(screen.getByRole('button', { name: 'Hide forecast' }));
    expect(screen.queryByRole('list')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View forecast' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('limits the forecast to five source-ordered days and labels missing fields', () => {
    const forecast = Array.from({ length: 6 }, (_, index) => ({ ...conditions.forecast[0], id: String(index), forecast_date: `2026-09-${15 - index}`,
      high_c: null, low_c: null, rain_chance: null, condition_label: '' }));
    const { container } = render(<DesktopConditions conditions={{ ...conditions, forecast }} />);
    fireEvent.click(screen.getByRole('button', { name: 'View forecast' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect([...container.querySelectorAll('time')].map(time => time.dateTime)).toEqual(forecast.slice(0, 5).map(day => day.forecast_date));
    expect(screen.getAllByText('Conditions unavailable')).toHaveLength(5);
    expect(screen.getAllByText('Rain —')).toHaveLength(5);
    expect(screen.getAllByRole('listitem')[0].textContent).toContain('— / —');
  });

  it('keeps an empty forecast truthful and omits refresh for read-only users', () => {
    render(<DesktopConditions conditions={{ ...conditions, forecast: [] }} />);
    expect(screen.queryByRole('button', { name: 'Refresh weather' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View forecast' }));
    expect(screen.getByText('Forecast unavailable.')).toBeTruthy();
  });

  it('recovers after an error and displays refreshed workspace data without closing the forecast', async () => {
    const refresh = vi.fn().mockRejectedValueOnce(new Error('Try again')).mockResolvedValue(undefined);
    const view = render(<DesktopConditions conditions={conditions} onRefresh={refresh} />);
    fireEvent.click(screen.getByRole('button', { name: 'View forecast' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Refresh weather' })); });
    expect(screen.getByRole('alert').textContent).toBe('Try again');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Refresh weather' })); });
    view.rerender(<DesktopConditions conditions={{ ...conditions, currentWeather: { ...conditions.currentWeather!, temperature_c: 22 } }} onRefresh={refresh} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('22°C')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hide forecast' })).toBeTruthy();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('retains weather, prevents duplicate refreshes, and announces completion', async () => {
    let finish!: () => void;
    const refresh = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<DesktopConditions conditions={conditions} onRefresh={refresh} />);
    const button = screen.getByRole('button', { name: 'Refresh weather' });
    fireEvent.click(button); fireEvent.click(button);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toBe('Refreshing weather…');
    expect(screen.getByText('18°C')).toBeTruthy();
    await act(async () => finish());
    expect(screen.getByRole('status').textContent).toBe('Weather refresh completed.');
  });

  it('shows refresh errors without discarding conditions', async () => {
    render(<DesktopConditions conditions={conditions} onRefresh={async () => { throw new Error('Refresh unavailable'); }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh weather' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Refresh unavailable');
    expect(screen.getByText('18°C')).toBeTruthy();
  });

  it.each(['cache', 'online'] as const)('omits refresh when offline with %s data', source => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));
    render(<TripWorkspaceStatusProvider value={{ source, connectivity: 'offline', cachedAt: null, lastOnlineVerifiedAt: null, reload: vi.fn() }}>
      <DesktopConditions conditions={conditions} onRefresh={vi.fn()} />
    </TripWorkspaceStatusProvider>);
    expect(screen.queryByRole('button', { name: 'Refresh weather' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View forecast' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(source === 'cache' ? 1 : 2);
  });

  it('uses the existing manual request endpoint and payload', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal('fetch', fetch);
    await requestWeatherRefresh('trip-1');
    expect(fetch).toHaveBeenCalledWith('/api/refresh-weather', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tripId: 'trip-1' }) });
  });
});
