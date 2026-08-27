// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GearItem } from '@/types';
import { evaluateReadiness } from '@/lib/readiness';
import ReadinessScoreCard from './ReadinessScoreCard';

vi.mock('@/lib/themeContext', () => ({
    useTheme: () => ({ labels: { readiness: 'Readiness' } }),
}));

describe('ReadinessScoreCard', () => {
    beforeEach(() => {
        vi.stubGlobal('IntersectionObserver', class {
            observe() {}
            disconnect() {}
        });
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it('labels the aggregate metric as overall trip readiness', () => {
        const readiness = evaluateReadiness({
            tripId: 'trip-1',
            tripDays: 1,
            gear: [{
                id: 'gear-1',
                name: 'Tent',
                priority: 'critical',
                acquired: true,
                packed: true,
            } as GearItem],
            meals: [],
            timeline: [],
            currentWeather: null,
            forecast: [],
            offlineStatus: null,
            modules: { mealsEnabled: false, offlineEnabled: false },
        });
        render(
            <ReadinessScoreCard readiness={readiness} />
        );
        expect(screen.getByText('Overall trip readiness')).toBeTruthy();
        expect(screen.getByText('Locked In')).toBeTruthy();
    });
});
