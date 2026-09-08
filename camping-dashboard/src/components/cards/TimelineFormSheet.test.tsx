// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TimelineEvent } from '@/types';
import TimelineFormSheet from './TimelineFormSheet';

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

describe('TimelineFormSheet', () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('preserves a null phase when editing an uncategorized event', async () => {
        const onUpdate = vi.fn().mockResolvedValue(undefined);
        render(
            <TimelineFormSheet isOpen onClose={vi.fn()} initialEvent={event({})} tripDays={1} onSubmit={onUpdate} />
        );

        expect((screen.getByLabelText('Phase Tag') as HTMLSelectElement).value).toBe('');
        fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

        await waitFor(() => {
            expect(onUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ phase: null })
            );
        });
    });

    it('creates new timeline events with the explicit None phase', async () => {
        const onAdd = vi.fn().mockResolvedValue(undefined);
        render(<TimelineFormSheet isOpen onClose={vi.fn()} tripDays={1} onSubmit={onAdd} />);

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
