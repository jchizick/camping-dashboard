// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
        render(
            <ReadinessScoreCard
                readiness={{ overall: 84, label: 'Field Ready', gear: 90, meals: 80, weather: 75, offline: 85, timeline: 90 }}
            />
        );
        expect(screen.getByText('Overall trip readiness')).toBeTruthy();
    });
});
