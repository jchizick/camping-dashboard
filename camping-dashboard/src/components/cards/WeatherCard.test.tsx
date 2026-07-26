// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WeatherCurrent, WeatherRefreshState } from '@/types';
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

describe('WeatherCard synchronization states', () => {
    afterEach(() => {
        cleanup();
        context.canEdit = false;
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
});
