// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateReadiness } from '@/lib/readiness';
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

vi.mock('@/lib/tripContext', () => ({
    useTrip: () => ({ canEdit: true }),
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

        expect(screen.getByText('Field Prep hasn’t been set up yet')).toBeTruthy();
        expect(screen.getByText('This saved trip is read-only. Field Prep can be set up when editing is available.')).toBeTruthy();
        expect(screen.queryByText('0%')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Maps Cached' })).toBeNull();
    });

    it('marks missing optional readiness inputs unavailable', () => {
        const readiness = evaluateReadiness({
            tripId: 'test-trip',
            tripDays: 1,
            gear: [],
            meals: [],
            timeline: [],
            currentWeather: null,
            forecast: [],
            offlineStatus: null,
            modules: { mealsEnabled: false, offlineEnabled: true },
        });
        render(
            <ReadinessScoreCard readiness={readiness} />
        );

        expect(screen.getByText('Readiness Unavailable')).toBeTruthy();
        expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(2);
    });

    it('offers the first weather refresh while current weather is absent', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ error: 'test failure' }),
        });
        vi.stubGlobal('fetch', fetchMock);

        render(
            <WeatherCard
                tripId="test-trip"
                weather={null}
                weatherRefresh={null}
                astro={null}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Refresh Weather' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/refresh-weather',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ tripId: 'test-trip' }),
            })
        );
        expect(screen.getByText('Weather has not been refreshed for this campsite yet.')).toBeTruthy();
    });
});
