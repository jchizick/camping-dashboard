// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TimelineEvent } from '@/types';
import TimelineCard from './TimelineCard';

vi.mock('@/lib/themeContext', () => ({
    useTheme: () => ({
        labels: {
            timeline: 'Timeline',
        },
    }),
}));

const event = (overrides: Partial<TimelineEvent>): TimelineEvent => ({
    id: 'timeline-test',
    trip_id: 'trip-test',
    day_number: 1,
    event_time: '09:00',
    title: 'Legacy event',
    details: '',
    sort_order: 10,
    phase: null,
    ...overrides,
});

describe('TimelineCard', () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('renders null-phase events chronologically as uncategorized', () => {
        render(
            <TimelineCard
                events={[
                    event({ id: 'later', title: 'Later event', sort_order: 20 }),
                    event({ id: 'earlier', title: 'Earlier event', sort_order: 10 }),
                ]}
                tripDays={1}
            />
        );

        expect(screen.getAllByText('Uncategorized')).toHaveLength(2);
        const titles = screen.getAllByRole('heading', { level: 4 }).map((node) => node.textContent);
        expect(titles).toEqual(['Earlier event', 'Later event']);
    });

    it('groups by day_number and renders the stored event_time', () => {
        render(
            <TimelineCard
                events={[
                    event({ id: 'day-1', title: 'Day one launch', event_time: '09:15' }),
                    event({
                        id: 'day-2',
                        title: 'Day two paddle',
                        day_number: 2,
                        event_time: '07:30',
                    }),
                ]}
                tripDays={2}
            />
        );

        expect(screen.getByText('Day one launch')).toBeTruthy();
        expect(screen.getByText('09:15')).toBeTruthy();
        expect(screen.queryByText('Day two paddle')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Day 2' }));
        expect(screen.getByText('Day two paddle')).toBeTruthy();
        expect(screen.getByText('07:30')).toBeTruthy();
        expect(screen.queryByText('Day one launch')).toBeNull();
    });

    it('renders a newly created trip with no timeline events', () => {
        render(<TimelineCard events={[]} tripDays={1} />);

        expect(screen.getByText('No events planned for this day yet')).toBeTruthy();
    });

    it('preserves a null phase when editing an uncategorized event', async () => {
        const onUpdate = vi.fn().mockResolvedValue(undefined);
        render(
            <TimelineCard
                events={[event({})]}
                tripDays={1}
                onUpdate={onUpdate}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Edit Legacy event' }));
        expect((screen.getByLabelText('Phase Tag') as HTMLSelectElement).value).toBe('');
        fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

        await waitFor(() => {
            expect(onUpdate).toHaveBeenCalledWith(
                'timeline-test',
                expect.objectContaining({ phase: null })
            );
        });
    });

    it('creates new timeline events with the explicit None phase', async () => {
        const onAdd = vi.fn().mockResolvedValue(undefined);
        render(<TimelineCard events={[]} tripDays={1} onAdd={onAdd} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add timeline event' }));
        fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'New event' } });
        expect((screen.getByLabelText('Phase Tag') as HTMLSelectElement).value).toBe('None');
        fireEvent.click(screen.getByRole('button', { name: 'Add Event' }));

        await waitFor(() => {
            expect(onAdd).toHaveBeenCalledWith(
                expect.objectContaining({ title: 'New event', phase: 'None' })
            );
        });
    });
});
