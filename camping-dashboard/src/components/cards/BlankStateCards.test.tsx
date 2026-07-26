// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfflineVaultCard from './OfflineVaultCard';
import ParkIntelCard from './ParkIntelCard';
import ReadinessScoreCard from './ReadinessScoreCard';
import WeatherCard from './WeatherCard';

vi.mock('@/lib/themeContext', () => ({
    useTheme: () => ({
        labels: {
            weather: 'Weather Intel',
            parkIntel: 'Park Intelligence',
            offline: 'Offline Vault',
            readiness: 'Mission Readiness',
        },
    }),
}));

describe('optional dashboard module empty states', () => {
    beforeEach(() => {
        window.history.pushState({}, '', '/trips/test-trip?dev=true');
        vi.stubGlobal('IntersectionObserver', class {
            observe() {}
            disconnect() {}
        });
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('renders neutral park and offline states without factual zero percentages', () => {
        const { rerender } = render(<ParkIntelCard intel={null} onUpdate={vi.fn()} />);

        expect(screen.getByText('Park intelligence has not been added yet.')).toBeTruthy();
        expect(screen.queryByText('0%')).toBeNull();

        rerender(<OfflineVaultCard status={null} onToggle={vi.fn()} />);

        expect(screen.getByText('Offline readiness has not been configured yet. Select an item to begin.')).toBeTruthy();
        expect(screen.queryByText('0%')).toBeNull();
        expect(screen.getByRole('button', { name: 'Maps Cached' })).toBeTruthy();
    });

    it('marks missing optional readiness inputs unavailable', () => {
        render(
            <ReadinessScoreCard
                readiness={{
                    overall: 0,
                    gear: 0,
                    meals: 0,
                    weather: 0,
                    offline: 0,
                    timeline: 0,
                    label: 'Not Ready',
                }}
                unavailable={{ offline: true, weather: true }}
            />
        );

        expect(screen.getAllByText('Unavailable')).toHaveLength(2);
    });

    it('offers the first weather refresh while current weather is absent', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ error: 'test failure' }),
        });
        vi.stubGlobal('fetch', fetchMock);
        vi.stubEnv('NEXT_PUBLIC_WEATHER_REFRESH_SECRET', 'test-secret');
        vi.spyOn(console, 'error').mockImplementation(() => {});

        render(<WeatherCard tripId="test-trip" weather={null} astro={null} />);
        fireEvent.click(screen.getByRole('button', { name: 'Refresh Weather' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(String(fetchMock.mock.calls[0][0])).toContain('trip_id=test-trip');
        expect(screen.getByText('Weather has not been refreshed for this campsite yet.')).toBeTruthy();
    });
});
