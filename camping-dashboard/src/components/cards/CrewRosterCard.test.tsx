// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CrewMember } from '@/types';
import CrewRosterCard, { getCrewLoadRows, splitResponsibilities } from './CrewRosterCard';

vi.mock('@/lib/themeContext', () => ({
    useTheme: () => ({ labels: { crew: 'Crew' } }),
}));

vi.mock('@/components/cards/CrewFormSheet', () => ({
    default: () => null,
}));

const member = (overrides: Partial<CrewMember>): CrewMember => ({
    id: 'crew-test',
    trip_id: 'trip-test',
    name: 'Jordan',
    role: 'Navigator',
    load_item: 'SHELTER SYSTEM + SAFETY CORE',
    load_weight_kg: 25,
    canoe_number: 1,
    notes: 'Keeps the route card close.',
    ...overrides,
});

describe('CrewRosterCard', () => {
    afterEach(cleanup);

    it('splits combined responsibility text into readable assignments', () => {
        expect(splitResponsibilities('SHELTER SYSTEM + SAFETY CORE')).toEqual([
            'SHELTER SYSTEM',
            'SAFETY CORE',
        ]);

        render(<CrewRosterCard crew={[member({})]} />);
        expect(screen.getByText('Shelter System')).toBeTruthy();
        expect(screen.getByText('Safety Core')).toBeTruthy();
        expect(screen.getByText('Canoe 1')).toBeTruthy();
    });

    it('uses raw ratios for bar widths while showing rounded percentages', () => {
        const crew = [
            member({ id: 'jordan', name: 'Jordan', load_weight_kg: 25 }),
            member({ id: 'alex', name: 'Alex', load_weight_kg: 12, load_item: 'FOOD SYSTEM' }),
        ];

        const { rows, totalLoad } = getCrewLoadRows(crew);
        expect(totalLoad).toBe(37);
        expect(rows[0].rawPercentage).toBeCloseTo(67.5676, 3);
        expect(rows[1].rawPercentage).toBeCloseTo(32.4324, 3);

        const { container } = render(<CrewRosterCard crew={crew} />);
        expect(screen.getByText('37 kg')).toBeTruthy();
        expect(screen.getAllByText('68%').length).toBeGreaterThan(0);
        expect(screen.getAllByText('32%').length).toBeGreaterThan(0);
        const segments = container.querySelectorAll('[role="img"] > div');
        expect((segments[0] as HTMLElement).style.width).toBe('67.56756756756756%');
        expect((segments[1] as HTMLElement).style.width).toBe('32.432432432432435%');
        expect(segments[0].className).toContain('bg-accent-green');
        expect(segments[1].className).toContain('bg-text-muted/75');
        expect(segments[1].className).toContain('border-l-2');
        expect(segments[0].className).not.toBe(segments[1].className);
    });

    it('renders one member as the complete load distribution', () => {
        render(<CrewRosterCard crew={[member({ load_weight_kg: 18 })]} />);
        expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
        expect(screen.getByRole('img', { name: 'Load distribution: Jordan 100%' })).toBeTruthy();
    });

    it('handles an empty roster and still explains the load state', () => {
        render(<CrewRosterCard crew={[]} />);
        expect(screen.getByText('No crew members yet')).toBeTruthy();
        expect(screen.getByText('0 kg')).toBeTruthy();
        expect(screen.getByText('No Load Data')).toBeTruthy();
        expect(screen.getByText(/Load distribution will appear/)).toBeTruthy();
    });

    it('keeps four members in the responsive card grid with labelled actions', () => {
        const crew = Array.from({ length: 4 }, (_, index) => member({
            id: `member-${index}`,
            name: `Member ${index + 1}`,
            load_weight_kg: 10,
        }));

        const { container } = render(
            <CrewRosterCard crew={crew} onUpdate={vi.fn()} onDelete={vi.fn()} />
        );

        expect(container.querySelector('.crew-roster-grid')?.className).toContain('md:grid-cols-2');
        expect(container.querySelectorAll('.crew-member-card')).toHaveLength(4);
        expect(screen.getByRole('button', { name: 'Edit Member 1' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Remove Member 1' })).toBeTruthy();
        expect(container.querySelectorAll('.crew-load-segment')).toHaveLength(4);
        expect([...container.querySelectorAll('.crew-load-segment')].map((segment) => segment.className)).toEqual([
            expect.stringContaining('bg-accent-green'),
            expect.stringContaining('bg-text-muted/75'),
            expect.stringContaining('bg-accent-green/55'),
            expect.stringContaining('bg-text-main/55'),
        ]);
    });

    it('keeps the roster heading, count, and add action in one compact section', () => {
        const { container } = render(<CrewRosterCard crew={[member({})]} onAdd={vi.fn()} />);

        expect(screen.getByRole('heading', { level: 2, name: 'Crew' })).toBeTruthy();
        expect(screen.getByText('1 member assigned')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Add crew member' })).toBeTruthy();
        expect(container.querySelector('.crew-roster-section')?.className).toContain('space-y-4');
        expect(container.querySelector('.crew-workspace')?.className).toContain('flex flex-col gap-6');
        expect(container.querySelector('.crew-member-card__notes')).toBeTruthy();
        expect(container.querySelector('.crew-member-card__systems')).toBeTruthy();
        expect(container.querySelector('.crew-member-card__metrics')).toBeTruthy();
    });
});
