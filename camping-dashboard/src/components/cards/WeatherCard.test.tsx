// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WeatherCurrent, WeatherForecast, WeatherRefreshState } from '@/types';
import WeatherCard from './WeatherCard';

const context = vi.hoisted(() => ({ canEdit: false }));

vi.mock('@/lib/themeContext', () => ({
    useTheme: () => ({ labels: { weather: 'Weather Intel' } }),
}));

vi.mock('@/lib/tripContext', () => ({
    useTrip: () => ({ canEdit: context.canEdit }),
}));

const weather: WeatherCurrent = {
    trip_id: 'weather-test',
    temperature_c: 18,
    condition_label: 'Partly Cloudy',
    icon: 'cloud-sun',
    updated_at: '2026-07-26T16:00:00.000Z',
    wind_kph: null,
    humidity: null,
    rain_chance: null,
    sunrise_time: null,
    sunset_time: null,
    moonset_time: null,
    visibility: null,
};

const refreshState: WeatherRefreshState = {
    trip_id: 'weather-test',
    status: 'retry',
    attempt_count: 1,
    created_at: '2026-07-26T16:00:00.000Z',
    updated_at: '2026-07-26T16:00:00.000Z',
    next_refresh_at: '2026-07-26T17:00:00.000Z',
    last_attempt_at: '2026-07-26T16:00:00.000Z',
    last_success_at: '2026-07-26T15:00:00.000Z',
    locked_at: null,
    locked_by: null,
    last_error_code: 'provider_timeout',
    last_error_summary: 'Weather provider timed out.',
    provider: 'open-meteo',
    provider_timezone: 'America/Toronto',
    utc_offset_seconds: -14400,
    source_observed_at: '2026-07-26T15:00:00.000Z',
    provider_generated_at: null,
    request_fingerprint: 'a'.repeat(64),
    payload_fingerprint: 'b'.repeat(64),
};

const forecast: WeatherForecast[] = Array.from({ length: 6 }, (_, index) => ({
    id: `forecast-${index}`,
    trip_id: 'weather-test',
    forecast_date: `2026-07-${String(27 + index).padStart(2, '0')}`,
    high_c: 20 + index,
    low_c: 10 + index,
    condition_label: index === 0 ? 'Clear Sky' : `Forecast condition ${index}`,
    rain_chance: index * 10,
    wind_kph: null,
    icon: index === 0 ? 'sun' : 'cloud-rain',
}));

describe('WeatherCard synchronization states', () => {
    afterEach(() => {
        cleanup();
        context.canEdit = false;
        vi.unstubAllGlobals();
    });

    it('renders stale valid weather and optional null fields without crashing', () => {
        render(
            <WeatherCard
                tripId="weather-test"
                weather={weather}
                weatherRefresh={refreshState}
                astro={null}
            />
        );

        expect(screen.getByText('Stale weather shown; an automatic retry is scheduled.')).toBeTruthy();
        expect(screen.getAllByText('—').length).toBeGreaterThan(0);
        expect(screen.queryByRole('button', { name: 'Refresh Weather' })).toBeNull();
    });

    it('shows the authenticated manual refresh control only to editors', () => {
        context.canEdit = true;
        render(
            <WeatherCard
                tripId="weather-test"
                weather={weather}
                weatherRefresh={{ ...refreshState, status: 'idle' }}
                astro={null}
            />
        );

        expect(screen.getByRole('button', { name: 'Refresh Weather' })).toBeTruthy();
    });

    it('distinguishes unavailable failed weather from stale usable weather', () => {
        render(
            <WeatherCard
                tripId="weather-test"
                weather={null}
                weatherRefresh={{ ...refreshState, status: 'failed' }}
                astro={null}
            />
        );

        expect(screen.getByText('Weather is currently unavailable.')).toBeTruthy();
    });

    it('renders the compact Home conditions and five-day forecast without condition copy', () => {
        context.canEdit = true;
        render(
            <WeatherCard
                tripId="weather-test"
                weather={{
                    ...weather,
                    wind_kph: 8,
                    humidity: 62,
                    rain_chance: 10,
                    sunrise_time: '05:45',
                    sunset_time: '20:30',
                }}
                weatherRefresh={{ ...refreshState, status: 'idle' }}
                astro={null}
                forecast={forecast}
                variant="home"
            />
        );

        expect(screen.getByText(/^Updated /)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Refresh Weather' })).toBeTruthy();
        expect(screen.getByText('5-day forecast')).toBeTruthy();
        expect(screen.getByText('Partly Cloudy')).toBeTruthy();
        expect(screen.getByText('Wind')).toBeTruthy();
        expect(screen.getByText('Humidity')).toBeTruthy();
        expect(screen.getByText('Rain Chance')).toBeTruthy();
        expect(screen.getByText('Daylight')).toBeTruthy();
        expect(screen.getByText('14h 45m')).toBeTruthy();
        expect(
            screen.getByRole('img', { name: 'Daylight from 05:45 to 20:30; 14h 45m' })
        ).toBeTruthy();
        expect(screen.getByText('05:45')).toBeTruthy();
        expect(screen.getByText('20:30')).toBeTruthy();
        expect(screen.getByText('20°')).toBeTruthy();
        expect(screen.getByText('/ 10°')).toBeTruthy();
        expect(screen.queryByText('Forecast condition 1')).toBeNull();
        expect(screen.queryByText('25°')).toBeNull();
    });

    it('keeps the Home refresh action functional and exposes its error state', async () => {
        context.canEdit = true;
        const fetchMock = vi.fn().mockResolvedValue({ ok: false });
        vi.stubGlobal('fetch', fetchMock);

        render(
            <WeatherCard
                tripId="weather-test"
                weather={weather}
                weatherRefresh={{ ...refreshState, status: 'idle' }}
                astro={null}
                forecast={forecast}
                variant="home"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Refresh Weather' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/refresh-weather',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ tripId: 'weather-test' }),
            })
        );
        expect(
            screen.getByRole('button', { name: 'Refresh failed — try again' })
        ).toBeTruthy();
    });

    it('keeps Home unavailable states inside the unified panel', () => {
        render(
            <WeatherCard
                tripId="weather-test"
                weather={null}
                weatherRefresh={{ ...refreshState, status: 'failed' }}
                astro={null}
                forecast={[]}
                variant="home"
            />
        );

        expect(
            screen.getByText('Weather has not been refreshed for this campsite yet.')
        ).toBeTruthy();
        expect(screen.getByText('Weather is currently unavailable.')).toBeTruthy();
        expect(screen.getByText('Forecast unavailable.')).toBeTruthy();
        expect(screen.queryByText('Daylight')).toBeNull();
    });
});
