// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GearItem } from '@/types';
import { evaluateGearCategory } from '@/lib/readiness';
import GearChecklistCard from './GearChecklistCard';

vi.mock('@/lib/themeContext', () => ({
    useTheme: () => ({ labels: { gear: 'Gear' } }),
}));

const { gearFormSheetSpy } = vi.hoisted(() => ({ gearFormSheetSpy: vi.fn() }));

vi.mock('@/components/cards/GearFormSheet', () => ({
    default: (props: unknown) => {
        gearFormSheetSpy(props);
        return null;
    },
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
    responsible_crew_member_id: null,
    priority: 'critical',
    weight_kg: 2.4,
    ...overrides,
});

function renderChecklist(
    gear: GearItem[],
    props: Partial<React.ComponentProps<typeof GearChecklistCard>> = {}
) {
    return render(
        <GearChecklistCard
            gear={gear}
            categoryReadiness={evaluateGearCategory(gear)}
            {...props}
        />
    );
}

describe('GearChecklistCard', () => {
    afterEach(() => {
        cleanup();
        gearFormSheetSpy.mockClear();
    });

    it('does not present an empty gear plan as a factual zero readiness score', () => {
        renderChecklist([]);

        expect(screen.getByText('Unavailable')).toBeTruthy();
        expect(screen.getByText('Required gear not identified')).toBeTruthy();
        expect(screen.queryByText('0%')).toBeNull();
    });

    it('presets Required only for the explicit Add required gear action', () => {
        const onAdd = vi.fn().mockResolvedValue(undefined);
        renderChecklist([], { onAdd });

        fireEvent.click(screen.getByRole('button', { name: 'Add required gear' }));
        let sheetProps = gearFormSheetSpy.mock.calls.at(-1)?.[0] as {
            defaultRequired?: boolean;
            isOpen?: boolean;
        };
        expect(sheetProps.isOpen).toBe(true);
        expect(sheetProps.defaultRequired).toBe(true);

        fireEvent.click(screen.getByRole('button', { name: 'Add gear item' }));
        sheetProps = gearFormSheetSpy.mock.calls.at(-1)?.[0] as {
            defaultRequired?: boolean;
        };
        expect(sheetProps.defaultRequired).toBe(false);
    });

    it('consumes a one-shot Required add intent and opens the correct form state', async () => {
        const onAddIntentConsumed = vi.fn();
        renderChecklist([], {
            onAdd: vi.fn().mockResolvedValue(undefined),
            addIntent: 'required',
            onAddIntentConsumed,
        });

        await waitFor(() => expect(onAddIntentConsumed).toHaveBeenCalledTimes(1));
        const sheetProps = gearFormSheetSpy.mock.calls.at(-1)?.[0] as {
            defaultRequired?: boolean;
            isOpen?: boolean;
        };
        expect(sheetProps.isOpen).toBe(true);
        expect(sheetProps.defaultRequired).toBe(true);
    });

    it('uses explicit readiness copy and labelled native controls', () => {
        const onToggle = vi.fn();
        const gear = [gearItem()];
        renderChecklist(gear, { onToggle, onAdd: vi.fn() });

        expect(screen.getByText('Gear readiness')).toBeTruthy();
        expect(screen.getByText('Estimated weight')).toBeTruthy();
        expect(screen.getByText('Total estimated gear weight: 2.4 kg').className).toContain('md:flex');
        expect(screen.getByText('2.4 kg')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Add gear item' })).toBeTruthy();

        const categoryButton = screen.getByRole('button', { name: /Shelter/ });
        expect(categoryButton.getAttribute('aria-expanded')).toBe('true');

        const acquiredButton = screen.getByRole('button', { name: 'Tent — not acquired' });
        expect(acquiredButton.getAttribute('aria-pressed')).toBe('false');
        fireEvent.click(acquiredButton);
        expect(onToggle).toHaveBeenCalledWith('gear-test');
        expect(screen.getAllByText('Required').length).toBeGreaterThan(0);
    });

    it('filters to one category and restores all categories through its button', () => {
        const gear = [
            gearItem(),
            gearItem({ id: 'stove', name: 'Stove', category: 'Cooking' }),
        ];
        renderChecklist(gear);
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

    it('renders an approximate planned weight when some item weights are unknown', () => {
        const gear = [
            gearItem({ weight_kg: 2.4, packed: true }),
            gearItem({ id: 'stove', name: 'Stove', weight_kg: 1.25, packed: false }),
            gearItem({ id: 'map', name: 'Map', category: 'Navigation', weight_kg: 0 }),
        ];
        renderChecklist(gear);

        expect(screen.getByText('Estimated weight')).toBeTruthy();
        expect(screen.getByText('Total estimated gear weight: ~3.7 kg')).toBeTruthy();
        expect(screen.getByText('~3.7 kg')).toBeTruthy();
    });

    it('keeps all planned gear in packing progress while optional gear remains non-scoring', () => {
        const gear = [
            gearItem({ id: 'required', acquired: true, packed: true }),
            gearItem({ id: 'chair', name: 'Camp chair', priority: 'low', packed: false }),
            gearItem({ id: 'book', name: 'Book', priority: 'high', packed: true }),
        ];
        renderChecklist(gear);

        const progress = screen.getByRole('progressbar', { name: 'Overall packing progress' });
        expect(progress.getAttribute('aria-valuetext')).toBe('2 of 3 planned items packed');
        expect(progress.getAttribute('data-state')).toBe('pending');
        expect(screen.getByText('Required gear ready')).toBeTruthy();
        expect(screen.queryByText(/required item.*needs packing/i)).toBeNull();
    });

    it('switches packing progress from pending to complete only at 100 percent', () => {
        renderChecklist([
            gearItem({ id: 'tent', acquired: true, packed: true }),
            gearItem({ id: 'chair', name: 'Camp chair', priority: 'low', packed: false }),
        ]);

        expect(screen.getByRole('progressbar', { name: 'Overall packing progress' }).getAttribute('data-state')).toBe('pending');

        cleanup();
        renderChecklist([
            gearItem({ id: 'tent', acquired: true, packed: true }),
            gearItem({ id: 'chair', name: 'Camp chair', priority: 'low', acquired: true, packed: true }),
        ]);

        expect(screen.getByRole('progressbar', { name: 'Overall packing progress' }).getAttribute('data-state')).toBe('complete');
    });

    it('presents missing Required gear as a blocker and focuses the canonical list', () => {
        const gear = [
            gearItem({ id: 'tent', name: 'Tent', acquired: false, packed: false }),
            gearItem({ id: 'chair', name: 'Camp chair', priority: 'low' }),
        ];
        renderChecklist(gear);

        expect(screen.getByText('1 required item missing')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Show required' }));
        expect(screen.getByRole('button', { name: 'Required' }).getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByText('Tent')).toBeTruthy();
        expect(screen.queryByText('Camp chair')).toBeNull();
        expect(screen.getByText('Missing · Not acquired')).toBeTruthy();
    });

    it('presents acquired Required gear as needing packing and keeps pack separate from on-hand', () => {
        const onToggle = vi.fn();
        const onTogglePacked = vi.fn();
        const gear = [gearItem({ acquired: true, packed: false })];
        renderChecklist(gear, { onToggle, onTogglePacked });

        expect(screen.getByText('1 required item still needs packing')).toBeTruthy();
        expect(screen.getByText('On hand · Needs packing')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Tent — not packed' }));
        expect(onTogglePacked).toHaveBeenCalledWith('gear-test');
        expect(onToggle).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Tent — on hand' }));
        expect(onToggle).toHaveBeenCalledWith('gear-test');
    });

    it('does not convert optional-only packed Gear into readiness-complete messaging', () => {
        const gear = [gearItem({ priority: 'low', acquired: true, packed: true })];
        renderChecklist(gear);

        expect(screen.getByText('Required gear not identified')).toBeTruthy();
        expect(screen.queryByText('Required gear ready')).toBeNull();
    });

    it('labels the former Needed filter accurately and preserves exact filter semantics', () => {
        const gear = [
            gearItem({ id: 'packed', name: 'Packed tent', packed: true }),
            gearItem({ id: 'required', name: 'Required tarp', priority: 'critical', packed: false }),
            gearItem({ id: 'optional', name: 'Optional chair', priority: 'low', packed: false }),
        ];
        renderChecklist(gear);

        const toPack = screen.getByRole('button', { name: 'To pack' });
        expect(toPack.getAttribute('data-filter')).toBe('to-pack');
        fireEvent.click(toPack);
        expect(toPack.getAttribute('aria-pressed')).toBe('true');
        expect(screen.queryByText('Packed tent')).toBeNull();
        expect(screen.getByText('Required tarp')).toBeTruthy();
        expect(screen.getByText('Optional chair')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Required' }));
        expect(screen.getByText('Packed tent')).toBeTruthy();
        expect(screen.getByText('Required tarp')).toBeTruthy();
        expect(screen.queryByText('Optional chair')).toBeNull();
    });

    it('preserves category counts, edit targeting, and delete confirmation', async () => {
        const onUpdate = vi.fn().mockResolvedValue(undefined);
        const onDelete = vi.fn().mockResolvedValue(undefined);
        const gear = [
            gearItem({ id: 'tent', packed: true }),
            gearItem({ id: 'tarp', name: 'Tarp', packed: false }),
        ];
        renderChecklist(gear, { onUpdate, onDelete });

        expect(screen.getByRole('button', { name: /Shelter.*1\/2/ })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Tent' }));
        const editProps = gearFormSheetSpy.mock.calls.at(-1)?.[0] as { initialItem?: GearItem };
        expect(editProps.initialItem?.id).toBe('tent');

        fireEvent.click(screen.getByRole('button', { name: 'Delete Tent' }));
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
        await waitFor(() => expect(onDelete).toHaveBeenCalledWith('tent'));
    });
});
