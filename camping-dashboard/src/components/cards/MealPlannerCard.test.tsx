// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Meal } from '@/types';
import MealPlannerCard from './MealPlannerCard';

vi.mock('@/lib/themeContext', () => ({
    useTheme: () => ({ labels: { meals: 'Meal Planner' } }),
}));

vi.mock('@/components/cards/MealFormSheet', () => ({
    default: () => null,
}));

const breakfast = {
    id: 'meal-breakfast',
    trip_id: 'trip-test',
    day_number: 1,
    meal_type: 'breakfast',
    prep_type: 'restaurant',
    title: 'Stop in Town',
    notes: 'Eat in Kincardine',
    calories: 600,
    assigned_to: null,
} as Meal;

describe('MealPlannerCard', () => {
    afterEach(cleanup);

    it('keeps day controls and the calorie footer outside the labelled meal-entry region', () => {
        const { container } = render(
            <MealPlannerCard meals={[breakfast]} totalDays={5} />
        );

        const entries = screen.getByRole('region', { name: 'Meals for Day 1' });
        expect(entries.className).toContain('meal-planner-card__entries');
        expect(entries.getAttribute('tabindex')).toBe('0');
        expect(screen.getByRole('button', { name: 'Day 1' })).toBeTruthy();
        expect(screen.getByText('Day Total')).toBeTruthy();
        expect(screen.getByText('600 kcal')).toBeTruthy();
        expect(container.querySelector('.meal-planner-card__footer')).toBeTruthy();
        expect(entries.contains(container.querySelector('.meal-planner-card__footer'))).toBe(false);
    });
});
