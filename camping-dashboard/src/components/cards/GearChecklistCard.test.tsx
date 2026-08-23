// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GearItem } from '@/types';
import GearChecklistCard from './GearChecklistCard';

vi.mock('@/lib/themeContext', () => ({
    useTheme: () => ({ labels: { gear: 'Gear' } }),
}));

vi.mock('@/components/cards/GearFormSheet', () => ({
    default: () => null,
}));

const gearItem = (overrides: Partial<GearItem> = {}): GearItem => ({
    id: 'gear-test',
    trip_id: 'trip-test',
    name: 'Tent',
    acquired: false,
    packed: false,
    category: 'Shelter',
    notes: '',
    owner: 'Jordan',
    priority: 'critical',
    weight_kg: 2.4,
    ...overrides,
});

describe('GearChecklistCard', () => {
    afterEach(cleanup);

    it('uses explicit readiness copy and labelled native controls', () => {
        const onToggle = vi.fn();
        render(<GearChecklistCard gear={[gearItem()]} onToggle={onToggle} onAdd={vi.fn()} />);

        expect(screen.getByText('Gear readiness')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Add gear item' })).toBeTruthy();

        const categoryButton = screen.getByRole('button', { name: /Shelter/ });
        expect(categoryButton.getAttribute('aria-expanded')).toBe('true');

        const acquiredButton = screen.getByRole('button', { name: 'Tent — not acquired' });
        expect(acquiredButton.getAttribute('aria-pressed')).toBe('false');
        fireEvent.click(acquiredButton);
        expect(onToggle).toHaveBeenCalledWith('gear-test');
    });

    it('filters to one category and restores all categories through its button', () => {
        render(<GearChecklistCard gear={[
            gearItem(),
            gearItem({ id: 'stove', name: 'Stove', category: 'Cooking' }),
        ]} />);
        const categoryButton = screen.getByRole('button', { name: /Shelter/ });
        const cookingButton = screen.getByRole('button', { name: /Cooking/ });

        fireEvent.click(categoryButton);
        expect(categoryButton.getAttribute('aria-expanded')).toBe('true');
        expect(cookingButton.getAttribute('aria-expanded')).toBe('false');
        expect(screen.getByText('Tent')).toBeTruthy();
        expect(screen.queryByText('Stove')).toBeNull();

        fireEvent.click(categoryButton);
        expect(categoryButton.getAttribute('aria-expanded')).toBe('true');
        expect(cookingButton.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByText('Stove')).toBeTruthy();
    });
});
